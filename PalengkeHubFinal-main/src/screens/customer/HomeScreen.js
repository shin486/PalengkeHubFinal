// src/screens/customer/HomeScreen.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.44;

// ============================================================
// COLORS - PalengkeHub Branding
// ============================================================
const COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  primarySurface: '#FEF2F2',
  background: '#F8F9FB',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: {
    dark: '#1F2937',
    medium: '#374151',
    light: '#6B7280',
    lighter: '#9CA3AF',
    white: '#FFFFFF',
  },
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  error: '#DC2626',
  warning: '#F59E0B',
  shadow: 'rgba(0, 0, 0, 0.04)',
  shadowDark: 'rgba(0, 0, 0, 0.08)',
};

// ============================================================
// SPACING CONSTANTS
// ============================================================
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
};

// ============================================================
// TYPEWRITER PLACEHOLDER
// ============================================================
const TypewriterPlaceholder = ({ 
  phrases = ['products', 'stalls', 'meat', 'vegetables', 'fruits', 'rice', 'chicken'],
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseDelay = 1500,
}) => {
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const currentPhrase = phrases[phraseIndex];

    if (!isDeleting) {
      if (displayText.length < currentPhrase.length) {
        timerRef.current = setTimeout(() => {
          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
        }, typingSpeed);
      } else {
        timerRef.current = setTimeout(() => {
          setIsDeleting(true);
        }, pauseDelay);
      }
    } else {
      if (displayText.length > 0) {
        timerRef.current = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, deletingSpeed);
      } else {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [displayText, isDeleting, phraseIndex]);

  return (
    <Text style={styles.searchPlaceholder}>
      Search <Text style={styles.searchPlaceholderDynamic}>{displayText}</Text>
      <Text style={styles.searchCursor}>|</Text>
    </Text>
  );
};

// ============================================================
// STAR RATING COMPONENT
// ============================================================
const StarRating = ({ rating, size = 12 }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[...Array(fullStars)].map((_, i) => (
        <Ionicons key={`full-${i}`} name="star" size={size} color="#F59E0B" />
      ))}
      {hasHalfStar && (
        <Ionicons name="star-half" size={size} color="#F59E0B" />
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Ionicons key={`empty-${i}`} name="star-outline" size={size} color="#D1D5DB" />
      ))}
    </View>
  );
};

// ============================================================
// PRODUCT CARD COMPONENT
// ============================================================
const ProductCard = ({ product, stall, onPress, onAddToCart, discountText, isPromo = false }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.productImageWrapper}>
        {product.image_url && !imageError ? (
          <Image 
            source={{ uri: product.image_url }} 
            style={styles.productImage}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="image-outline" size={40} color="#D1D5DB" />
          </View>
        )}
        {discountText && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{discountText}</Text>
          </View>
        )}
      </View>

      <View style={styles.productDetails}>
        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        
        <View style={styles.productPriceRow}>
          {isPromo ? (
            <>
              <Text style={styles.productOriginalPrice}>₱{product.original_price?.toFixed(2)}</Text>
              <Text style={styles.productPrice}>₱{product.price?.toFixed(2)}</Text>
            </>
          ) : (
            <Text style={styles.productPrice}>₱{product.price?.toFixed(2)}</Text>
          )}
          <Text style={styles.productUnit}>/{product.unit}</Text>
        </View>
        
        <Text style={styles.productVendor} numberOfLines={1}>
          {stall?.stall_name || `Stall ${stall?.stall_number}`}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.addToCartButton}
        onPress={onAddToCart}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

// ============================================================
// STALL CARD COMPONENT
// ============================================================
const StallCard = ({ stall, onPress, isClosed = false }) => {
  const [imageError, setImageError] = useState(false);
  const displayRating = stall.average_rating || 3.5 + (stall.id % 3) * 0.5;
  const ratingCount = 20 + (stall.id % 80);

  return (
    <TouchableOpacity 
      style={[styles.stallCard, isClosed && styles.stallCardClosed]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.stallCardContent}>
        <View style={styles.stallImageContainer}>
          {stall.image_url && !imageError ? (
            <Image 
              source={{ uri: stall.image_url }} 
              style={styles.stallImage}
              onError={() => setImageError(true)}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.stallImagePlaceholder}>
              <Ionicons name="storefront-outline" size={30} color="#D1D5DB" />
            </View>
          )}
          {isClosed && (
            <View style={styles.stallClosedBadge}>
              <Text style={styles.stallClosedText}>Closed</Text>
            </View>
          )}
        </View>

        <View style={styles.stallInfo}>
          <Text style={styles.stallName} numberOfLines={1}>{stall.stall_name || 'Market Stall'}</Text>
          
          <View style={styles.stallMetaRow}>
            <Text style={styles.stallNumber}>#{stall.stall_number}</Text>
            <View style={styles.stallMetaDot} />
            <Text style={styles.stallSection}>{stall.section}</Text>
          </View>

          <View style={styles.stallRatingRow}>
            <StarRating rating={displayRating} size={12} />
            <Text style={styles.stallRatingText}>{displayRating.toFixed(1)}</Text>
            <Text style={styles.stallRatingCount}>({ratingCount})</Text>
          </View>
        </View>

        <View style={styles.stallArrow}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================
// PRICE DROP ITEM COMPONENT
// ============================================================
const PriceDropItem = ({ item, onPress }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <TouchableOpacity 
      style={styles.priceDropCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.priceDropImageWrapper}>
        {item.image_url && !imageError ? (
          <Image 
            source={{ uri: item.image_url }} 
            style={styles.priceDropImage}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.priceDropImagePlaceholder}>
            <Ionicons name="trending-down-outline" size={32} color="#D1D5DB" />
          </View>
        )}
        <View style={styles.savingsBadge}>
          <Text style={styles.savingsBadgeText}>Save ₱{item.savings.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.priceDropDetails}>
        <Text style={styles.priceDropName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.priceDropPriceRow}>
          <Text style={styles.priceDropOldPrice}>₱{item.lastPrice.toFixed(2)}</Text>
          <Text style={styles.priceDropNewPrice}>₱{item.currentPrice.toFixed(2)}</Text>
        </View>
        <Text style={styles.priceDropVendor} numberOfLines={1}>
          {item.stall?.stall_name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function HomeScreen({ isGuest = false, navigation, route }) {
  const [promoProducts, setPromoProducts] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [selectedSection, setSelectedSection] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentOrderItems, setRecentOrderItems] = useState([]);
  const [priceDropItems, setPriceDropItems] = useState([]);
  
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { setIsGuest } = route?.params || {};
  const { unreadCount } = useNotifications();

  const searchPhrases = ['products', 'stalls', 'meat', 'vegetables', 'fruits', 'rice', 'chicken', 'fish'];

  const hasFetched = useRef(false);

  // ============================================================
  // FETCH FUNCTIONS
  // ============================================================
  const fetchData = useCallback(async () => {
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
          product:product_id (id, name, unit, is_available, image_url, price),
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
  }, []);

  const fetchRecentOrders = useCallback(async () => {
    if (!user) return;
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
              const { data: currentProduct, error: prodErr } = await supabase
                .from('products')
                .select('id, name, price, unit, image_url, stalls(id, stall_name, stall_number)')
                .eq('id', item.id)
                .single();
              
              if (prodErr || !currentProduct) continue;

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
                price: currentPrice,
                originalPrice: currentProduct.price,
                hasPromotion: !!promotion,
                promotion: promotion,
                stall: currentProduct.stalls,
                order_id: order.id,
                image_url: currentProduct.image_url,
              });
            }
          }
        }
      }
      setRecentOrderItems(Array.from(itemsMap.values()));
    } catch (error) {
      console.error('Error fetching recent orders:', error);
    }
  }, [user]);

  const fetchPriceDrops = useCallback(async () => {
    if (!user) return;
    try {
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
          .select('id, name, price, unit, image_url, stalls(id, stall_name, stall_number)')
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
            savings: history.price - currentPrice,
            stall: product.stalls,
            promotion: promotion,
            image_url: product.image_url,
          });
        }
      }

      setPriceDropItems(priceDropResults.slice(0, 5));
    } catch (error) {
      console.error('Error fetching price drops:', error);
    }
  }, [user]);

  // ✅ Fixed: Only fetch once using ref to prevent infinite loop
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchData();
      if (user && !isGuest) {
        fetchRecentOrders();
        fetchPriceDrops();
      }
    }
  }, [user, isGuest]);

  const handleAddToCart = (product, stall) => {
    if (!user && !isGuest) {
      Alert.alert('Login Required', 'Please login to add items to cart', [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Login', 
          onPress: () => { 
            if (setIsGuest) {
              setIsGuest(false);
              navigation.navigate('Login');
            } else {
              navigation.navigate('Login');
            }
          } 
        }
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

  const handleOrderAgain = (item) => {
    if (!user && !isGuest) {
      Alert.alert('Login Required', 'Please login to add items to cart', [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Login', 
          onPress: () => { 
            if (setIsGuest) {
              setIsGuest(false);
              navigation.navigate('Login');
            } else {
              navigation.navigate('Login');
            }
          } 
        }
      ]);
      return;
    }
    
    const product = {
      id: item.id,
      name: item.name,
      price: item.price,
      unit: item.unit,
    };
    const stall = item.stall;
    if (product && stall) {
      addToCart(product, stall.id, stall, item.quantity);
      Alert.alert('Added to Cart', `${item.quantity}x ${item.name} added to your cart`);
    }
  };

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

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} translucent={true} />
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryLight]}
          style={{ paddingTop: Platform.OS === 'ios' ? 44 : 28, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md }}
        >
          <View style={{ height: 44 }} />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCategories} />
          <View style={styles.loadingProducts} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} translucent={true} />
      
      {/* ✅ Search Header with Notification Bell */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.searchHeaderGradient}
      >
        <View style={styles.searchHeaderContent}>
          <View style={styles.searchHeaderRow}>
            <TouchableOpacity 
              style={styles.searchBar}
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={22} color="rgba(255,255,255,0.8)" />
              <TypewriterPlaceholder 
                phrases={searchPhrases}
                typingSpeed={100}
                deletingSpeed={50}
                pauseDelay={1500}
              />
              <Ionicons name="scan-outline" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            {/* ✅ Notification Bell */}
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[COLORS.primary]} 
            tintColor={COLORS.primary} 
          />
        }
      >
        {/* ============================================================
            TODAY'S DEALS
        ============================================================ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Today's Deals</Text>
              <Text style={styles.sectionSubtitle}>Don't miss out on these discounts</Text>
            </View>
            {promoProducts.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Search', { tab: 'promos' })}>
                <Text style={styles.sectionLink}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {promoProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No deals right now</Text>
              <Text style={styles.emptyStateText}>Check back later for discounts!</Text>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.horizontalList}
            >
              {promoProducts.map(promo => {
                const product = promo.product;
                const stall = promo.stall;
                const isPercentage = promo.discount_type === 'percentage';
                const discountText = isPercentage ? `${promo.discount_value}% OFF` : `₱${promo.discount_value} OFF`;
                
                return (
                  <ProductCard
                    key={promo.id}
                    product={{ ...product, price: promo.discounted_price, original_price: promo.original_price }}
                    stall={stall}
                    discountText={discountText}
                    isPromo={true}
                    onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
                    onAddToCart={() => handleAddToCart({ ...product, price: promo.discounted_price }, stall)}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ============================================================
            BUY AGAIN (Logged-in users only)
        ============================================================ */}
        {!isGuest && user && recentOrderItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Buy Again</Text>
                <Text style={styles.sectionSubtitle}>Your recent favorites</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
                <Text style={styles.sectionLink}>See All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.horizontalListWithMargin}
            >
              {recentOrderItems.map(item => (
                <ProductCard
                  key={item.id}
                  product={item}
                  stall={item.stall}
                  discountText={item.hasPromotion ? 
                    (item.promotion?.discount_type === 'percentage' 
                      ? `${item.promotion.discount_value}% OFF` 
                      : `₱${item.promotion.discount_value} OFF`) 
                    : null}
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                  onAddToCart={() => handleOrderAgain(item)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ============================================================
            PRICE DROP ALERT (Logged-in users only)
        ============================================================ */}
        {!isGuest && user && priceDropItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Price Drop Alert</Text>
                <Text style={styles.sectionSubtitle}>Items you bought are now cheaper!</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Search', { tab: 'products' })}>
                <Text style={styles.sectionLink}>See All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.horizontalList}
            >
              {priceDropItems.map(item => (
                <PriceDropItem
                  key={item.id}
                  item={item}
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ============================================================
            MARKET STALLS
        ============================================================ */}
        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Market Stalls</Text>
              <Text style={styles.sectionSubtitle}>Explore vendors at Lipa City Public Market</Text>
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filterContainer}
          >
            {sections.map((section, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.filterChip, selectedSection === section && styles.filterChipActive]} 
                onPress={() => setSelectedSection(section)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, selectedSection === section && styles.filterChipTextActive]}>
                  {section}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.stallsContainer}>
            {filteredStalls.slice(0, 6).map(stall => (
              <StallCard
                key={stall.id}
                stall={stall}
                isClosed={stall.is_temporarily_closed}
                onPress={() => {
                  if (stall.is_temporarily_closed) {
                    Alert.alert('Store Closed', 'This stall is temporarily closed. Please check back later.');
                    return;
                  }
                  navigation.navigate('StallDetails', { stallId: stall.id });
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },

  loadingContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  loadingCategories: {
    height: 100,
    backgroundColor: '#E5E7EB',
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  loadingProducts: {
    height: 200,
    backgroundColor: '#E5E7EB',
    borderRadius: RADIUS.md,
  },

  // ── Search Header ──
  searchHeaderGradient: {
    paddingTop: Platform.OS === 'ios' ? 44 : 28,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  searchHeaderContent: {},
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    includeFontPadding: false,
  },
  searchPlaceholderDynamic: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
  },
  searchCursor: {
    color: '#FFFFFF',
    fontWeight: '300',
    opacity: 0.8,
  },

  // ── Notification Bell ──
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    includeFontPadding: false,
  },

  // ── Sections ──
  section: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  lastSection: {
    paddingBottom: 80,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text.dark,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.text.light,
    marginTop: 2,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  horizontalList: {
    paddingRight: SPACING.lg,
    gap: SPACING.md,
  },
  horizontalListWithMargin: {
    paddingRight: SPACING.lg,
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },

  // ── Product Cards ──
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
    position: 'relative',
    width: CARD_WIDTH,
  },
  productImageWrapper: {
    position: 'relative',
    backgroundColor: '#FAFAFA',
    padding: SPACING.md,
    height: 100,
  },
  productImage: {
    width: '100%',
    height: 80,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FAFAFA',
  },
  productImagePlaceholder: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: RADIUS.sm,
  },
  discountBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  productDetails: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
    paddingRight: 48,
    minHeight: 80,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 4,
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  productOriginalPrice: {
    fontSize: 12,
    color: COLORS.text.lighter,
    textDecorationLine: 'line-through',
  },
  productUnit: {
    fontSize: 11,
    color: COLORS.text.light,
  },
  productVendor: {
    fontSize: 11,
    color: COLORS.text.light,
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

  // ── Price Drop Cards ──
  priceDropCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  priceDropImageWrapper: {
    position: 'relative',
    backgroundColor: '#FAFAFA',
    padding: SPACING.md,
    height: 100,
  },
  priceDropImage: {
    width: '100%',
    height: 80,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FAFAFA',
  },
  priceDropImagePlaceholder: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: RADIUS.sm,
  },
  savingsBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  savingsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  priceDropDetails: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  priceDropName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 4,
  },
  priceDropPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  priceDropOldPrice: {
    fontSize: 12,
    color: COLORS.text.lighter,
    textDecorationLine: 'line-through',
  },
  priceDropNewPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.success,
  },
  priceDropVendor: {
    fontSize: 11,
    color: COLORS.text.light,
  },

  // ── Filter Chips ──
  filterContainer: {
    paddingRight: SPACING.lg,
    gap: 8,
    marginBottom: SPACING.lg,
  },
  filterChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.medium,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // ── Stall Cards ──
  stallsContainer: {
    gap: SPACING.md,
  },
  stallCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  stallCardClosed: {
    opacity: 0.6,
  },
  stallCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  stallImageContainer: {
    position: 'relative',
  },
  stallImage: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.borderLight,
  },
  stallImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallClosedBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallClosedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stallInfo: {
    flex: 1,
  },
  stallName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.dark,
    marginBottom: 2,
  },
  stallMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stallNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  stallMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.text.lighter,
  },
  stallSection: {
    fontSize: 12,
    color: COLORS.text.light,
  },
  stallRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stallRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warning,
  },
  stallRatingCount: {
    fontSize: 11,
    color: COLORS.text.lighter,
  },
  stallArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Empty States ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.sm,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.dark,
    marginTop: SPACING.md,
  },
  emptyStateText: {
    fontSize: 13,
    color: COLORS.text.medium,
    marginTop: SPACING.xs,
  },

  // ── Bottom Spacer ──
  bottomSpacer: {
    height: 20,
  },
});