import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  StatusBar,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  accent: '#F87171',
  accentLight: '#FEE2E2',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: {
    dark: '#1F2937',
    medium: '#4B5563',
    light: '#9CA3AF',
    white: '#FFFFFF',
  },
  border: '#F3F4F6',
  success: '#10B981',
  error: '#DC2626',
  warning: '#F59E0B',
};

export default function HomeScreen({ isGuest = false, navigation }) {
  const [promoProducts, setPromoProducts] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [selectedSection, setSelectedSection] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // ========== NEW: Recent Order Items & Price Drops ==========
  const [recentOrderItems, setRecentOrderItems] = useState([]);
  const [priceDropItems, setPriceDropItems] = useState([]);
  
  const { user, setIsGuest } = useAuth();
  const { addToCart } = useCart();

 const categories = [
  { id: 1, name: 'Vegetables', icon: '🥬', gradient: ['#10B981', '#34D399'] },
  { id: 2, name: 'Meat', icon: '🥩', gradient: ['#DC2626', '#EF4444'] },
  { id: 3, name: 'Rice', icon: '🍚', gradient: ['#F59E0B', '#FBBF24'] },
  { id: 4, name: 'Fruits', icon: '🍎', gradient: ['#F59E0B', '#FBBF24'] },
  { id: 5, name: 'Poultry', icon: '🐔', gradient: ['#DC2626', '#EF4444'] },
  { id: 6, name: 'Other', icon: '🛠️', gradient: ['#6B7280', '#9CA3AF'] },
];

  useEffect(() => {
    fetchData();
    if (user && !isGuest) {
      fetchRecentOrders();
      fetchPriceDrops();
    }
  }, [user, isGuest]);

  // ----- Existing fetchData (unchanged) -----
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: stallsData } = await supabase
        .from('stalls')
        .select('*')
        .eq('is_active', true)
        .order('stall_number');
      setStalls(stallsData || []);

      const now = new Date().toISOString();
      const { data: promosData } = await supabase
        .from('promotions')
        .select(`
          *,
          product:product_id (id, name, unit, is_available),
          stall:stall_id (id, stall_number, stall_name, section)
        `)
        .eq('is_active', true)
        .gte('end_date', now)
        .order('created_at', { ascending: false })
        .limit(10);

      if (promosData && promosData.length > 0) {
        const validPromos = promosData.filter(p => p.product?.is_available === true);
        setPromoProducts(validPromos);
      } else {
        setPromoProducts([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ========== NEW: Fetch recent order items (last 5 unique items from completed orders) ==========
 const fetchRecentOrders = async () => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, created_at, items, stall_id')
      .eq('consumer_id', user.id)
      .in('status', ['completed'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    if (!orders || orders.length === 0) return;

    const itemsMap = new Map();
    for (const order of orders) {
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          if (!itemsMap.has(item.id) && itemsMap.size < 5) {
            // Fetch CURRENT product details
            const { data: currentProduct, error: prodErr } = await supabase
              .from('products')
              .select('id, name, price, unit, stalls(id, stall_name, stall_number)')
              .eq('id', item.id)
              .single();
            
            if (prodErr || !currentProduct) continue;

            // Check for active promotion
            const now = new Date().toISOString();
            const { data: promotion } = await supabase
              .from('promotions')
              .select('*')
              .eq('product_id', item.id)
              .eq('is_active', true)
              .lte('start_date', now)
              .gte('end_date', now)
              .maybeSingle();

            let currentPrice = currentProduct.price;
            if (promotion) {
              if (promotion.discount_type === 'percentage') {
                currentPrice = currentProduct.price * (1 - promotion.discount_value / 100);
              } else {
                currentPrice = Math.max(0, currentProduct.price - promotion.discount_value);
              }
            }

            itemsMap.set(item.id, {
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unit: currentProduct.unit,
              price: currentPrice,  // ← CURRENT price
              originalPrice: currentProduct.price,
              hasPromotion: !!promotion,
              promotion: promotion,
              stall: currentProduct.stalls,
              order_id: order.id,
            });
          }
        }
      }
    }
    setRecentOrderItems(Array.from(itemsMap.values()));
  } catch (error) {
    console.error('Error fetching recent orders:', error);
  }
};

  // ========== NEW: Fetch price drops (products bought before where current price is lower) ==========
 const fetchPriceDrops = async () => {
  try {
    console.log('🔄 Fetching price drops...');
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, created_at, items, stall_id')
      .eq('consumer_id', user.id)
      .in('status', ['completed'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    if (!orders || orders.length === 0) return;

    const lastPaidMap = new Map();
    for (const order of orders) {
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          if (!lastPaidMap.has(item.id)) {
            lastPaidMap.set(item.id, {
              price: parseFloat(item.price),
              unit: item.unit,
              name: item.name,
              orderDate: order.created_at,
            });
          }
        }
      }
    }

    const priceDropResults = [];
    for (const [productId, history] of lastPaidMap.entries()) {
      const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('id, name, price, unit, stalls(id, stall_name, stall_number)')
        .eq('id', productId)
        .single();
      if (prodErr || !product) continue;

      const now = new Date().toISOString();
      const { data: promotion } = await supabase
        .from('promotions')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .maybeSingle();

      let currentPrice = parseFloat(product.price);
      if (promotion) {
        if (promotion.discount_type === 'percentage') {
          currentPrice = currentPrice * (1 - promotion.discount_value / 100);
        } else {
          currentPrice = Math.max(0, currentPrice - promotion.discount_value);
        }
      }

      // Normalise to price per kg for comparison
      const getPricePerKg = (price, unit) => {
        const multipliers = {
          'kg': 1, '500g': 2, '250g': 4,
          'piece': 0.2, 'bundle': 0.35, 'dozen': 2.4, 'pack': 0.8
        };
        const mult = multipliers[unit] || 1;
        return price / mult;
      };

      const lastPricePerKg = getPricePerKg(history.price, history.unit);
      const currentPricePerKg = getPricePerKg(currentPrice, product.unit);
      const difference = lastPricePerKg - currentPricePerKg;

      if (difference > 0.01) {
        priceDropResults.push({
          id: product.id,
          name: product.name,
          unit: product.unit,
          lastPrice: history.price,
          currentPrice: currentPrice,
          savings: history.price - currentPrice, // ← Number, not string
          stall: product.stalls,
          promotion: promotion,
        });
      }
    }

    setPriceDropItems(priceDropResults.slice(0, 5));
    console.log(`Price drops found: ${priceDropResults.length}`);
  } catch (error) {
    console.error('Error fetching price drops:', error);
  }
};

  // Quick Order Again handler
  const handleOrderAgain = (item) => {
  if (!user && !isGuest) {
    Alert.alert('Login Required', 'Please login to add items to cart');
    return;
  }
  
  const product = {
    id: item.id,
    name: item.name,
    price: item.price,  // ← current price (with promotion if any)
    unit: item.unit,
  };
  const stall = item.stall;
  if (product && stall) {
    addToCart(product, stall.id, stall, item.quantity);
    let priceText = item.hasPromotion ? `(promo: ₱${item.price})` : `(₱${item.price})`;
    Alert.alert('Added to Cart', `${item.quantity}x ${item.name} ${priceText} added to your cart`);
  }
};

  // Helper: apply discount for price drop item display (already discounted in currentPrice)
  // No extra action needed.

  // ========== RENDER: Recent Orders Section ==========
const renderRecentOrders = () => {
  if (recentOrderItems.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🔄 Order Again</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
          <Text style={styles.sectionLink}>View All →</Text>
        </TouchableOpacity>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.productsContainer}
        decelerationRate="fast"
      >
        {recentOrderItems.map((item) => (
          <View key={item.id} style={styles.promoCard}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
              activeOpacity={0.8}
            >
              <View style={styles.promoImageWrapper}>
                <View style={styles.productImagePlaceholder}>
                  <Text style={styles.productImageEmoji}>🛒</Text>
                </View>
                {item.hasPromotion && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      {item.promotion?.discount_type === 'percentage' 
                        ? `${item.promotion.discount_value}% OFF` 
                        : `₱${item.promotion.discount_value} OFF`}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.productDetails}>
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.productPrice}>₱{item.price.toFixed(2)}</Text>
                  <Text style={styles.productUnit}>/{item.unit}</Text>
                </View>
                {/* Quantity preserved */}
                <Text style={styles.productQuantity}>{item.quantity}x</Text>
                <View style={styles.productFooter}>
                  <Text style={styles.productVendor}>{item.stall?.stall_name || 'Market Stall'}</Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.addToCartBtn}
              onPress={() => handleOrderAgain(item)}
            >
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                style={styles.addToCartGradient}
              >
                <Text style={styles.addToCartText}>⟳</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};
  // ========== RENDER: Price Drops Section ==========
const renderPriceDrops = () => {
  if (priceDropItems.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📉 Price Dropped</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search', { tab: 'products' })}>
          <Text style={styles.sectionLink}>See All →</Text>
        </TouchableOpacity>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.productsContainer}
        decelerationRate="fast"
      >
        {priceDropItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.promoCard}
            onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
            activeOpacity={0.85}
          >
            <View style={styles.promoImageWrapper}>
              <View style={styles.productImagePlaceholder}>
                <Text style={styles.productImageEmoji}>🏷️</Text>
              </View>
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>Save ₱{item.savings.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              
              {/* Last price you paid - preserved */}
              <View style={styles.lastPaidRow}>
                <Text style={styles.lastPaidLabel}>Last you paid:</Text>
                <Text style={styles.lastPaidPrice}>₱{item.lastPrice.toFixed(2)}</Text>
              </View>
              
              {/* Current price with unit */}
              <View style={styles.priceRow}>
                <Text style={styles.discountedPrice}>₱{item.currentPrice.toFixed(2)}</Text>
                <Text style={styles.productUnit}>/{item.unit}</Text>
              </View>
              
              <View style={styles.productFooter}>
                <Text style={styles.productVendor}>{item.stall?.stall_name}</Text>
              </View>
              
              {item.promotion && (
                <View style={styles.promoMiniBadge}>
                  <Text style={styles.promoMiniText}>
                    {item.promotion.discount_type === 'percentage'
                      ? `${item.promotion.discount_value}% OFF`
                      : `₱${item.promotion.discount_value} OFF`}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

  // ----- Existing functions (onRefresh, etc.) -----
  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    if (user && !isGuest) {
      fetchRecentOrders();
      fetchPriceDrops();
    }
    setRefreshing(false);
  };

  const sections = ['All', ...new Set(stalls.map(s => s.section))];
  const filteredStalls = selectedSection === 'All' ? stalls : stalls.filter(s => s.section === selectedSection);

  const handleAddToCart = (product, stall) => {
    // same as before
    if (!user && !isGuest) {
      Alert.alert('Login Required', 'Please login to add items to cart', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => { if (setIsGuest) setIsGuest(false); } }
      ]);
      return;
    }
    if (product && stall) {
      addToCart(product, stall.id, stall, 1);
      Alert.alert('Added to Cart', `${product.name} added to your cart`, [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'View Cart', onPress: () => navigation.navigate('Cart') }
      ]);
    }
  };

  const CategoryItem = ({ category }) => (
    <TouchableOpacity 
      style={styles.categoryItem}
      onPress={() => navigation.navigate('CategoryProducts', { categoryName: category.name, categoryIcon: category.icon })}
      activeOpacity={0.7}
    >
      <LinearGradient colors={category.gradient} style={styles.categoryIconWrapper}>
        <Text style={styles.categoryIcon}>{category.icon}</Text>
      </LinearGradient>
      <Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>
  );

  const PromoCard = ({ promo }) => {
    const product = promo.product;
    const stall = promo.stall;
    const isPercentage = promo.discount_type === 'percentage';
    const discountText = isPercentage ? `${promo.discount_value}% OFF` : `₱${promo.discount_value} OFF`;
    return (
      <View style={styles.promoCard}>
        <TouchableOpacity onPress={() => navigation.navigate('ProductDetails', { productId: product.id })} activeOpacity={0.8}>
          <View style={styles.promoImageWrapper}>
            <View style={styles.productImagePlaceholder}><Text style={styles.productImageEmoji}>🏷️</Text></View>
            <View style={styles.discountBadge}><Text style={styles.discountBadgeText}>{discountText}</Text></View>
          </View>
          <View style={styles.productDetails}>
            <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.originalPrice}>₱{promo.original_price}</Text>
              <Text style={styles.discountedPrice}>₱{promo.discounted_price}</Text>
            </View>
            <Text style={styles.productUnit}>{product.unit}</Text>
            <View style={styles.productFooter}>
              <Text style={styles.productVendor}>{stall?.stall_name || `Stall ${stall?.stall_number}`}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addToCartBtn} onPress={() => handleAddToCart({ ...product, price: promo.discounted_price }, stall)}>
          <Text style={styles.addToCartText}>+</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const StallCard = ({ stall }) => (
    <TouchableOpacity style={styles.stallCard} onPress={() => navigation.navigate('StallDetails', { stallId: stall.id })} activeOpacity={0.8}>
      <View style={styles.stallCardContent}>
        <LinearGradient colors={['#FEF2F2', '#FEE2E2']} style={styles.stallAvatar}>
          <Text style={styles.stallAvatarEmoji}>🏪</Text>
        </LinearGradient>
        <View style={styles.stallInfo}>
          <Text style={styles.stallName}>{stall.stall_name || 'Market Stall'}</Text>
          <Text style={styles.stallNumber}>Stall #{stall.stall_number}</Text>
          <View style={styles.stallMeta}>
            <Text style={styles.stallSection}>{stall.section}</Text>
            {stall.average_rating > 0 && <Text style={styles.stallRating}>⭐ {stall.average_rating.toFixed(1)}</Text>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ----- MAIN RENDER -----
  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {isGuest && (
        <View style={styles.guestContainer}>
          <Text style={styles.guestIcon}>👋</Text>
          <View style={styles.guestContent}>
            <Text style={styles.guestTitle}>Guest Mode</Text>
            <Text style={styles.guestText}>Sign in for a better experience</Text>
          </View>
          <TouchableOpacity style={styles.guestSignInBtn} onPress={() => navigation.navigate('Login')}>
            <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.guestSignInGradient}>
              <Text style={styles.guestSignInText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Categories Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Browse Categories</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          {categories.map(category => <CategoryItem key={category.id} category={category} />)}
        </ScrollView>
      </View>

      {/* Today's Promos */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🎉 Today's Promos</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search', { tab: 'promos' })}>
            <Text style={styles.sectionLink}>View All →</Text>
          </TouchableOpacity>
        </View>
        {promoProducts.length === 0 ? (
          <View style={styles.emptyPromosContainer}>
            <Text style={styles.emptyPromosEmoji}>🏷️</Text>
            <Text style={styles.emptyPromosTitle}>No active promotions right now</Text>
            <Text style={styles.emptyPromosText}>Check back later for discounts and deals!</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsContainer}>
            {promoProducts.map(promo => <PromoCard key={promo.id} promo={promo} />)}
          </ScrollView>
        )}
      </View>

      {/* ========== NEW SECTIONS (only for logged-in users) ========== */}
      {!isGuest && user && (
        <>
          {renderRecentOrders()}
          {renderPriceDrops()}
        </>
      )}

      {/* Market Stalls Section (existing) */}
      <View style={[styles.section, styles.lastSection]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏪 Market Stalls</Text>
          <TouchableOpacity onPress={() => navigation.navigate('StallsDirectory')}>
            <Text style={styles.sectionLink}>View All →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
          {sections.map((section, index) => (
            <TouchableOpacity key={index} style={[styles.filterChip, selectedSection === section && styles.filterChipActive]} onPress={() => setSelectedSection(section)}>
              <Text style={[styles.filterChipText, selectedSection === section && styles.filterChipTextActive]}>{section}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.stallsContainer}>
          {filteredStalls.slice(0, 4).map(stall => <StallCard key={stall.id} stall={stall} />)}
        </View>
        {filteredStalls.length > 4 && (
          <TouchableOpacity style={styles.browseAllBtn} onPress={() => navigation.navigate('StallsDirectory')}>
            <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.browseAllGradient}>
              <Text style={styles.browseAllText}>Browse All Stalls</Text>
              <Text style={styles.browseAllArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  
  // Guest banner
  guestContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, margin: 16, padding: 14, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  guestIcon: { fontSize: 28, marginRight: 12 },
  guestContent: { flex: 1 },
  guestTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text.dark },
  guestText: { fontSize: 12, color: COLORS.text.light, marginTop: 2 },
  guestSignInBtn: { borderRadius: 20, overflow: 'hidden' },
  guestSignInGradient: { paddingHorizontal: 18, paddingVertical: 8 },
  guestSignInText: { fontSize: 12, fontWeight: '600', color: COLORS.text.white },

  // Main sections
  section: { paddingHorizontal: 16, paddingVertical: 20 },
  lastSection: { paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text.dark },
  sectionLink: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },

  // Categories
  categoriesContainer: { paddingRight: 16, gap: 16 },
  categoryItem: { alignItems: 'center', width: 70 },
  categoryIconWrapper: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  categoryIcon: { fontSize: 28 },
  categoryName: { fontSize: 12, fontWeight: '500', color: COLORS.text.medium },

  // Products / Promos
  productsContainer: { paddingRight: 16, gap: 14 },
  promoCard: { width: width * 0.42, backgroundColor: COLORS.surface, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, position: 'relative' },
  promoImageWrapper: { padding: 16, backgroundColor: '#F8F8F8', position: 'relative' },
  productImagePlaceholder: { height: 100, justifyContent: 'center', alignItems: 'center' },
  productImageEmoji: { fontSize: 44 },
  discountBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  discountBadgeText: { fontSize: 10, fontWeight: 'bold', color: COLORS.text.white },
  productDetails: { padding: 12, backgroundColor: COLORS.surface },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.text.dark, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  originalPrice: { fontSize: 12, color: COLORS.text.light, textDecorationLine: 'line-through' },
  discountedPrice: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  productUnit: { fontSize: 11, color: COLORS.text.light, marginBottom: 8 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productVendor: { fontSize: 10, color: COLORS.text.light },
 addToCartBtn: {
  position: 'absolute',
  bottom: 12,
  right: 12,
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: COLORS.primary,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
  overflow: 'hidden',
},
  addToCartText: { fontSize: 18, fontWeight: '600', color: COLORS.text.white },

  // Stalls filter
  filterContainer: { paddingRight: 16, gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 18, paddingVertical: 8, backgroundColor: COLORS.surface, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, fontWeight: '500', color: COLORS.text.medium },
  filterChipTextActive: { color: COLORS.text.white },

  // Stalls list
  stallsContainer: { gap: 12 },
  stallCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  stallCardContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stallAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  stallAvatarEmoji: { fontSize: 26 },
  stallInfo: { flex: 1 },
  stallName: { fontSize: 16, fontWeight: '600', color: COLORS.text.dark, marginBottom: 2 },
  stallNumber: { fontSize: 12, color: COLORS.primary, fontWeight: '500', marginBottom: 4 },
  stallMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stallSection: { fontSize: 11, color: COLORS.text.light, backgroundColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  stallRating: { fontSize: 11, color: COLORS.warning },

  browseAllBtn: { marginTop: 16, borderRadius: 12, overflow: 'hidden' },
  browseAllGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  browseAllText: { fontSize: 14, fontWeight: '600', color: COLORS.text.white },
  browseAllArrow: { fontSize: 16, color: COLORS.text.white },

  emptyPromosContainer: { alignItems: 'center', paddingVertical: 40, backgroundColor: COLORS.accentLight, borderRadius: 20, marginVertical: 10 },
  emptyPromosEmoji: { fontSize: 48, marginBottom: 12, opacity: 0.6 },
  emptyPromosTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text.dark, marginBottom: 4 },
  emptyPromosText: { fontSize: 13, color: COLORS.text.medium },

  // ========== Order Again & Price Drop (same style as Today's Promos) ==========
  recentItemsContainer: {
    paddingRight: 16,
    gap: 14,
  },
  recentItemCard: {
    width: width * 0.42,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  recentItemGradient: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  recentItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recentItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  recentItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  recentPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  recentItemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
  },
  recentItemUnit: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 2,
  },
  recentItemQuantity: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  recentItemStallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  recentItemStallIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  recentItemStall: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
  },
  recentOrderAgainBtn: {
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#DC2626',
  },
  recentBtnGradient: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  recentBtnText: {
    fontSize: 18,
    color: 'white',
  },

  priceDropContainer: {
    paddingRight: 16,
    gap: 14,
  },
  priceDropCard: {
    width: width * 0.42,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  priceDropGradient: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  priceDropContent: {
    flex: 1,
  },
  priceDropProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  priceDropSavingsBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  priceDropSavingsText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  priceDropPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  priceDropOldPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  priceDropNewPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginRight: 4,
  },
  priceDropUnitText: {
    fontSize: 11,
    color: '#6B7280',
  },
  priceDropStallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceDropStallIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  priceDropStallName: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
  },
  promoMiniBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  promoMiniText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#DC2626',
  },
  // Price Drop specific styles
priceDropRow: {
  flexDirection: 'row',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  marginBottom: 4,
},
savingsBadge: {
  position: 'absolute',
  top: 8,
  left: 8,
  backgroundColor: '#10B981',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
},
savingsBadgeText: {
  fontSize: 10,
  fontWeight: 'bold',
  color: 'white',
},
productQuantity: {
  fontSize: 12,
  color: '#6B7280',
  marginBottom: 4,
},
productPrice: {
  fontSize: 18,
  fontWeight: '700',
  color: '#DC2626',
},
addToCartGradient: {
  width: 32,
  height: 32,
  borderRadius: 16,
  justifyContent: 'center',
  alignItems: 'center',
},
// Price Drop specific
lastPaidRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 4,
},
lastPaidLabel: {
  fontSize: 11,
  color: '#6B7280',
  marginRight: 6,
},
lastPaidPrice: {
  fontSize: 13,
  color: '#9CA3AF',
  textDecorationLine: 'line-through',
},
savingsBadge: {
  position: 'absolute',
  top: 8,
  left: 8,
  backgroundColor: '#10B981',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
},
savingsBadgeText: {
  fontSize: 10,
  fontWeight: 'bold',
  color: 'white',
},
productQuantity: {
  fontSize: 12,
  color: '#6B7280',
  marginBottom: 4,
},
productPrice: {
  fontSize: 18,
  fontWeight: '700',
  color: '#DC2626',
},
addToCartGradient: {
  width: 32,
  height: 32,
  borderRadius: 16,
  justifyContent: 'center',
  alignItems: 'center',
},
});