import { useColors } from '../../contexts/ThemeContext';
// src/screens/customer/CartScreen.js

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { EmptyState } from '../../components/EmptyState';
import { useCart } from '../../hooks/useCart';
import { useI18n } from '../../contexts/i18nContext';
import CheckoutContent from '../../components/CheckoutContent';
import { getProductFallbackPhoto } from '../../utils/productPhotoFallbacks';
import { RADIUS, SPACING, LAYOUT, TYPE, TEXT_STYLES } from '../../theme/tokens';

const TABS = {
  CART: 'cart',
  CHECKOUT: 'checkout',
};

// Own component (not inline in the stall .map() below) so each row can
// track its own image load/error state — a hook can't live inside a
// .map() callback. Same three-tier fallback used everywhere else a
// product photo renders (real photo -> curated fallback -> icon): cart
// rows never had an image slot at all before, so every item showed as
// text-only regardless of whether the product actually had a photo.
const CartItemThumb = ({ name, imageUrl, style }) => {
  const [imageError, setImageError] = useState(false);
  const fallbackPhoto = !imageUrl || imageError ? getProductFallbackPhoto(name) : null;

  if (imageUrl && !imageError) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={style}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />
    );
  }
  if (fallbackPhoto) {
    return <Image source={fallbackPhoto} style={style} resizeMode="cover" />;
  }
  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
      <Ionicons name="cart-outline" size={22} color="#B8A99A" />
    </View>
  );
};

export default function CartScreen({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { cart, updateQuantity, removeItem, clearCart, refreshCart } = useCart();
  const { t } = useI18n();
  const [refreshing, setRefreshing] = useState(false);
  const [hasClosedStall, setHasClosedStall] = useState(false);
  const [closedStallNames, setClosedStallNames] = useState([]);
  const [closedStallIds, setClosedStallIds] = useState([]);
  const [activeTab, setActiveTab] = useState(TABS.CART);

  // ProductDetailsScreen's "Buy Now" hands over a fully-formed item instead
  // of relying on the shared cart (add-then-select-only-this-item raced
  // against the cart's own fetch/sync and could land here before the item
  // existed, showing an empty ₱0.00 checkout). When present, this item is
  // what gets checked out — the customer's actual cart is never read or
  // touched for this purchase, so anything already sitting in it can't get
  // swept in.
  const directBuyItem = route?.params?.directBuyItem || null;
  useEffect(() => {
    if (directBuyItem && route?.params?.openCheckout) {
      setActiveTab(TABS.CHECKOUT);
    }
  }, [directBuyItem, route?.params?.openCheckout]);

  // Which cart items are checked in for "this checkout" — the rest stay
  // in the cart untouched. Defaults to everything selected on a normal
  // cart visit (a direct-buy visit skips this entirely — see directBuyItem
  // above).
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectionInitialized = useRef(false);
  useEffect(() => {
    if (directBuyItem || cart.length === 0) return;
    setSelectedIds(prev => {
      if (!selectionInitialized.current) {
        selectionInitialized.current = true;
        return new Set(cart.map(item => item.product_id));
      }
      // Newly-added items (added while already on this screen) default
      // to checked; ids no longer in the cart are harmless to leave —
      // selection is only ever read via cart.filter(selectedIds.has(...)).
      const next = new Set(prev);
      let changed = false;
      cart.forEach(item => {
        if (!next.has(item.product_id)) { next.add(item.product_id); changed = true; }
      });
      return changed ? next : prev;
    });
  }, [cart, directBuyItem]);

  const toggleSelected = (productId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // One tap to select/deselect every item from a single stall — each stall
  // pays out separately (own GCash), so "everything from this vendor" is
  // the natural unit to act on, same as the reference layout's per-seller
  // checkbox next to the store name.
  const isStallFullySelected = (items) => items.length > 0 && items.every(item => selectedIds.has(item.product_id));
  const toggleStallSelected = (items) => {
    const allSelected = isStallFullySelected(items);
    setSelectedIds(prev => {
      const next = new Set(prev);
      items.forEach(item => {
        if (allSelected) next.delete(item.product_id);
        else next.add(item.product_id);
      });
      return next;
    });
  };

  const isAllSelected = cart.length > 0 && cart.every(item => selectedIds.has(item.product_id));
  const toggleSelectAll = () => {
    setSelectedIds(isAllSelected ? new Set() : new Set(cart.map(item => item.product_id)));
  };

  const selectedItems = directBuyItem ? [directBuyItem] : cart.filter(item => selectedIds.has(item.product_id));
  const selectedTotal = selectedItems.reduce((sum, item) => sum + (item.quantity || 1) * item.price, 0);

  useFocusEffect(
    useCallback(() => {
      refreshCart();
      return () => {};
    }, [refreshCart])
  );

  useEffect(() => {
    refreshCart();
  }, []);

  useEffect(() => {
    checkStallStatus();
  }, [cart]);

  const checkStallStatus = async () => {
    if (cart.length === 0) {
      setHasClosedStall(false);
      setClosedStallNames([]);
      setClosedStallIds([]);
      return;
    }

    const uniqueStallIds = [...new Set(cart.map(item => item.stall_id))];
    const closedStalls = [];
    const closedIds = [];

    for (const stallId of uniqueStallIds) {
      const { data: stall } = await supabase
        .from('stalls')
        .select('stall_name, is_temporarily_closed')
        .eq('id', stallId)
        .single();

      if (stall?.is_temporarily_closed) {
        closedStalls.push(stall.stall_name || `Stall #${stallId}`);
        closedIds.push(stallId);
      }
    }

    setHasClosedStall(closedStalls.length > 0);
    setClosedStallNames(closedStalls);
    setClosedStallIds(closedIds);
  };

  const removeItemsFromClosedStalls = async () => {
    for (const item of cart) {
      if (closedStallIds.includes(item.stall_id)) {
        await removeItem(item.product_id);
      }
    }
    Alert.alert(t('cart.cart_updated_title'), t('cart.cart_updated_body'));
    await checkStallStatus();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCart();
    await checkStallStatus();
    setRefreshing(false);
  };

  const updateItemQuantity = (item, change) => {
    const newQuantity = (item.quantity || 1) + change;
    if (newQuantity <= 0) {
      // react-native-web does NOT implement Alert.alert — use window.confirm on web
      if (Platform.OS === 'web') {
        if (window.confirm(`${t('cart.remove_item', 'Remove Item')}\n\n${t('cart.remove_item_named', 'Remove %{name} from cart?', { name: item.name })}`)) {
          removeItem(item.product_id);
        }
        return;
      }
      Alert.alert(
        t('cart.remove_item', 'Remove Item'),
        t('cart.remove_item_named', 'Remove %{name} from cart?', { name: item.name }),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('common.delete', 'Remove'), onPress: () => removeItem(item.product_id) }
        ]
      );
    } else {
      updateQuantity(item.product_id, newQuantity);
    }
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('cart.clear_all_title', 'Clear Cart')}\n\n${t('cart.clear_all_confirm', 'Are you sure you want to remove all items from your cart?')}`)) {
        clearCart();
      }
      return;
    }
    Alert.alert(
      t('cart.clear_all_title', 'Clear Cart'),
      t('cart.clear_all_confirm', 'Are you sure you want to remove all items from your cart?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('cart.clear_all', 'Clear All'), style: 'destructive', onPress: clearCart }
      ]
    );
  };

  const groupByStall = () => {
    const grouped = {};
    cart.forEach(item => {
      const stallId = item.stall_id;
      if (!grouped[stallId]) {
        grouped[stallId] = {
          stall: {
            stall_name: item.stall_name,
            stall_number: item.stall_number,
            section: item.section,
          },
          items: [],
          isClosed: closedStallIds.includes(stallId)
        };
      }
      grouped[stallId].items.push(item);
    });
    return grouped;
  };

  const groupedCart = groupByStall();

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert(t('checkout.empty_cart_title', 'Empty Cart'), t('checkout.empty_cart_body', 'Add items to your cart first'));
      return;
    }
    if (selectedItems.length === 0) {
      Alert.alert(
        t('cart.nothing_selected_title', 'Nothing Selected'),
        t('cart.nothing_selected_body', 'Check at least one item to check out — the rest will stay in your cart.')
      );
      return;
    }
    if (hasClosedStall) {
      Alert.alert(t('cart.closed_stalls_title', 'Closed Stalls'), t('cart.closed_stalls_body', 'Please remove items from closed stalls before proceeding.'));
      return;
    }
    setActiveTab(TABS.CHECKOUT);
  };

  const handleBackToCart = () => {
    setActiveTab(TABS.CART);
  };

  // Scoped to the Cart tab on purpose: a successful order placement
  // empties the cart as its own normal side effect (CheckoutContent's
  // clearCart()), while the customer is still on the Checkout tab about
  // to see the GCash payment modal. Without the tab check, this early
  // return fired the instant the cart emptied and unmounted the whole
  // checkout flow — modal included — before any payment step showed,
  // for every order (not just multi-vendor ones).
  if (cart.length === 0 && activeTab !== TABS.CHECKOUT) {
    return (
      <EmptyState
        icon="cart-outline"
        title={t('cart.empty')}
        subtitle={t('cart.empty_subtitle')}
        actionLabel={t('home.start_shopping')}
        onAction={() => navigation.navigate('Home')}
        colors={{
          icon: COLORS.text.tertiary || '#9CA3AF',
          title: COLORS.text.secondary || '#6B7280',
          subtitle: COLORS.text.tertiary || '#9CA3AF',
          background: COLORS.background || '#FFFFFF',
          iconBg: COLORS.surfaceSecondary || '#F3F4F6',
        }}
      />
    );
  }

  const renderCartContent = () => {
    return (
      <>
        {hasClosedStall && (
          <View style={styles.closedWarningBanner}>
            <View style={styles.closedWarningIconWrap}>
              <Ionicons name="warning-outline" size={18} />
            </View>
            <View style={styles.closedWarningContent}>
              <Text style={styles.closedWarningTitle}>{t('cart.closed_stalls_warning', 'Some stalls are closed')}</Text>
              <Text style={styles.closedWarningText}>
                {t('cart.closed_stalls_desc', '%{stalls} %{verb} temporarily closed.', {
                  stalls: closedStallNames.join(', '),
                  verb: closedStallNames.length === 1 ? t('cart.is', 'is') : t('cart.are', 'are'),
                })}
              </Text>
            </View>
          </View>
        )}

        {Object.entries(groupedCart).map(([stallId, data]) => (
          <View key={stallId} style={[styles.stallSection, data.isClosed && styles.closedStallSection]}>
            <View style={styles.stallHeader}>
              <View style={styles.stallHeaderLeft}>
                {!data.isClosed && (
                  <TouchableOpacity
                    onPress={() => toggleStallSelected(data.items)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isStallFullySelected(data.items) ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isStallFullySelected(data.items) ? COLORS.primary : COLORS.text.tertiary}
                    />
                  </TouchableOpacity>
                )}
                <View style={styles.stallIconWrap}>
                  <Ionicons name="storefront-outline" size={18} color={COLORS.text.secondary} />
                </View>
                <View style={styles.stallHeaderText}>
                  <Text style={styles.stallName}>{data.stall?.stall_name || t('stalls.vendor_fallback', 'Market Stall')}</Text>
                  <Text style={styles.stallMeta}>
                    {t('stalls.stall_number', 'Stall #%{number}', { number: data.stall?.stall_number })} • {data.stall?.section ? (t(`market_sections.${data.stall.section}`, data.stall.section)) : t('stalls.no_section', 'No Section')}
                  </Text>
                </View>
              </View>
              {data.isClosed && (
                <View style={styles.closedBadge}>
                  <Text style={styles.closedBadgeText}>{t('common.closed', 'Closed')}</Text>
                </View>
              )}
            </View>
            
            {data.items.map((item) => (
              <View key={item.product_id} style={styles.cartItem}>
                <View style={styles.itemMainRow}>
                  {!data.isClosed && (
                    <TouchableOpacity
                      onPress={() => toggleSelected(item.product_id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={selectedIds.has(item.product_id) ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={selectedIds.has(item.product_id) ? COLORS.primary : COLORS.text.tertiary}
                      />
                    </TouchableOpacity>
                  )}

                  <CartItemThumb name={item.name} imageUrl={item.image_url} style={styles.itemThumb} />

                  <View style={styles.itemDetails}>
                    <View style={styles.itemTopRow}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                      {!data.isClosed && (
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => removeItem(item.product_id)}
                          activeOpacity={0.6}
                        >
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={styles.itemPrice}>₱{item.price.toFixed(2)} / {item.unit}</Text>

                    <View style={styles.itemBottomRow}>
                      {!data.isClosed ? (
                        <View style={styles.quantityControls}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => updateItemQuantity(item, -1)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.quantityButtonText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.quantityText}>{item.quantity || 1}</Text>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => updateItemQuantity(item, 1)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.quantityButtonText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.closedItemBadge}>
                          <Text style={styles.closedItemLabel}>{t('common.closed', 'Closed')}</Text>
                        </View>
                      )}
                      <Text style={styles.itemTotal}>
                        ₱{((item.quantity || 1) * item.price).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}

            {/* Purely derived from items already in hand -- no new fetch
                or state, just the per-stall sum shoppers otherwise have
                to add up themselves across a page of separate line items
                (each stall pays out separately via its own GCash). */}
            <View style={styles.stallTotalRow}>
              <Text style={styles.stallTotalLabel}>{t('cart.stall_total', 'Stall Total')}</Text>
              <Text style={styles.stallTotalAmount}>
                ₱{data.items.reduce((sum, item) => sum + (item.quantity || 1) * item.price, 0).toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs + Clear All — no separate "My Cart" header bar; the shared
          "My PalengKart" header above this screen already says that. */}
      {cart.length > 0 && (
        <View style={styles.tabContainer}>
          <View style={styles.tabGroup}>
            <TouchableOpacity
              style={[styles.tab, activeTab === TABS.CART && styles.activeTab]}
              onPress={() => setActiveTab(TABS.CART)}
            >
              <Text style={[styles.tabText, activeTab === TABS.CART && styles.activeTabText]}>
                {t('cart.tab_cart', 'Cart (%{count})', { count: cart.length })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === TABS.CHECKOUT && styles.activeTab]}
              onPress={() => setActiveTab(TABS.CHECKOUT)}
            >
              <Text style={[styles.tabText, activeTab === TABS.CHECKOUT && styles.activeTabText]}>
                {t('checkout.title', 'Checkout')}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleClearCart} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.clearText}>{t('cart.clear_all', 'Clear All')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {activeTab === TABS.CART ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
          {renderCartContent()}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      ) : (
        <ScrollView style={styles.scrollView}>
          <CheckoutContent
            cart={selectedItems}
            cartTotal={selectedTotal}
            navigation={navigation}
            onBack={handleBackToCart}
          />
        </ScrollView>
      )}
      
      {/* Footer - Only show for Cart tab */}
      {activeTab === TABS.CART && (
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.footerSelectAll}
              onPress={toggleSelectAll}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isAllSelected ? 'checkbox' : 'square-outline'}
                size={22}
                color={isAllSelected ? COLORS.primary : COLORS.text.tertiary}
              />
              <View>
                <Text style={styles.footerTotalLabel}>{t('cart.total', 'Total')}</Text>
                <Text style={styles.footerTotalItems}>
                  {t('cart.selected_items_count', '%{selected} of %{total} %{unit} selected', {
                    selected: selectedItems.length,
                    total: cart.length,
                    unit: cart.length === 1 ? t('cart.item_singular', 'item') : t('cart.item_plural', 'items'),
                  })}
                </Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.footerTotalAmount}>₱{selectedTotal.toFixed(2)}</Text>
          </View>
          
          {hasClosedStall ? (
            <View style={styles.checkoutDisabledArea}>
              <View style={styles.disabledCheckoutButton}>
                <Text style={styles.disabledCheckoutText}>{t('cart.checkout_unavailable')}</Text>
              </View>
              <TouchableOpacity 
                style={styles.removeClosedButton}
                onPress={removeItemsFromClosedStalls}
              >
                <Text style={styles.removeClosedButtonText}>{t('cart.remove_closed_items')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.checkoutButton}
              onPress={handleCheckout}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.checkoutGradient}>
                <Text style={styles.checkoutButtonText}>{t('cart.proceed_checkout')} →</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text.dark,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.text.medium,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  shopButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  shopGradient: {
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 16,
  },
  shopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  // Header
  clearText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  tabGroup: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: COLORS.accentSoft,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.text.medium,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
  },
  bottomSpacer: {
    height: 80,
  },

  // Stall Section -- a flat, bordered card (design system: "surfaces
  // separate by contrast... not by shadow" -- tokens.js's own header
  // comment), not the heavier drop-shadow card this used before.
  stallSection: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
  },
  closedStallSection: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accentLight,
    opacity: 0.8,
  },
  stallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: LAYOUT.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  stallHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  stallIconWrap: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallIcon: {
    fontSize: 20,
  },
  stallHeaderText: {
    flex: 1,
  },
  stallName: {
    ...TEXT_STYLES.bodySmall,
    fontSize: 16,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  stallMeta: {
    fontSize: TYPE.size.caption,
    color: COLORS.text.tertiary,
  },
  closedBadge: {
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  closedBadgeText: {
    fontSize: TYPE.size.micro,
    fontWeight: TYPE.weight.bold,
    color: COLORS.errorDark,
  },
  // "Stall Total" -- purely a display of the sum of items already
  // rendered above it (see the reduce() at the call site); each stall
  // pays out separately via its own GCash, so a per-stall running total
  // is the natural thing to show before the page-wide footer total.
  stallTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: LAYOUT.hairlineWidth,
    borderTopColor: COLORS.borderLight,
  },
  stallTotalLabel: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.tertiary,
  },
  stallTotalAmount: {
    fontSize: TYPE.size.body,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.primary,
  },

  // Cart Items
  cartItem: {
    flexDirection: 'column',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  itemMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemThumb: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.wickerSoft,
  },
  itemDetails: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
    paddingRight: 8,
    lineHeight: 20,
  },
  itemPrice: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginBottom: 10,
  },
  // Pill-shaped capsule with flush circular buttons -- no per-button
  // shadow or rounded-rect sub-buttons "floating" in a track, which is
  // what made this read as boxier/less smooth than the rest of the app.
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.wickerSoft,
    borderRadius: RADIUS.full,
    padding: 4,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 16,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.primary,
  },
  quantityText: {
    fontSize: TYPE.size.label,
    fontWeight: TYPE.weight.black,
    color: COLORS.text.primary,
    minWidth: 30,
    textAlign: 'center',
  },
  closedItemBadge: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  closedItemLabel: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '600',
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    minWidth: 70,
    textAlign: 'right',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Footer -- this one legitimately floats above scrolling content, so
  // it keeps a lift shadow (design system: "reach for shadows only when
  // something floats"), just a softer one than the rest of this screen
  // had.
  footer: {
    backgroundColor: COLORS.surface,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: LAYOUT.hairlineWidth,
    borderTopColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  footerSelectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  footerTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  footerTotalItems: {
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  footerTotalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  checkoutButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
  },

  // Closed Stall Warning
  closedWarningBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.accentSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.accentLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  closedWarningIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  closedWarningIcon: {
    fontSize: 20,
  },
  closedWarningContent: {
    flex: 1,
  },
  closedWarningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.error,
    marginBottom: 2,
  },
  closedWarningText: {
    fontSize: 13,
    color: COLORS.text.medium,
    lineHeight: 18,
  },

  // Disabled Checkout
  checkoutDisabledArea: {
    gap: 10,
  },
  disabledCheckoutButton: {
    backgroundColor: COLORS.borderLight,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  disabledCheckoutText: {
    color: COLORS.text.lighter,
    fontSize: 16,
    fontWeight: '600',
  },
  removeClosedButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  removeClosedButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});