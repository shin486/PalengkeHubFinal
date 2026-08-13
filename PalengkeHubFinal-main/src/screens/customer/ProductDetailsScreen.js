import { useColors } from '../../contexts/ThemeContext';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Vibration,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';
import { useLastViewed } from '../../hooks/useLastViewed';

// Conditionally load Recharts only on web (it is a web-only library)
let RechartsLineChart, RechartsResponsiveContainer, RechartsXAxis, RechartsYAxis,
  RechartsTooltip, RechartsCartesianGrid, RechartsLine, RechartsReferenceLine;
if (Platform.OS === 'web') {
  try {
    const R = require('recharts');
    RechartsLineChart = R.LineChart;
    RechartsResponsiveContainer = R.ResponsiveContainer;
    RechartsXAxis = R.XAxis;
    RechartsYAxis = R.YAxis;
    RechartsTooltip = R.Tooltip;
    RechartsCartesianGrid = R.CartesianGrid;
    RechartsLine = R.Line;
    RechartsReferenceLine = R.ReferenceLine;
  } catch (e) {
    console.warn('Recharts not available:', e.message);
  }
}

// Unit configurations
const UNIT_CONFIG = {
  'kg':    { label: 'Per Kilo (kg)',  icon: '⚖️', suffix: 'kg',    multiplier: 1.00 },
  '500g':  { label: 'Per 500g',       icon: '📦', suffix: '500g',  multiplier: 0.50 },
  '250g':  { label: 'Per 250g',       icon: '📦', suffix: '250g',  multiplier: 0.25 },
  'piece': { label: 'Per Piece',      icon: '🔢', suffix: 'pc',    multiplier: 0.25 },
  'bundle':{ label: 'Per Bundle',     icon: '🌿', suffix: 'bundle',multiplier: 0.35 },
  'dozen': { label: 'Per Dozen (12pcs)', icon: '🥚', suffix: 'dozen', multiplier: 2.40 },
  'pack':  { label: 'Per Pack',       icon: '📦', suffix: 'pack',  multiplier: 0.80 },
};

// Helper: apply promotion discount
const getDiscountedPrice = (originalPrice, promotion) => {
  if (!promotion) return originalPrice;
  if (promotion.discount_type === 'percentage') {
    return originalPrice * (1 - promotion.discount_value / 100);
  } else {
    return Math.max(0, originalPrice - promotion.discount_value);
  }
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

// Star Rating Component
const StarRating = ({ rating, size = 12 }) => {
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

// Price History Chart Component (Recharts on web, fallback bar chart on native)
const PriceHistoryChart = ({ data, darkMode, styles }) => {
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const chartData = data.map(h => ({
    date: new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: h.price || 0,
  }));

  // Web: use Recharts (guarded against missing components)
  const hasRecharts = Platform.OS === 'web' && RechartsLineChart && RechartsResponsiveContainer;
  if (hasRecharts) {
    try {
      return (
        <View style={[styles.chartContainer, darkMode && styles.chartContainerDark]}>
          <Text style={[styles.chartTitle, darkMode && styles.chartTitleDark]}>Price Trend (Last 30 Days)</Text>
          <View style={{ width: '100%', height: 200 }}>
            <RechartsResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                <RechartsCartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#E5E7EB'} />
                <RechartsXAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: darkMode ? '#9CA3AF' : '#6B7280' }}
                  angle={-30}
                  textAnchor="end"
                  height={40}
                />
                <RechartsYAxis 
                  tick={{ fontSize: 10, fill: darkMode ? '#9CA3AF' : '#6B7280' }}
                  tickFormatter={(value) => `₱${value}`}
                  width={50}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: darkMode ? '#1a1a1a' : '#FFFFFF', border: '1px solid #E5E7EB' }}
                  labelStyle={{ fontSize: 11, color: darkMode ? '#FFFFFF' : '#111827' }}
                  itemStyle={{ fontSize: 11, color: '#DC2626' }}
                  formatter={(value) => [`₱${value.toFixed(2)}`, 'Price']}
                />
                <RechartsLine 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#DC2626" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#DC2626' }}
                  activeDot={{ r: 5, fill: '#EF4444' }}
                />
              </RechartsLineChart>
            </RechartsResponsiveContainer>
          </View>
        </View>
      );
    } catch (e) {
      console.warn('PriceHistoryChart Recharts render error:', e.message);
    }
  }

  // Native fallback: simple bar chart
  const prices = chartData.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  return (
    <View style={[styles.chartContainer, darkMode && styles.chartContainerDark]}>
      <Text style={[styles.chartTitle, darkMode && styles.chartTitleDark]}>Price Trend (Last 30 Days)</Text>
      <View style={styles.chartBars}>
        {chartData.slice(0, 8).map((point, index) => {
          const height = ((point.price - minPrice) / priceRange) * 100;
          return (
            <View key={index} style={styles.chartBarContainer}>
              <View style={[styles.chartBar, { height: Math.max(height, 5) }]} />
              <Text style={styles.chartBarLabel}>₱{point.price.toFixed(0)}</Text>
              <Text style={styles.chartBarDate}>{point.date}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.chartInfo}>
        <Text style={styles.chartInfoText}>Min: ₱{minPrice.toFixed(2)}</Text>
        <Text style={styles.chartInfoText}>Max: ₱{maxPrice.toFixed(2)}</Text>
        <Text style={styles.chartInfoText}>Avg: ₱{(prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(2)}</Text>
      </View>
    </View>
  );
};

export default function ProductDetailsScreen({ route, navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [stall, setStall] = useState(null);
  const [promotion, setPromotion] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Market analytics state
  const [marketProducts, setMarketProducts] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Related products from same stall
  const [relatedProducts, setRelatedProducts] = useState([]);

  // Add-to-cart toast animation
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useRef(new Animated.Value(-100)).current;

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: -120, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const { user, isGuest, setIsGuest } = useAuth();
  const { addToCart } = useCart();
  const { isProductFavorite, toggleProductFavorite } = useFavorites();
  const { add: addLastViewed } = useLastViewed();

  useEffect(() => {
    if (productId) {
      fetchProductDetails();
    }
  }, [productId]);

  // Track last viewed when product loads
  useEffect(() => {
    if (product && stall) {
      addLastViewed({
        id: product.id,
        name: product.name,
        image_url: product.image_url,
        price: currentPrice || product.price,
        stall_id: stall.id,
        stall_name: stall.stall_name,
        unit: product.unit,
      });
    }
  }, [product]);

  // Fetch market data once the product is loaded
  useEffect(() => {
    if (product) {
      fetchMarketData(product);
    }
  }, [product]);

  // Fetch related products from the same stall
  useEffect(() => {
    if (stall?.id) {
      fetchRelatedProducts(stall.id);
    }
  }, [stall]);

  const fetchRelatedProducts = async (stallId) => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, image_url, unit')
        .eq('stall_id', stallId)
        .neq('id', productId)
        .limit(5);
      if (data) setRelatedProducts(data);
    } catch { /* silently fail */ }
  };

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch product and stall
      const { data: productData, error } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            id,
            stall_number,
            stall_name,
            section,
            description,
            average_rating,
            total_ratings,
            image_url,
            is_temporarily_closed
          )
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;
      
      setProduct(productData);
      setStall(productData.stalls);
      
      // 2. Fetch active promotion for this product
      const now = new Date().toISOString();
      const { data: promoData } = await supabase
        .from('promotions')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .maybeSingle();
      
      setPromotion(promoData);
      
      // 3. Determine available units
      let units = [];
      if (productData.unit_options && Array.isArray(productData.unit_options) && productData.unit_options.length > 0) {
        units = productData.unit_options;
      } else {
        if (productData.category === 'Meat' || productData.category === 'Fish') {
          units = ['kg', '500g', '250g', 'piece'];
        } else if (productData.category === 'Vegetables') {
          units = ['kg', '500g', '250g', 'piece', 'bundle'];
        } else {
          units = ['kg', '500g', '250g'];
        }
      }
      
      setAvailableUnits(units);
      setSelectedUnit(units[0]);
      
      // 4. Get price for the first unit (discounted if promotion exists)
      const priceOptions = productData.price_options || {};
      let unitOriginalPrice;
      if (priceOptions[units[0]]) {
        unitOriginalPrice = priceOptions[units[0]];
      } else {
        const multiplier = UNIT_CONFIG[units[0]]?.multiplier || 1;
        unitOriginalPrice = productData.price * multiplier;
      }
      const discountedPrice = getDiscountedPrice(unitOriginalPrice, promoData);
      setCurrentPrice(discountedPrice);
      
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const getUnitOriginalPrice = (unit) => {
    const priceOptions = product?.price_options || {};
    if (priceOptions[unit]) {
      return priceOptions[unit];
    }
    const multiplier = UNIT_CONFIG[unit]?.multiplier || 1;
    return (product?.price || 0) * multiplier;
  };

  const getUnitPrice = (unit) => {
    const original = getUnitOriginalPrice(unit);
    return getDiscountedPrice(original, promotion);
  };

  const handleUnitChange = (unit) => {
    setSelectedUnit(unit);
    const newPrice = getUnitPrice(unit);
    setCurrentPrice(newPrice);
    setQuantity(1);
  };

  const getUnitDisplayText = (unit) => {
    const unitInfo = UNIT_CONFIG[unit];
    return unitInfo ? unitInfo.label : `Per ${unit}`;
  };

  const getUnitSuffix = (unit) => {
    const unitInfo = UNIT_CONFIG[unit];
    return unitInfo?.suffix || unit;
  };

  const handleAddToCart = () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to add items to cart',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => {
              if (setIsGuest) setIsGuest(false);
              else navigation.popToTop();
            }
          }
        ]
      );
      return;
    }
    
    if (product && stall) {
      const cartProduct = {
        ...product,
        price: currentPrice,
        selected_unit: selectedUnit,
        selected_unit_label: getUnitDisplayText(selectedUnit),
        selected_unit_suffix: getUnitSuffix(selectedUnit),
        original_unit: product.unit,
        original_price: product.price,
        promotion_applied: promotion ? true : false,
        original_price_before_discount: getUnitOriginalPrice(selectedUnit),
        discount_details: promotion ? {
          type: promotion.discount_type,
          value: promotion.discount_value
        } : null
      };
      
      addToCart(cartProduct, stall.id, stall, quantity);
      
      // Haptic feedback + animated toast
      Vibration.vibrate(50);
      showToast(`${product.name} added to cart`);
    }
  };

  const handleBuyNow = () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to complete purchase',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => {
              if (setIsGuest) setIsGuest(false);
              else navigation.popToTop();
            }
          }
        ]
      );
      return;
    }
    
    if (product && stall) {
      const cartProduct = {
        ...product,
        price: currentPrice,
        selected_unit: selectedUnit,
        selected_unit_label: getUnitDisplayText(selectedUnit),
        selected_unit_suffix: getUnitSuffix(selectedUnit),
        original_unit: product.unit,
        original_price: product.price,
        promotion_applied: promotion ? true : false,
      };
      
      addToCart(cartProduct, stall.id, stall, quantity);
      navigation.navigate('Cart');
    }
  };

  const handleReportProduct = () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to report an issue',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => {
              if (setIsGuest) setIsGuest(false);
            }
          }
        ]
      );
      return;
    }
    navigation.navigate('ReportIssue', {
      type: 'product',
      targetId: product.id,
      targetName: product.name,
      targetType: 'product'
    });
  };

  // ✅ Fetch market data: all vendors selling the same product + price history
  const fetchMarketData = async (productData) => {
    if (!productData) return;
    setMarketLoading(true);
    try {
      // Fetch all products with the same name (market comparison)
      const { data: marketData, error: marketError } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            id,
            stall_name,
            stall_number,
            section,
            vendor_id,
            profiles:vendor_id (full_name, email)
          )
        `)
        .eq('name', productData.name)
        .eq('is_available', true);

      if (marketError) throw marketError;
      setMarketProducts(marketData || []);

      // Fetch price history for this product
      const { data: historyData, error: historyError } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', productData.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (historyError) {
        // price_history table may not exist; generate synthetic history from product data
        const synthetic = generateSyntheticHistory(productData);
        setPriceHistory(synthetic);
      } else {
        setPriceHistory(historyData || []);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      // Fallback: generate synthetic history
      const synthetic = generateSyntheticHistory(productData);
      setPriceHistory(synthetic);
    } finally {
      setMarketLoading(false);
    }
  };

  // Generate synthetic price history when price_history table is unavailable
  const generateSyntheticHistory = (productData) => {
    const history = [];
    const currentPrice = productData.price || 0;
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const fluctuation = (Math.random() - 0.5) * 0.15;
      const price = currentPrice * (1 + fluctuation);
      history.push({
        id: `synth_${i}`,
        product_id: productData.id,
        price: parseFloat(price.toFixed(2)),
        created_at: date.toISOString(),
      });
    }
    return history;
  };

  // ✅ Compute market analytics from marketProducts
  const computeMarketAnalytics = () => {
    if (!marketProducts || marketProducts.length === 0) return null;

    const prices = marketProducts.map(p => p.price || 0).filter(p => p > 0);
    if (prices.length === 0) return null;

    const sorted = [...marketProducts].sort((a, b) => (a.price || 0) - (b.price || 0));
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const priceDiff = maxPrice - minPrice;
    const priceDiffPercent = minPrice > 0 ? ((priceDiff / minPrice) * 100) : 0;

    // Vendors pricing below market average
    const belowAverage = sorted.filter(p => (p.price || 0) < avgPrice);

    // Outdated prices: products not updated in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const outdated = sorted.filter(p => {
      const updated = new Date(p.updated_at || p.created_at || 0);
      return updated < sevenDaysAgo;
    });

    // Unusual price changes: products whose price deviates more than 20% from average
    const unusual = sorted.filter(p => {
      const price = p.price || 0;
      return price > 0 && Math.abs((price - avgPrice) / avgPrice) > 0.20;
    });

    return {
      minPrice,
      maxPrice,
      avgPrice,
      priceDiff,
      priceDiffPercent,
      totalVendors: sorted.length,
      cheapestVendor: lowest,
      mostExpensiveVendor: highest,
      belowAverage,
      outdated,
      unusual,
      sorted,
    };
  };

  const marketAnalytics = computeMarketAnalytics();

  // ✅ Get display rating (randomized if no real rating)
  const displayRating = stall ? getStallRating(stall.id, stall.average_rating) : 0;
  const ratingCount = stall ? getRandomRatingCount(stall.id) : 0;

  const totalPrice = currentPrice * quantity;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Back Button */}
      <TouchableOpacity
        style={styles.backArrow}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add-to-Cart Toast */}
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { transform: [{ translateY: toastAnim }] }]}>
          <View style={styles.toastContent}>
            <View style={styles.toastIcon}>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.toastTextWrap}>
              <Text style={styles.toastTitle}>Added to Cart</Text>
              <Text style={styles.toastSubtitle} numberOfLines={1}>{toastMessage}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Product Image */}
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image 
            source={{ uri: product.image_url }} 
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.productEmoji}>🛒</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.productInfo}>
        <View style={styles.productTitleRow}>
          <Text style={styles.productName}>{product.name}</Text>
          <TouchableOpacity onPress={() => toggleProductFavorite(product)} style={styles.favBtn}>
            <Text style={styles.favIcon}>{isProductFavorite(product.id) ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>₱{currentPrice.toFixed(2)}</Text>
          <Text style={styles.productUnit}>/ {getUnitDisplayText(selectedUnit)}</Text>
          {promotion && (
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>
                {promotion.discount_type === 'percentage' 
                  ? `${promotion.discount_value}% OFF` 
                  : `₱${promotion.discount_value} OFF`}
              </Text>
            </View>
          )}
        </View>

        {promotion && (
          <View style={styles.originalPriceRow}>
            <Text style={styles.originalPriceLabel}>Original price:</Text>
            <Text style={styles.originalPriceValue}>
              ₱{getUnitOriginalPrice(selectedUnit).toFixed(2)}
            </Text>
          </View>
        )}

        {product.description ? (
          <Text style={styles.productDescription}>{product.description}</Text>
        ) : null}

        <View style={styles.availabilityRow}>
          <Text style={styles.availabilityLabel}>Status:</Text>
          <View style={[
            styles.availabilityBadge,
            product.is_available ? styles.availableBadge : styles.unavailableBadge
          ]}>
            <Text style={[
              styles.availabilityText,
              product.is_available ? styles.availableText : styles.unavailableText
            ]}>
              {product.is_available ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>
        </View>
      </View>

      {/* Unit Selection */}
      {availableUnits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Unit</Text>
          <View style={styles.unitsContainer}>
            {availableUnits.map((unit) => {
              const originalPrice = getUnitOriginalPrice(unit);
              const discounted = getUnitPrice(unit);
              const hasDiscount = promotion && discounted < originalPrice;
              return (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.unitChip,
                    selectedUnit === unit && styles.unitChipActive
                  ]}
                  onPress={() => handleUnitChange(unit)}
                >
                  <Text style={styles.unitChipIcon}>{UNIT_CONFIG[unit]?.icon || '📦'}</Text>
                  <Text style={[
                    styles.unitChipText,
                    selectedUnit === unit && styles.unitChipTextActive
                  ]}>
                    {getUnitDisplayText(unit)}
                  </Text>
                  <View style={styles.unitPriceContainer}>
                    {hasDiscount && (
                      <Text style={styles.unitOriginalPrice}>₱{originalPrice.toFixed(2)}</Text>
                    )}
                    <Text style={[
                      styles.unitChipPrice,
                      selectedUnit === unit && styles.unitChipPriceActive,
                      hasDiscount && styles.unitDiscountedPrice
                    ]}>
                      ₱{discounted.toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Quantity Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quantity</Text>
        <View style={styles.quantityContainer}>
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          
          <Text style={styles.quantityText}>{quantity}</Text>
          
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => setQuantity(quantity + 1)}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Total Price */}
      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total Amount:</Text>
        <Text style={styles.totalPrice}>₱{totalPrice.toFixed(2)}</Text>
      </View>

      {/* Stall Info with Random Rating */}
      {stall ? (
        <TouchableOpacity 
          style={styles.stallSection}
          onPress={() => navigation.navigate('StallDetails', { stallId: stall.id })}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>Sold by</Text>
          <View style={styles.stallCard}>
            {/* ✅ Stall Header with Random Rating */}
            <View style={styles.stallHeader}>
              <Text style={styles.stallNumber}>Stall #{stall.stall_number}</Text>
              <View style={styles.ratingContainer}>
                <StarRating rating={displayRating} size={12} />
                <Text style={styles.stallRatingText}>
                  {displayRating.toFixed(1)}
                </Text>
                <Text style={styles.stallRatingCount}>({ratingCount} reviews)</Text>
              </View>
            </View>
            
            <Text style={styles.stallName}>{stall.stall_name || 'Market Stall'}</Text>
            <Text style={styles.stallSectionText}>{stall.section}</Text>
            
            {stall.description ? (
              <Text style={styles.stallDescription} numberOfLines={2}>
                {stall.description}
              </Text>
            ) : null}
            
            <Text style={styles.viewStallLink}>View Stall Details →</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Market Analytics Dashboard */}
      <View style={[styles.marketSection, darkMode && styles.marketSectionDark]}>
        <View style={styles.marketSectionHeader}>
          <View style={styles.marketSectionTitleRow}>
            <MaterialIcons name="insights" size={20} color={darkMode ? '#FFFFFF' : '#111827'} />
            <Text style={[styles.marketSectionTitle, darkMode && styles.marketSectionTitleDark]}>Market Analytics</Text>
          </View>
          <TouchableOpacity onPress={() => setDarkMode(!darkMode)} style={styles.darkModeToggle}>
            <MaterialIcons name={darkMode ? 'light-mode' : 'dark-mode'} size={18} color={darkMode ? '#FFFFFF' : '#6B7280'} />
          </TouchableOpacity>
        </View>

        {marketLoading ? (
          <View style={styles.marketLoading}>
            <ActivityIndicator size="small" color="#DC2626" />
            <Text style={[styles.marketLoadingText, darkMode && styles.marketLoadingTextDark]}>Analyzing market data...</Text>
          </View>
        ) : marketAnalytics ? (
          <>
            {/* Market Summary KPI Cards */}
            <View style={styles.marketKpiGrid}>
              <View style={[styles.marketKpiCard, darkMode && styles.marketKpiCardDark]}>
                <View style={[styles.marketKpiIcon, { backgroundColor: 'rgba(46,125,50,0.08)' }]}>
                  <MaterialIcons name="trending-down" size={18} color="#2E7D32" />
                </View>
                <Text style={[styles.marketKpiValue, darkMode && styles.marketKpiValueDark]}>₱{marketAnalytics.minPrice.toFixed(2)}</Text>
                <Text style={[styles.marketKpiLabel, darkMode && styles.marketKpiLabelDark]}>Lowest Price</Text>
              </View>
              <View style={[styles.marketKpiCard, darkMode && styles.marketKpiCardDark]}>
                <View style={[styles.marketKpiIcon, { backgroundColor: 'rgba(198,40,40,0.08)' }]}>
                  <MaterialIcons name="trending-up" size={18} color="#C62828" />
                </View>
                <Text style={[styles.marketKpiValue, darkMode && styles.marketKpiValueDark]}>₱{marketAnalytics.maxPrice.toFixed(2)}</Text>
                <Text style={[styles.marketKpiLabel, darkMode && styles.marketKpiLabelDark]}>Highest Price</Text>
              </View>
              <View style={[styles.marketKpiCard, darkMode && styles.marketKpiCardDark]}>
                <View style={[styles.marketKpiIcon, { backgroundColor: 'rgba(21,101,192,0.08)' }]}>
                  <MaterialIcons name="calculate" size={18} color="#1565C0" />
                </View>
                <Text style={[styles.marketKpiValue, darkMode && styles.marketKpiValueDark]}>₱{marketAnalytics.avgPrice.toFixed(2)}</Text>
                <Text style={[styles.marketKpiLabel, darkMode && styles.marketKpiLabelDark]}>Average Price</Text>
              </View>
              <View style={[styles.marketKpiCard, darkMode && styles.marketKpiCardDark]}>
                <View style={[styles.marketKpiIcon, { backgroundColor: 'rgba(230,81,0,0.08)' }]}>
                  <MaterialIcons name="compare-arrows" size={18} color="#E65100" />
                </View>
                <Text style={[styles.marketKpiValue, darkMode && styles.marketKpiValueDark]}>₱{marketAnalytics.priceDiff.toFixed(2)}</Text>
                <Text style={[styles.marketKpiLabel, darkMode && styles.marketKpiLabelDark]}>Price Difference</Text>
              </View>
              <View style={[styles.marketKpiCard, darkMode && styles.marketKpiCardDark]}>
                <View style={[styles.marketKpiIcon, { backgroundColor: 'rgba(16,185,129,0.08)' }]}>
                  <MaterialIcons name="storefront" size={18} color="#10B981" />
                </View>
                <Text style={[styles.marketKpiValue, darkMode && styles.marketKpiValueDark]}>{marketAnalytics.totalVendors}</Text>
                <Text style={[styles.marketKpiLabel, darkMode && styles.marketKpiLabelDark]}>Total Vendors</Text>
              </View>
            </View>

            {/* Cheapest & Most Expensive Vendor */}
            <View style={styles.marketVendorHighlight}>
              <View style={[styles.marketVendorCard, styles.marketCheapestCard, darkMode && styles.marketVendorCardDark]}>
                <View style={styles.marketVendorCardHeader}>
                  <MaterialIcons name="emoji-events" size={16} color="#2E7D32" />
                  <Text style={[styles.marketVendorCardLabel, { color: '#2E7D32' }]}>Cheapest</Text>
                </View>
                <Text style={styles.marketVendorName} numberOfLines={1}>
                  {marketAnalytics.cheapestVendor.stalls?.stall_name || 'Unknown Stall'}
                </Text>
                <Text style={[styles.marketVendorPrice, { color: '#2E7D32' }]}>
                  ₱{marketAnalytics.cheapestVendor.price?.toFixed(2)}
                </Text>
                <Text style={styles.marketVendorSub}>
                  {marketAnalytics.cheapestVendor.stalls?.section || 'N/A'} • #{marketAnalytics.cheapestVendor.stalls?.stall_number || 'N/A'}
                </Text>
              </View>
              <View style={[styles.marketVendorCard, styles.marketExpensiveCard, darkMode && styles.marketVendorCardDark]}>
                <View style={styles.marketVendorCardHeader}>
                  <MaterialIcons name="attach-money" size={16} color="#C62828" />
                  <Text style={[styles.marketVendorCardLabel, { color: '#C62828' }]}>Most Expensive</Text>
                </View>
                <Text style={styles.marketVendorName} numberOfLines={1}>
                  {marketAnalytics.mostExpensiveVendor.stalls?.stall_name || 'Unknown Stall'}
                </Text>
                <Text style={[styles.marketVendorPrice, { color: '#C62828' }]}>
                  ₱{marketAnalytics.mostExpensiveVendor.price?.toFixed(2)}
                </Text>
                <Text style={styles.marketVendorSub}>
                  {marketAnalytics.mostExpensiveVendor.stalls?.section || 'N/A'} • #{marketAnalytics.mostExpensiveVendor.stalls?.stall_number || 'N/A'}
                </Text>
              </View>
            </View>

            {/* Price History Chart */}
            {priceHistory.length > 0 && (
              <PriceHistoryChart data={priceHistory} darkMode={darkMode} styles={styles} />
            )}

            {/* You Might Also Like */}
            {relatedProducts.length > 0 && (
              <View style={[styles.marketSubSection, darkMode && styles.marketSubSectionDark]}>
                <View style={styles.marketSubSectionHeader}>
                  <MaterialIcons name="store" size={16} color={darkMode ? '#FFFFFF' : '#111827'} />
                  <Text style={[styles.marketSubSectionTitle, darkMode && styles.marketSubSectionTitleDark]}>
                    More from {stall?.stall_name || 'this stall'}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                  {relatedProducts.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.relatedCard}
                      onPress={() => navigation.push('ProductDetails', { productId: item.id })}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.relatedImage}
                        resizeMode="cover"
                      />
                      <View style={styles.relatedInfo}>
                        <Text numberOfLines={2} style={styles.relatedName}>{item.name}</Text>
                        <Text style={styles.relatedPrice}>₱{parseFloat(item.price || 0).toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Vendor Comparison Table */}
            <View style={[styles.marketSubSection, darkMode && styles.marketSubSectionDark]}>
              <View style={styles.marketSubSectionHeader}>
                <MaterialIcons name="table-chart" size={16} color={darkMode ? '#FFFFFF' : '#111827'} />
                <Text style={[styles.marketSubSectionTitle, darkMode && styles.marketSubSectionTitleDark]}>
                  Price Comparison ({marketAnalytics.totalVendors} vendors)
                </Text>
              </View>
              {marketAnalytics.sorted.map((item, index) => {
                const isCheapest = index === 0;
                const isMostExpensive = index === marketAnalytics.sorted.length - 1;
                const isCurrentUserStall = item.stalls?.id === stall?.id;
                return (
                  <View 
                    key={item.id} 
                    style={[
                      styles.marketComparisonRow,
                      darkMode && styles.marketComparisonRowDark,
                      isCheapest && styles.marketCheapestRow,
                      isMostExpensive && styles.marketExpensiveRow,
                      isCurrentUserStall && styles.marketCurrentUserRow,
                    ]}
                  >
                    <View style={styles.marketComparisonRank}>
                      <Text style={[styles.marketRankText, isCheapest && { color: '#2E7D32' }, isMostExpensive && { color: '#C62828' }]}>
                        #{index + 1}
                      </Text>
                    </View>
                    <View style={styles.marketComparisonVendor}>
                      <Text style={[styles.marketComparisonVendorName, darkMode && styles.marketComparisonVendorNameDark]} numberOfLines={1}>
                        {item.stalls?.stall_name || 'Unknown Stall'}
                      </Text>
                      <Text style={[styles.marketComparisonVendorSub, darkMode && styles.marketComparisonVendorSubDark]} numberOfLines={1}>
                        {item.stalls?.section || 'N/A'} • #{item.stalls?.stall_number || 'N/A'}
                      </Text>
                    </View>
                    <Text style={[styles.marketComparisonPrice, isCheapest && styles.marketCheapestPrice, isMostExpensive && styles.marketExpensivePrice]}>
                      ₱{(item.price || 0).toFixed(2)}
                    </Text>
                    {isCurrentUserStall && (
                      <View style={styles.marketCurrentUserBadge}>
                        <Text style={styles.marketCurrentUserBadgeText}>You</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Insights Section */}
            {(marketAnalytics.belowAverage.length > 0 || marketAnalytics.outdated.length > 0 || marketAnalytics.unusual.length > 0) && (
              <View style={[styles.marketSubSection, darkMode && styles.marketSubSectionDark]}>
                <View style={styles.marketSubSectionHeader}>
                  <MaterialIcons name="lightbulb" size={16} color={darkMode ? '#FFFFFF' : '#111827'} />
                  <Text style={[styles.marketSubSectionTitle, darkMode && styles.marketSubSectionTitleDark]}>Market Insights</Text>
                </View>

                {marketAnalytics.belowAverage.length > 0 && (
                  <View style={styles.marketInsightItem}>
                    <View style={styles.marketInsightHeader}>
                      <View style={[styles.marketInsightIcon, { backgroundColor: 'rgba(46,125,50,0.08)' }]}>
                        <MaterialIcons name="trending-down" size={14} color="#2E7D32" />
                      </View>
                      <Text style={[styles.marketInsightTitle, darkMode && styles.marketInsightTitleDark]}>
                        Below Market Average ({marketAnalytics.belowAverage.length} vendors)
                      </Text>
                    </View>
                    <Text style={[styles.marketInsightDesc, darkMode && styles.marketInsightDescDark]}>
                      These vendors offer prices below the market average of ₱{marketAnalytics.avgPrice.toFixed(2)}.
                      Consider comparing quality before choosing the cheapest option.
                    </Text>
                  </View>
                )}

                {marketAnalytics.outdated.length > 0 && (
                  <View style={styles.marketInsightItem}>
                    <View style={styles.marketInsightHeader}>
                      <View style={[styles.marketInsightIcon, { backgroundColor: 'rgba(230,81,0,0.08)' }]}>
                        <MaterialIcons name="schedule" size={14} color="#E65100" />
                      </View>
                      <Text style={[styles.marketInsightTitle, darkMode && styles.marketInsightTitleDark]}>
                        Outdated Prices ({marketAnalytics.outdated.length} vendors)
                      </Text>
                    </View>
                    <Text style={[styles.marketInsightDesc, darkMode && styles.marketInsightDescDark]}>
                      These vendors haven't updated their prices in over 7 days. Prices may be stale or inaccurate.
                    </Text>
                  </View>
                )}

                {marketAnalytics.unusual.length > 0 && (
                  <View style={styles.marketInsightItem}>
                    <View style={styles.marketInsightHeader}>
                      <View style={[styles.marketInsightIcon, { backgroundColor: 'rgba(198,40,40,0.08)' }]}>
                        <MaterialIcons name="warning" size={14} color="#C62828" />
                      </View>
                      <Text style={[styles.marketInsightTitle, darkMode && styles.marketInsightTitleDark]}>
                        Unusual Price Changes ({marketAnalytics.unusual.length} vendors)
                      </Text>
                    </View>
                    <Text style={[styles.marketInsightDesc, darkMode && styles.marketInsightDescDark]}>
                      These vendors' prices deviate more than 20% from the market average of ₱{marketAnalytics.avgPrice.toFixed(2)}.
                      Verify pricing before purchasing.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          <View style={styles.marketEmpty}>
            <MaterialIcons name="info-outline" size={32} color="#9CA3AF" />
            <Text style={[styles.marketEmptyText, darkMode && styles.marketEmptyTextDark]}>
              No market data available for this product
            </Text>
          </View>
        )}
      </View>

      {/* Report Button */}
      <View style={styles.reportSection}>

        <TouchableOpacity 
          style={styles.reportProductButton}
          onPress={handleReportProduct}
        >
          <Text style={styles.reportIcon}>🚫</Text>
          <Text style={styles.reportButtonText}>Report this Product</Text>
        </TouchableOpacity>
        <Text style={styles.reportNote}>
          Found an issue with this product? Let us know so we can investigate.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.button, styles.addToCartButton]}
          onPress={handleAddToCart}
          disabled={!product?.is_available}
        >
          <LinearGradient
            colors={['#DC2626', '#EF4444']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {product?.is_available ? `Add to Cart (₱${totalPrice.toFixed(2)})` : 'Out of Stock'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.buyNowButton]}
          onPress={handleBuyNow}
          disabled={!product?.is_available}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {product?.is_available ? 'Buy Now' : 'Unavailable'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backArrow: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  toastIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toastTextWrap: {
    flex: 1,
  },
  toastTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  toastSubtitle: {
    color: '#D1D5DB',
    fontSize: 13,
    marginTop: 2,
  },
  relatedCard: {
    width: 130,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  relatedImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#F3F4F6',
  },
  relatedInfo: {
    padding: 10,
  },
  relatedName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
    lineHeight: 16,
  },
  relatedPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C62828',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
  },
  productImage: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
  productImagePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productEmoji: {
    fontSize: 60,
  },
  productInfo: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 1,
  },
  productTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  favBtn: { padding: 6 },
  favIcon: { fontSize: 24 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 15,
  },
  productPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#DC2626',
    marginRight: 8,
  },
  productUnit: {
    fontSize: 14,
    color: '#6B7280',
  },
  productDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 15,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 10,
  },
  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableBadge: {
    backgroundColor: '#D1FAE5',
  },
  unavailableBadge: {
    backgroundColor: '#FEE2E2',
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  availableText: {
    color: '#059669',
  },
  unavailableText: {
    color: '#DC2626',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 15,
  },
  unitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  unitChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  unitChipIcon: {
    fontSize: 16,
  },
  unitChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.medium,
  },
  unitChipTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  unitChipPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 4,
  },
  unitChipPriceActive: {
    color: 'white',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  quantityButton: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  quantityButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
  },
  quantityText: {
    fontSize: 22,
    fontWeight: '800',
    marginHorizontal: 24,
    minWidth: 45,
    textAlign: 'center',
    color: COLORS.text.dark,
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.accentSoft,
    padding: 20,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentLight,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  totalPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
  },
  stallSection: {
    marginTop: 16,
  },
  stallCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  stallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  stallNumber: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
  stallName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.dark,
    marginBottom: 4,
  },
  stallSectionText: {
    fontSize: 13,
    color: COLORS.text.medium,
    marginBottom: 4,
  },
  stallDescription: {
    fontSize: 13,
    color: COLORS.text.medium,
    marginTop: 8,
    lineHeight: 20,
  },
  viewStallLink: {
    fontSize: 14,
    color: COLORS.primary,
    marginTop: 10,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stallRatingText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.warning,
  },
  stallRatingCount: {
    fontSize: 11,
    color: COLORS.text.lighter,
  },
  reportSection: {
    backgroundColor: COLORS.surface,
    padding: 20,
    marginTop: 16,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  reportProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.accentLight,
    width: '100%',
  },
  reportIcon: {
    fontSize: 18,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  reportNote: {
    fontSize: 12,
    color: COLORS.text.lighter,
    marginTop: 8,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  promoBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginLeft: 12,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  promoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'white',
  },
  originalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  originalPriceLabel: {
    fontSize: 12,
    color: COLORS.text.medium,
    marginRight: 8,
  },
  originalPriceValue: {
    fontSize: 12,
    color: COLORS.text.lighter,
    textDecorationLine: 'line-through',
  },
  unitPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  unitOriginalPrice: {
    fontSize: 10,
    color: COLORS.text.lighter,
    textDecorationLine: 'line-through',
  },
  unitDiscountedPrice: {
    color: COLORS.success,
    fontWeight: '600',
  },
  // Market Analytics Dashboard Styles
  marketSection: {
    backgroundColor: COLORS.surface,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  marketSectionDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  marketSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  marketSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marketSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  marketSectionTitleDark: {
    color: '#FFFFFF',
  },
  darkModeToggle: {
    padding: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: 8,
  },
  marketLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  marketLoadingText: {
    fontSize: 13,
    color: COLORS.text.medium,
  },
  marketLoadingTextDark: {
    color: '#9CA3AF',
  },
  marketKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  marketKpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  marketKpiCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  marketKpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  marketKpiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  marketKpiValueDark: {
    color: '#FFFFFF',
  },
  marketKpiLabel: {
    fontSize: 11,
    color: COLORS.text.lighter,
    fontWeight: '600',
  },
  marketKpiLabelDark: {
    color: '#9CA3AF',
  },
  marketVendorHighlight: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  marketVendorCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  marketVendorCardDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  marketCheapestCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32',
  },
  marketExpensiveCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#C62828',
  },
  marketVendorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  marketVendorCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  marketVendorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  marketVendorPrice: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  marketVendorSub: {
    fontSize: 11,
    color: COLORS.text.lighter,
  },
  chartContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chartContainerDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  chartTitleDark: {
    color: '#FFFFFF',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    gap: 4,
    marginBottom: 12,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  chartBar: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    minHeight: 5,
  },
  chartBarLabel: {
    fontSize: 10,
    color: COLORS.text.lighter,
    fontWeight: '600',
  },
  chartBarDate: {
    fontSize: 9,
    color: COLORS.text.lighter,
  },
  chartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  chartInfoText: {
    fontSize: 11,
    color: COLORS.text.lighter,
  },
  marketSubSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  marketSubSectionDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  marketSubSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  marketSubSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  marketSubSectionTitleDark: {
    color: '#FFFFFF',
  },
  marketComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 10,
  },
  marketComparisonRowDark: {
    borderBottomColor: '#4B5563',
  },
  marketCheapestRow: {
    backgroundColor: 'rgba(46,125,50,0.04)',
  },
  marketExpensiveRow: {
    backgroundColor: 'rgba(198,40,40,0.04)',
  },
  marketCurrentUserRow: {
    backgroundColor: 'rgba(21,101,192,0.04)',
  },
  marketComparisonRank: {
    width: 36,
    alignItems: 'center',
  },
  marketRankText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text.medium,
  },
  marketComparisonVendor: {
    flex: 1,
  },
  marketComparisonVendorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  marketComparisonVendorNameDark: {
    color: '#FFFFFF',
  },
  marketComparisonVendorSub: {
    fontSize: 11,
    color: COLORS.text.lighter,
  },
  marketComparisonVendorSubDark: {
    color: '#9CA3AF',
  },
  marketComparisonPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.medium,
    minWidth: 60,
    textAlign: 'right',
  },
  marketCheapestPrice: {
    color: '#2E7D32',
  },
  marketExpensivePrice: {
    color: '#C62828',
  },
  marketCurrentUserBadge: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  marketCurrentUserBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  marketInsightItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  marketInsightItemDark: {
    borderBottomColor: '#4B5563',
  },
  marketInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  marketInsightIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marketInsightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  marketInsightTitleDark: {
    color: '#FFFFFF',
  },
  marketInsightDesc: {
    fontSize: 12,
    color: COLORS.text.medium,
    lineHeight: 18,
  },
  marketInsightDescDark: {
    color: '#9CA3AF',
  },
  marketEmpty: {
    alignItems: 'center',
    padding: 30,
    gap: 10,
  },
  marketEmptyText: {
    fontSize: 14,
    color: COLORS.text.lighter,
    textAlign: 'center',
  },
  marketEmptyTextDark: {
    color: '#9CA3AF',
  },
});
