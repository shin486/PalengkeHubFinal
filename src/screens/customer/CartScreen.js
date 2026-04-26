import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useCart } from '../../hooks/useCart';

export default function CartScreen({ navigation }) {
  const { cart, cartTotal, updateQuantity, removeItem, clearCart, refreshCart } = useCart();
  const [refreshing, setRefreshing] = useState(false);
  const [hasClosedStall, setHasClosedStall] = useState(false);
  const [closedStallNames, setClosedStallNames] = useState([]);
  const [closedStallIds, setClosedStallIds] = useState([]);

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
    Alert.alert('Cart Updated', 'Items from closed stalls have been removed.');
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
      Alert.alert(
        'Remove Item',
        `Remove ${item.name} from cart?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', onPress: () => removeItem(item.product_id) }
        ]
      );
    } else {
      updateQuantity(item.product_id, newQuantity);
    }
  };

  if (cart.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyText}>Add items from the market to get started</Text>
        <TouchableOpacity style={styles.shopButton} onPress={() => navigation.navigate('Home')}>
          <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.shopGradient}>
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
      >
        {hasClosedStall && (
          <View style={styles.closedWarningBanner}>
            <Text style={styles.closedWarningIcon}>⚠️</Text>
            <View style={styles.closedWarningContent}>
              <Text style={styles.closedWarningTitle}>Some stalls are closed</Text>
              <Text style={styles.closedWarningText}>
                {closedStallNames.join(', ')} {closedStallNames.length === 1 ? 'is' : 'are'} temporarily closed.
              </Text>
            </View>
          </View>
        )}

        {Object.entries(groupedCart).map(([stallId, data]) => (
          <View key={stallId} style={[styles.stallSection, data.isClosed && styles.closedStallSection]}>
            <View style={styles.stallHeader}>
              <View style={styles.stallHeaderLeft}>
                <Text style={styles.stallName}>{data.stall?.stall_name || 'Market Stall'}</Text>
                {data.isClosed && (
                  <View style={styles.closedBadge}>
                    <Text style={styles.closedBadgeText}>Closed</Text>
                  </View>
                )}
              </View>
            </View>
            
            {data.items.map((item) => (
              <View key={item.product_id} style={styles.cartItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₱{item.price} / {item.unit}</Text>
                </View>
                
                <View style={styles.itemRightSection}>
                  {!data.isClosed ? (
                    <View style={styles.quantityControls}>
                      <TouchableOpacity 
                        style={styles.quantityButton}
                        onPress={() => updateItemQuantity(item, -1)}
                      >
                        <Text style={styles.quantityButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{item.quantity || 1}</Text>
                      <TouchableOpacity 
                        style={styles.quantityButton}
                        onPress={() => updateItemQuantity(item, 1)}
                      >
                        <Text style={styles.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.closedItemLabel}>Closed</Text>
                  )}
                  <Text style={styles.itemTotal}>
                    ₱{((item.quantity || 1) * item.price).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      
      {/* Footer - Single location for totals and checkout */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerTotalLabel}>Total</Text>
          <Text style={styles.footerTotalAmount}>₱{cartTotal.toFixed(2)}</Text>
        </View>
        
        {hasClosedStall ? (
          <View style={styles.checkoutDisabledArea}>
            <View style={styles.disabledCheckoutButton}>
              <Text style={styles.disabledCheckoutText}>Checkout Unavailable</Text>
            </View>
            <TouchableOpacity 
              style={styles.removeClosedButton}
              onPress={removeItemsFromClosedStalls}
            >
              <Text style={styles.removeClosedButtonText}>Remove closed stall items</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.checkoutButton}
            onPress={() => navigation.navigate('Checkout', { cart, cartTotal })}
          >
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.checkoutGradient}>
              <Text style={styles.checkoutButtonText}>Proceed to Checkout </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  shopButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  shopGradient: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  shopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  closedWarningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  closedWarningIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  closedWarningContent: {
    flex: 1,
  },
  closedWarningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 2,
  },
  closedWarningText: {
    fontSize: 12,
    color: '#6B7280',
  },
  stallSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  closedStallSection: {
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  stallHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stallHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stallName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  closedBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  closedBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'white',
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemInfo: {
    flex: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  itemPrice: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  itemRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 30,
    height: 30,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    minWidth: 25,
    textAlign: 'center',
  },
  closedItemLabel: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '500',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    minWidth: 65,
    textAlign: 'right',
  },
  footer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  footerTotalAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  checkoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkoutGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  checkoutDisabledArea: {
    gap: 10,
  },
  disabledCheckoutButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledCheckoutText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
  removeClosedButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  removeClosedButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});