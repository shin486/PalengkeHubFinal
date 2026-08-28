import { useColors } from '../../contexts/ThemeContext';
// src/screens/customer/CategoryProductsScreen.js

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Alert,
  Image,
  Animated,
  StatusBar,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../contexts/AuthContext';
import { SPACING, RADIUS, LAYOUT, TYPE, TEXT_STYLES, SHADOWS } from '../../theme/tokens';
import { ProductCard } from '../../components/ProductCard';
import { Chip } from '../../components/ui/Chip';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

const { width } = Dimensions.get('window');
// D-08: 2 columns at 375px, widening on larger (web) viewports rather than
// stretching two enormous cards.
const numColumns = width >= 1024 ? 4 : width >= 768 ? 3 : 2;
const gridCardWidthPct = `${Math.floor(100 / numColumns) - 2}%`;

// ============================================================
// CATEGORY CONFIG
// ============================================================
const CATEGORY_CONFIG = {
  'Vegetables': {
    icon: 'leaf',
    description: 'Fresh vegetables from Lipa City Public Market',
    emoji: 'leaf',
  },
  'Meat': {
    icon: 'restaurant',
    description: 'Premium meat cuts from trusted vendors',
    emoji: 'restaurant',
  },
  'Rice': {
    icon: 'cafe',
    description: 'Daily rice essentials from local suppliers',
    emoji: 'restaurant-outline',
  },
  'Fruits': {
    icon: 'basket',
    description: 'Sweet and fresh fruits from the market',
    emoji: 'nutrition',
  },
  'Poultry': {
    icon: 'egg',
    description: 'Farm fresh poultry products',
    emoji: 'egg',
  },
  'Other': {
    icon: 'apps',
    description: 'More products from Lipa City Public Market',
    emoji: 'cube-outline',
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const getDiscountedPrice = (originalPrice, promotion) => {
  if (!promotion) return originalPrice;
  if (promotion.discount_type === 'percentage') {
    return originalPrice * (1 - promotion.discount_value / 100);
  } else {
    return Math.max(0, originalPrice - promotion.discount_value);
  }
};

const getStallRating = (stallId) => {
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  const rating = 3.0 + (randomValue * 2.0);
  return Math.round(rating * 10) / 10;
};

// ============================================================
// STAR RATING COMPONENT
// ============================================================
const StarRating = ({ rating, size = 12 }) => {
  const COLORS = useColors();
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[...Array(fullStars)].map((_, i) => (
        <Ionicons key={`full-${i}`} name="star" size={size} color={COLORS.gold} />
      ))}
      {hasHalfStar && (
        <Ionicons name="star-half" size={size} color={COLORS.gold} />
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Ionicons key={`empty-${i}`} name="star-outline" size={size} color="#D1D5DB" />
      ))}
    </View>
  );
};

// Local ProductCard duplicate removed (phase 5) — this screen now uses the
// shared src/components/ProductCard.js primitive from phase 2, matching
// HomeScreen.js (phase 4).

// ============================================================
// STALL GROUP CARD (for grouped view)
// ============================================================
const StallGroupCard = ({ stall, products, onProductPress, onAddToCart, onViewStall }) => {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const rating = getStallRating(stall.id);
  
  return (
    <View style={styles.stallGroupCard}>
      <TouchableOpacity 
        style={styles.stallGroupHeader}
        onPress={onViewStall}
        activeOpacity={0.7}
      >
        <View style={styles.stallGroupInfo}>
          <View style={styles.stallGroupNameContainer}>
            <Ionicons name="storefront" size={18} color={COLORS.primary} />
            <Text style={styles.stallGroupName}>{stall.stall_name}</Text>
          </View>
          <View style={styles.stallGroupMeta}>
            <StarRating rating={rating} size={10} />
            <Text style={styles.stallGroupRating}>{rating.toFixed(1)}</Text>
            <Text style={styles.stallGroupCount}>• {products.length} products</Text>
          </View>
        </View>
        <View style={styles.stallGroupArrow}>
          <Ionicons name="chevron-forward" size={18} color={COLORS.text.light} />
        </View>
      </TouchableOpacity>

      <View style={styles.stallGroupProducts}>
        {products.slice(0, 3).map((item) => {
          const hasPromotion = item.hasPromotion;
          const discountText = hasPromotion && item.promotion?.discount_type === 'percentage'
            ? `${item.promotion.discount_value}% OFF`
            : hasPromotion ? `₱${item.promotion?.discount_value} OFF` : null;

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.stallGroupProduct}
              onPress={() => onProductPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.stallGroupProductImage}>
                {item.image_url ? (
                  <Image 
                    source={{ uri: item.image_url }} 
                    style={styles.stallGroupProductImageInner}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.stallGroupProductImagePlaceholder}>
                    <Ionicons name="image-outline" size={16} color="#D1D5DB" />
                  </View>
                )}
              </View>
              <View style={styles.stallGroupProductInfo}>
                <Text style={styles.stallGroupProductName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.stallGroupProductPrice}>
                  {hasPromotion && (
                    <Text style={styles.stallGroupOriginalPrice}>₱{item.originalPrice.toFixed(2)}</Text>
                  )}
                  <Text style={styles.stallGroupProductPriceText}>₱{item.price.toFixed(2)}</Text>
                  <Text style={styles.stallGroupProductUnit}>/{item.unit}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.stallGroupAddButton}
                onPress={() => onAddToCart(item, stall)}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
        {products.length > 3 && (
          <TouchableOpacity 
            style={styles.stallGroupViewMore}
            onPress={onViewStall}
          >
            <Text style={styles.stallGroupViewMoreText}>+{products.length - 3} more products</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ============================================================
// SKELETON LOADING COMPONENT
// ============================================================
const SkeletonLoader = () => {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonBack} />
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSubtitle} />
      </View>
      <View style={styles.skeletonToolbar}>
        <View style={styles.skeletonChip} />
        <View style={styles.skeletonChip} />
      </View>
      {[1, 2, 3, 4].map((i) => (
        <Animated.View key={i} style={[styles.skeletonCard, { opacity }]} />
      ))}
    </View>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CategoryProductsScreen({ route, navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { categoryName } = route.params;
  const [products, setProducts] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [sortBy, setSortBy] = useState('recommended');
  const [selectedStall, setSelectedStall] = useState('all');
  const [showSortModal, setShowSortModal] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const [stallCount, setStallCount] = useState(0);
  
  const { user, isGuest } = useAuth();
  const { addToCart } = useCart();

  const config = CATEGORY_CONFIG[categoryName] || CATEGORY_CONFIG['Other'];
  const sortOptions = [
    { label: 'Recommended', value: 'recommended' },
    { label: 'Lowest Price', value: 'price_asc' },
    { label: 'Highest Rated Stall', value: 'rating_desc' },
    { label: 'Recently Updated', value: 'recent' },
  ];

  useEffect(() => {
    fetchProducts();
  }, [categoryName]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            id,
            stall_name,
            stall_number,
            section,
            gcash_qr_url,
            gcash_number
          )
        `)
        .eq('category', categoryName)
        .eq('is_available', true)
        .order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        const productIds = data.map(p => p.id);
        const now = new Date().toISOString();
        const { data: promotions } = await supabase
          .from('promotions')
          .select('*')
          .in('product_id', productIds)
          .eq('is_active', true)
          .lte('start_date', now)
          .gte('end_date', now);

        const promoMap = new Map();
        if (promotions) {
          promotions.forEach(promo => {
            promoMap.set(promo.product_id, promo);
          });
        }

        const productsWithPromo = data.map(product => {
          const promotion = promoMap.get(product.id);
          const discountedPrice = getDiscountedPrice(product.price, promotion);
          return {
            ...product,
            promotion,
            originalPrice: product.price,
            price: discountedPrice,
            hasPromotion: !!promotion,
          };
        });

        setProducts(productsWithPromo);
        setProductCount(productsWithPromo.length);

        const uniqueStalls = [...new Map(
          productsWithPromo
            .filter(p => p.stalls)
            .map(p => [p.stalls.id, p.stalls])
        ).values()];
        setStalls(uniqueStalls);
        setStallCount(uniqueStalls.length);
      } else {
        setProducts([]);
        setProductCount(0);
        setStalls([]);
        setStallCount(0);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product, stall) => {
    if (!user && !isGuest) {
      Alert.alert(
        'Login Required',
        'Please login to add items to cart',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => {}
          }
        ]
      );
      return;
    }
    
    if (product && stall) {
      addToCart(product, stall.id, stall, 1);
      Alert.alert(
        'Added to Cart', 
        `${product.name} added to your cart`,
        [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => navigation.navigate('Cart') }
        ]
      );
    }
  };

  const getSortedProducts = () => {
    let sorted = [...products];

    if (selectedStall !== 'all') {
      sorted = sorted.filter(p => p.stalls?.id === selectedStall);
    }

    switch (sortBy) {
      case 'price_asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'rating_desc':
        sorted.sort((a, b) => {
          const ratingA = getStallRating(a.stalls?.id || 0);
          const ratingB = getStallRating(b.stalls?.id || 0);
          return ratingB - ratingA;
        });
        break;
      case 'recent':
        sorted.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
        break;
      case 'recommended':
      default:
        sorted.sort((a, b) => {
          if (a.hasPromotion && !b.hasPromotion) return -1;
          if (!a.hasPromotion && b.hasPromotion) return 1;
          return 0;
        });
        break;
    }

    return sorted;
  };

  const getGroupedProducts = () => {
    const sorted = getSortedProducts();
    const grouped = new Map();
    
    sorted.forEach(product => {
      if (product.stalls) {
        const stallId = product.stalls.id;
        if (!grouped.has(stallId)) {
          grouped.set(stallId, {
            stall: product.stalls,
            products: [],
          });
        }
        grouped.get(stallId).products.push(product);
      }
    });

    return Array.from(grouped.values());
  };

  const renderProductItem = ({ item }) => {
    const stall = item.stalls;
    const hasPromotion = item.hasPromotion;
    const discountText = hasPromotion && item.promotion?.discount_type === 'percentage'
      ? `${item.promotion.discount_value}% OFF`
      : hasPromotion ? `₱${item.promotion?.discount_value} OFF` : null;

    return (
      <ProductCard
        product={item}
        stall={stall}
        hasPromotion={hasPromotion}
        discountText={discountText}
        style={{ width: gridCardWidthPct }}
        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
        onAddToCart={() => handleAddToCart(item, stall)}
      />
    );
  };

  const renderGroupedItem = ({ item }) => (
    <StallGroupCard
      stall={item.stall}
      products={item.products}
      onProductPress={(product) => navigation.navigate('ProductDetails', { productId: product.id })}
      onAddToCart={(product, stall) => handleAddToCart(product, stall)}
      onViewStall={() => navigation.navigate('StallDetails', { stallId: item.stall.id })}
    />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.background} />
        <SkeletonLoader />
      </View>
    );
  }

  const sortedProducts = getSortedProducts();
  const groupedProducts = getGroupedProducts();

  // Handle back navigation safely
  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.background} />

      {/* ============================================================
          HEADER
      ============================================================ */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={COLORS.text.dark} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name={config.icon} size={32} color={COLORS.primary} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{categoryName}</Text>
            <Text style={styles.headerDescription}>{config.description}</Text>
          </View>
        </View>

        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Ionicons name="cube-outline" size={14} color={COLORS.text.light} />
            <Text style={styles.headerStatText}>{productCount} Products</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Ionicons name="storefront-outline" size={14} color={COLORS.text.light} />
            <Text style={styles.headerStatText}>{stallCount} Stalls</Text>
          </View>
        </View>
      </View>

      {/* ============================================================
          TOOLBAR
      ============================================================ */}
      <View style={styles.toolbar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarContent}
        >
          <TouchableOpacity 
            style={styles.toolbarButton}
            onPress={() => setShowSortModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={16} color={COLORS.text.medium} />
            <Text style={styles.toolbarButtonText}>
              Sort: {sortOptions.find(s => s.value === sortBy)?.label || 'Recommended'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.text.light} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolbarButton, styles.viewToggle]}
            onPress={() => setViewMode(viewMode === 'list' ? 'grouped' : 'list')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} 
              size={16} 
              color={COLORS.primary} 
            />
            <Text style={styles.viewToggleText}>
              {viewMode === 'list' ? 'Group by Stall' : 'List View'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ============================================================
          STALL FILTER — horizontal chip row, "Lahat" first (D-07)
      ============================================================ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stallChipScroll}
        contentContainerStyle={styles.stallChipRow}
      >
        <Chip isOn={selectedStall === 'all'} onPress={() => setSelectedStall('all')}>
          Lahat
        </Chip>
        {stalls.map((stall) => (
          <Chip
            key={stall.id}
            isOn={selectedStall === stall.id}
            onPress={() => setSelectedStall(stall.id)}
          >
            {stall.stall_name}
          </Chip>
        ))}
      </ScrollView>

      {/* ============================================================
          PRODUCT LIST
      ============================================================ */}
      {sortedProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name={config.icon} size={72} color={COLORS.text.quaternary} style={styles.emptyEmoji} />
          <Text style={styles.emptyTitle}>Wala pang {categoryName} ngayon</Text>
          <Text style={styles.emptyText}>
            Tingnan ang ibang kategorya o bumalik mamaya.
          </Text>
          <Button variant="primary" onPress={handleBackPress}>
            Tingnan ang lahat ng stall
          </Button>
        </View>
      ) : viewMode === 'list' ? (
        <FlatList
          data={sortedProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProductItem}
          numColumns={numColumns}
          key={numColumns}
          columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={groupedProducts}
          keyExtractor={(item) => item.stall.id.toString()}
          renderItem={renderGroupedItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ============================================================
          SORT MODAL
      ============================================================ */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort By</Text>
              <TouchableOpacity onPress={() => setShowSortModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text.dark} />
              </TouchableOpacity>
            </View>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  sortBy === option.value && styles.modalOptionActive,
                ]}
                onPress={() => {
                  setSortBy(option.value);
                  setShowSortModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  sortBy === option.value && styles.modalOptionTextActive,
                ]}>
                  {option.label}
                </Text>
                {sortBy === option.value && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.surface,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backButton: {
    marginBottom: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerEmoji: {
    fontSize: 32,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text.dark,
    letterSpacing: -0.3,
  },
  headerDescription: {
    fontSize: 13,
    color: COLORS.text.light,
    marginTop: 2,
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  headerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerStatDivider: {
    width: 1,
    height: 14,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  headerStatText: {
    fontSize: 12,
    color: COLORS.text.light,
    fontWeight: '500',
  },

  toolbar: {
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.sm,
    borderBottomWidth: LAYOUT.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  toolbarContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.wickerSoft,
    borderRadius: RADIUS.sm,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
    gap: 4,
  },
  toolbarButtonText: {
    ...TEXT_STYLES.label,
    fontWeight: TYPE.weight.medium,
    color: COLORS.text.secondary,
  },
  viewToggle: {
    backgroundColor: COLORS.brandSoft,
    borderColor: COLORS.primary,
  },
  viewToggleText: {
    ...TEXT_STYLES.label,
    color: COLORS.primaryDark,
  },

  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: 30,
  },
  gridContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: 30,
  },
  gridRow: {
    justifyContent: 'space-between',
  },

  productCardWrapper: {
    marginBottom: SPACING.md,
  },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
  },
  productCardContent: {
    flexDirection: 'row',
    padding: SPACING.md,
  },
  productImageContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.inputBg,
    overflow: 'hidden',
  },
  productImage: {
    width: 80,
    height: 80,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
  },
  discountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  discountBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  productInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: 12,
    color: COLORS.text.lighter,
    textDecorationLine: 'line-through',
  },
  productUnit: {
    fontSize: 12,
    color: COLORS.text.light,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stallInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stallName: {
    fontSize: 11,
    color: COLORS.text.light,
    maxWidth: 80,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 10,
    color: COLORS.text.light,
    fontWeight: '600',
  },
  addToCartButton: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },

  stallGroupCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  stallGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.primarySurface,
  },
  stallGroupInfo: {
    flex: 1,
  },
  stallGroupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stallGroupName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  stallGroupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stallGroupRating: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.medium,
  },
  stallGroupCount: {
    fontSize: 11,
    color: COLORS.text.light,
  },
  stallGroupArrow: {
    padding: 4,
  },
  stallGroupProducts: {
    padding: SPACING.sm,
  },
  stallGroupProduct: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  stallGroupProductImage: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.inputBg,
  },
  stallGroupProductImageInner: {
    width: 40,
    height: 40,
  },
  stallGroupProductImagePlaceholder: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallGroupProductInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  stallGroupProductName: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text.dark,
  },
  stallGroupProductPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  stallGroupProductPriceText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  stallGroupOriginalPrice: {
    fontSize: 11,
    color: COLORS.text.lighter,
    textDecorationLine: 'line-through',
  },
  stallGroupProductUnit: {
    fontSize: 11,
    color: COLORS.text.light,
  },
  stallGroupAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallGroupViewMore: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  stallGroupViewMoreText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 72,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    ...TEXT_STYLES.h1,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    ...TEXT_STYLES.body,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    maxHeight: '60%',
    ...SHADOWS.overlay,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    ...TEXT_STYLES.h2,
    color: COLORS.text.primary,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    minHeight: LAYOUT.minTapTarget,
  },
  modalOptionActive: {
    backgroundColor: COLORS.brandSoft,
  },
  modalOptionText: {
    ...TEXT_STYLES.label,
    fontWeight: TYPE.weight.medium,
    color: COLORS.text.secondary,
  },
  modalOptionTextActive: {
    color: COLORS.primaryDark,
    fontWeight: TYPE.weight.bold,
  },
  modalOptionSubtext: {
    fontSize: TYPE.size.caption,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  stallChipScroll: {
    flexGrow: 0,
    height: 42 + SPACING.md * 2,
  },
  stallChipRow: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },

  skeletonContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  skeletonHeader: {
    marginBottom: SPACING.xl,
  },
  skeletonBack: {
    width: 40,
    height: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  skeletonTitle: {
    width: '60%',
    height: 28,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  skeletonSubtitle: {
    width: '80%',
    height: 16,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm,
  },
  skeletonToolbar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  skeletonChip: {
    width: 100,
    height: 32,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.sm,
  },
  skeletonCard: {
    height: 100,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
});