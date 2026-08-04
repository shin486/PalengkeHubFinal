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
  accentSoft: '#FEF2F2',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: {
    dark: '#111827',
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
  shadow: 'rgba(0, 0, 0, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.12)',
};

// ✅ Generate consistent random rating based on stall ID
const getStallRating = (stallId, realRating) => {
  if (realRating && realRating > 0) return realRating;
  
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  const rating = 2.5 + (randomValue * 2.5);
  return Math.round(rating * 10) / 10;
};

// ✅ Generate random review count
const getRandomRatingCount = (stallId) => {
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  return Math.floor(5 + (randomValue * 195));
};

// ✅ Star Rating Component
const StarRating = ({ rating, size = 10 }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[...Array(fullStars)].map((_, i) => (
        <Text key={`full-${i}`} style={{ fontSize: size, color: '#F59E0B' }}>★</Text>
      ))}
      {hasHalfStar && (
        <Text style={{ fontSize: size, color: '#F59E0B' }}>½</Text>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Text key={`empty-${i}`} style={{ fontSize: size, color: '#D1D5DB' }}>★</Text>
      ))}
    </View>
  );
};

export default function HomeScreen({ isGuest = false, navigation }) {
  const [promoProducts, setPromoProducts] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [selectedSection, setSelectedSection] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentOrderItems, setRecentOrderItems] = useState([]);
  const [priceDropItems, setPriceDropItems] = useState([]);
  const [imageErrors, setImageErrors] = useState({});
  const [greeting, setGreeting] = useState('');
  
  const { user, setIsGuest } = useAuth();
  const { addToCart } = useCart();

  // ✅ Get time-based greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // ✅ Get market status (open/closed)
  const getMarketStatus = () => {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 5 && hour < 19; // Market hours: 5 AM - 7 PM
  };
  const isMarketOpen = getMarketStatus();

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

  const handleImageError = (itemId) => {
    setImageErrors(prev => ({ ...prev, [itemId]: true }));
  };

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
  };

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
  };

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
      console.log(`Price drops found: ${priceDropResults.length}`);
    } catch (error) {
      console.error('Error fetching price drops:', error);
    }
  };

  const handleOrderAgain = (item) => {
    if (!user && !isGuest) {
      Alert.alert('Login Required', 'Please login to add items to cart');
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
      let priceText = item.hasPromotion ? `(promo: ₱${item.price})` : `(₱${item.price})`;
      Alert.alert('Added to Cart', `${item.quantity}x ${item.name} ${priceText} added to your cart`);
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

  const handleAddToCart = (product, stall) => {
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
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={category.gradient}
        style={styles.categoryIconWrapper}
      >
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
    const hasError = imageErrors[`promo_${product.id}`];
    
    return (
      <View style={styles.promoCard}>
        <TouchableOpacity onPress={() => navigation.navigate('ProductDetails', { productId: product.id })} activeOpacity={0.8}>
          <View style={styles.promoImageWrapper}>
            {product.image_url && !hasError ? (
              <Image 
                source={{ uri: product.image_url }} 
                style={styles.productImage}
                onError={() => handleImageError(`promo_${product.id}`)}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Text style={styles.productImageEmoji}>🏷️</Text>
              </View>
            )}
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>{discountText}</Text>
            </View>
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

  const RecentOrderItem = ({ item }) => {
    const hasError = imageErrors[`recent_${item.id}`];
    return (
      <View style={styles.promoCard}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
          activeOpacity={0.8}
        >
          <View style={styles.promoImageWrapper}>
            {item.image_url && !hasError ? (
              <Image 
                source={{ uri: item.image_url }} 
                style={styles.productImage}
                onError={() => handleImageError(`recent_${item.id}`)}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Text style={styles.productImageEmoji}>🛒</Text>
              </View>
            )}
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
    );
  };

  const PriceDropItem = ({ item }) => {
    const hasError = imageErrors[`price_${item.id}`];
    return (
      <TouchableOpacity
        style={styles.promoCard}
        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
        activeOpacity={0.85}
      >
        <View style={styles.promoImageWrapper}>
          {item.image_url && !hasError ? (
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.productImage}
              onError={() => handleImageError(`price_${item.id}`)}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Text style={styles.productImageEmoji}>🏷️</Text>
            </View>
          )}
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsBadgeText}>Save ₱{item.savings.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.lastPaidRow}>
            <Text style={styles.lastPaidLabel}>Last you paid:</Text>
            <Text style={styles.lastPaidPrice}>₱{item.lastPrice.toFixed(2)}</Text>
          </View>
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
    );
  };

  // ✅ Updated StallCard with Random Rating
  const StallCard = ({ stall }) => {
    const displayRating = getStallRating(stall.id, stall.average_rating);
    const ratingCount = getRandomRatingCount(stall.id);
    const isClosed = stall.is_temporarily_closed;
    
    return (
      <TouchableOpacity 
        style={[styles.stallCard, isClosed && styles.stallCardClosed]} 
        onPress={() => {
          if (isClosed) {
            Alert.alert('Store Closed', 'This stall is temporarily closed. Please check back later.');
            return;
          }
          navigation.navigate('StallDetails', { stallId: stall.id });
        }}
        activeOpacity={0.85}
      >
        <View style={styles.stallCardContent}>
          <View style={styles.stallAvatarContainer}>
            {stall.image_url ? (
              <Image 
                source={{ uri: stall.image_url }} 
                style={styles.stallAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={isClosed ? ['#F3F4F6', '#E5E7EB'] : ['#FEF2F2', '#FEE2E2']}
                style={styles.stallAvatar}
              >
                <Text style={styles.stallAvatarEmoji}>🏪</Text>
              </LinearGradient>
            )}
            {isClosed && (
              <View style={styles.stallClosedOverlay}>
                <Text style={styles.stallClosedText}>CLOSED</Text>
              </View>
            )}
          </View>
          <View style={styles.stallInfo}>
            <View style={styles.stallNameRow}>
              <Text style={styles.stallName} numberOfLines={1}>{stall.stall_name || 'Market Stall'}</Text>
            </View>
            <View style={styles.stallMetaRow}>
              <Text style={styles.stallNumber}>Stall #{stall.stall_number}</Text>
              <Text style={styles.stallDot}>•</Text>
              <Text style={styles.stallSection}>{stall.section}</Text>
            </View>
            <View style={styles.stallRatingRow}>
              <StarRating rating={displayRating} size={12} />
              <Text style={styles.stallRatingText}>{displayRating.toFixed(1)}</Text>
              <Text style={styles.stallRatingCount}>({ratingCount})</Text>
            </View>
          </View>
          <View style={styles.stallArrow}>
            <Text style={styles.stallArrowText}>→</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* ✅ Welcome Header with Market Status */}
      <View style={styles.welcomeHeader}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeHeaderGradient}
        >
          <View style={styles.welcomeContent}>
            <View style={styles.welcomeTextWrap}>
              <Text style={styles.welcomeGreeting}>{greeting}! 👋</Text>
              <Text style={styles.welcomeName}>
                {isGuest ? 'Welcome to PalengkeHub' : (user?.email?.split('@')[0] || 'Kabayan')}
              </Text>
              {!isGuest && (
                <Text style={styles.welcomeRoleBadge}>🛍️ Customer</Text>
              )}
            </View>
            <View style={styles.marketStatusBadge}>
              <View style={[styles.marketStatusDot, { backgroundColor: isMarketOpen ? COLORS.success : COLORS.text.lighter }]} />
              <Text style={styles.marketStatusText}>
                {isMarketOpen ? 'Market Open' : 'Market Closed'}
              </Text>
            </View>
          </View>
          <Text style={styles.welcomeSubtext}>
            {isMarketOpen 
              ? '🛒 Order now, pick up at Lipa City Public Market' 
              : '⏰ Market opens at 5:00 AM tomorrow'}
          </Text>
        </LinearGradient>
      </View>

      {/* Guest Banner */}
      {isGuest && (
        <View style={styles.guestBanner}>
          <LinearGradient
            colors={[COLORS.accentSoft, '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.guestBannerGradient}
          >
            <View style={styles.guestIconWrap}>
              <Text style={styles.guestIcon}>👋</Text>
            </View>
            <View style={styles.guestContent}>
              <Text style={styles.guestTitle}>Welcome to PalengkeHub!</Text>
              <Text style={styles.guestText}>Sign in to order from Lipa City Public Market</Text>
            </View>
            <TouchableOpacity style={styles.guestSignInBtn} onPress={() => navigation.navigate('Login')}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.guestSignInGradient}>
                <Text style={styles.guestSignInText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <TouchableOpacity 
          style={styles.searchBar}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.85}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search for products, stalls...</Text>
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
          {categories.map(category => <CategoryItem key={category.id} category={category} />)}
        </ScrollView>
      </View>

      {/* Today's Promos */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🎉 Today's Deals</Text>
          {promoProducts.length > 0 && (
            <TouchableOpacity onPress={() => navigation.navigate('Search', { tab: 'promos' })}>
              <Text style={styles.sectionLink}>See All →</Text>
            </TouchableOpacity>
          )}
        </View>
        {promoProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🏷️</Text>
            <Text style={styles.emptyStateTitle}>No deals right now</Text>
            <Text style={styles.emptyStateText}>Check back later for discounts!</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsContainer}>
            {promoProducts.map(promo => <PromoCard key={promo.id} promo={promo} />)}
          </ScrollView>
        )}
      </View>

      {/* Order Again & Price Drops */}
      {!isGuest && user && (
        <>
          {recentOrderItems.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🔄 Buy Again</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
                  <Text style={styles.sectionLink}>See All →</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsContainer}>
                {recentOrderItems.map(item => <RecentOrderItem key={item.id} item={item} />)}
              </ScrollView>
            </View>
          )}
          
          {priceDropItems.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📉 Price Drop Alert</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Search', { tab: 'products' })}>
                  <Text style={styles.sectionLink}>See All →</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productsContainer}>
                {priceDropItems.map(item => <PriceDropItem key={item.id} item={item} />)}
              </ScrollView>
            </View>
          )}
        </>
      )}

      {/* Market Stalls */}
      <View style={[styles.section, styles.lastSection]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏪 Market Stalls</Text>
          <TouchableOpacity onPress={() => navigation.navigate('StallsDirectory')}>
            <Text style={styles.sectionLink}>See All →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
          {sections.map((section, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.filterChip, selectedSection === section && styles.filterChipActive]} 
              onPress={() => setSelectedSection(section)}
            >
              <Text style={[styles.filterChipText, selectedSection === section && styles.filterChipTextActive]}>{section}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.stallsContainer}>
          {filteredStalls.slice(0, 6).map(stall => <StallCard key={stall.id} stall={stall} />)}
        </View>
        {filteredStalls.length > 6 && (
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
  
  // ── Welcome Header ──
  welcomeHeader: { marginHorizontal: 16, marginTop: 16, borderRadius: 24, overflow: 'hidden', shadowColor: COLORS.shadowDark, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 6 },
  welcomeHeaderGradient: { padding: 24, borderRadius: 24 },
  welcomeContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  welcomeTextWrap: { flex: 1 },
  welcomeGreeting: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  welcomeName: { fontSize: 24, fontWeight: '800', color: COLORS.text.white, letterSpacing: -0.5 },
  welcomeRoleBadge: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: COLORS.text.white, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 6, overflow: 'hidden' },
  marketStatusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 8 },
  marketStatusDot: { width: 8, height: 8, borderRadius: 4 },
  marketStatusText: { fontSize: 12, fontWeight: '700', color: COLORS.text.white },
  welcomeSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },

  // ── Guest Banner ──
  guestBanner: { margin: 16, borderRadius: 20, overflow: 'hidden', shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4 },
  guestBannerGradient: { flexDirection: 'row', alignItems: 'center', padding: 18, borderWidth: 1, borderColor: COLORS.accentLight },
  guestIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.accentLight, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  guestIcon: { fontSize: 26 },
  guestContent: { flex: 1 },
  guestTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text.dark },
  guestText: { fontSize: 13, color: COLORS.text.light, marginTop: 3 },
  guestSignInBtn: { borderRadius: 24, overflow: 'hidden' },
  guestSignInGradient: { paddingHorizontal: 22, paddingVertical: 12 },
  guestSignInText: { fontSize: 14, fontWeight: '700', color: COLORS.text.white },

  // ── Search Bar ──
  searchBarContainer: { paddingHorizontal: 16, paddingTop: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1, borderColor: COLORS.borderLight, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  searchIcon: { fontSize: 20, marginRight: 12 },
  searchPlaceholder: { fontSize: 15, color: COLORS.text.lighter },

  // ── Sections ──
  section: { paddingHorizontal: 16, paddingVertical: 20 },
  lastSection: { paddingBottom: 60 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text.dark, letterSpacing: -0.5 },
  sectionLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },

  // ── Categories ──
  categoriesContainer: { paddingRight: 16, gap: 20 },
  categoryItem: { alignItems: 'center', width: 80 },
  categoryIconWrapper: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: COLORS.shadowDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 5 },
  categoryIcon: { fontSize: 32 },
  categoryName: { fontSize: 13, fontWeight: '600', color: COLORS.text.medium },

  // ── Product Cards ──
  productsContainer: { paddingRight: 16, gap: 16 },
  promoCard: { width: width * 0.46, backgroundColor: COLORS.surface, borderRadius: 20, overflow: 'hidden', shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 4, position: 'relative' },
  promoImageWrapper: { padding: 14, backgroundColor: '#FAFAFA', position: 'relative' },
  productImage: { width: '100%', height: 140, backgroundColor: '#FAFAFA', borderRadius: 14 },
  productImagePlaceholder: { height: 120, justifyContent: 'center', alignItems: 'center' },
  productImageEmoji: { fontSize: 52 },
  discountBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, shadowColor: COLORS.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 3 },
  discountBadgeText: { fontSize: 11, fontWeight: '800', color: COLORS.text.white },
  productDetails: { padding: 14, backgroundColor: COLORS.surface },
  productName: { fontSize: 15, fontWeight: '700', color: COLORS.text.dark, marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  originalPrice: { fontSize: 13, color: COLORS.text.lighter, textDecorationLine: 'line-through' },
  discountedPrice: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  productUnit: { fontSize: 12, color: COLORS.text.light, marginBottom: 10 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productVendor: { fontSize: 11, color: COLORS.text.light },
  addToCartBtn: { position: 'absolute', bottom: 14, right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.shadowDark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 5, overflow: 'hidden' },
  addToCartText: { fontSize: 22, fontWeight: '700', color: COLORS.text.white },
  addToCartGradient: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  productPrice: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  productQuantity: { fontSize: 13, color: COLORS.text.light, marginBottom: 4 },
  lastPaidRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  lastPaidLabel: { fontSize: 12, color: COLORS.text.light, marginRight: 6 },
  lastPaidPrice: { fontSize: 14, color: COLORS.text.lighter, textDecorationLine: 'line-through' },
  savingsBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: COLORS.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, shadowColor: COLORS.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 3 },
  savingsBadgeText: { fontSize: 11, fontWeight: '800', color: 'white' },
  promoMiniBadge: { alignSelf: 'flex-start', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  promoMiniText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },

  // ── Filter Chips ──
  filterContainer: { paddingRight: 16, gap: 10, marginBottom: 20 },
  filterChip: { paddingHorizontal: 22, paddingVertical: 12, backgroundColor: COLORS.surface, borderRadius: 28, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 1 },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  filterChipText: { fontSize: 14, fontWeight: '600', color: COLORS.text.medium },
  filterChipTextActive: { color: COLORS.text.white, fontWeight: '700' },

  // ── Stall Cards ──
  stallsContainer: { gap: 14 },
  stallCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 16, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: COLORS.borderLight },
  stallCardClosed: { opacity: 0.7 },
  stallCardContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stallAvatarContainer: { position: 'relative' },
  stallAvatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  stallAvatarImage: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.borderLight },
  stallAvatarEmoji: { fontSize: 30 },
  stallClosedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  stallClosedText: { fontSize: 9, fontWeight: '800', color: 'white' },
  stallInfo: { flex: 1 },
  stallName: { fontSize: 18, fontWeight: '700', color: COLORS.text.dark, marginBottom: 4 },
  stallMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  stallNumber: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  stallDot: { fontSize: 13, color: COLORS.text.lighter },
  stallSection: { fontSize: 13, color: COLORS.text.light },
  stallNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stallRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stallRatingText: { fontSize: 13, fontWeight: '700', color: COLORS.warning },
  stallRatingCount: { fontSize: 11, color: COLORS.text.lighter },
  stallArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.accentSoft, justifyContent: 'center', alignItems: 'center' },
  stallArrowText: { fontSize: 18, color: COLORS.primary, fontWeight: '700' },

  // ── Browse All Button ──
  browseAllBtn: { marginTop: 20, borderRadius: 16, overflow: 'hidden', shadowColor: COLORS.shadowDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  browseAllGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  browseAllText: { fontSize: 16, fontWeight: '700', color: COLORS.text.white },
  browseAllArrow: { fontSize: 18, color: COLORS.text.white },

  // ── Empty States ──
  emptyState: { alignItems: 'center', paddingVertical: 48, backgroundColor: COLORS.accentSoft, borderRadius: 20, marginVertical: 8 },
  emptyStateIcon: { fontSize: 56, marginBottom: 16, opacity: 0.4 },
  emptyStateTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.dark, marginBottom: 6 },
  emptyStateText: { fontSize: 14, color: COLORS.text.medium, textAlign: 'center' },
  
  // Legacy empty state styles (kept for compatibility)
  emptyPromosContainer: { alignItems: 'center', paddingVertical: 48, backgroundColor: COLORS.accentSoft, borderRadius: 20, marginVertical: 8 },
  emptyPromosEmoji: { fontSize: 56, marginBottom: 16, opacity: 0.4 },
  emptyPromosTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.dark, marginBottom: 6 },
  emptyPromosText: { fontSize: 14, color: COLORS.text.medium, textAlign: 'center' },
});