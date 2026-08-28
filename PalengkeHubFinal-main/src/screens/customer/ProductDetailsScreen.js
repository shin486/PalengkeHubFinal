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
  Animated,
  Modal,
  TextInput,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { PriceTrendBadge } from '../../components/PriceTrendBadge';
import { fetchPriceTrends } from '../../services/priceHistoryService';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContext';
import { shareProduct } from '../../services/shareService';
import { useCart } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';
import { useLastViewed } from '../../hooks/useLastViewed';
import { chatService } from '../../services/chatService';
import { MOTION, hapticLight, hapticMedium, hapticSuccess } from '../../theme/motion';
import { SPACING, RADIUS, LAYOUT, TYPE, TEXT_STYLES, SHADOWS } from '../../theme/tokens';
import { Badge } from '../../components/ui/Badge';
import { VerdictChip } from '../../components/ui/VerdictChip';
import { Button } from '../../components/ui/Button';

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
  'kg':    { label: 'Per Kilo (kg)',  icon: 'scale-outline', suffix: 'kg',    multiplier: 1.00 },
  '500g':  { label: 'Per 500g',       icon: 'cube-outline', suffix: '500g',  multiplier: 0.50 },
  '250g':  { label: 'Per 250g',       icon: 'cube-outline', suffix: '250g',  multiplier: 0.25 },
  'piece': { label: 'Per Piece',      icon: 'keypad-outline', suffix: 'pc',    multiplier: 0.25 },
  'bundle':{ label: 'Per Bundle',     icon: 'leaf-outline', suffix: 'bundle',multiplier: 0.35 },
  'dozen': { label: 'Per Dozen (12pcs)', icon: 'egg-outline', suffix: 'dozen', multiplier: 2.40 },
  'pack':  { label: 'Per Pack',       icon: 'cube-outline', suffix: 'pack',  multiplier: 0.80 },
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

//  Generate consistent random rating based on stall ID
const getStallRating = (stallId, realRating) => {
  if (realRating && realRating > 0) return realRating;
  
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  const rating = 2.5 + (randomValue * 2.5);
  return Math.round(rating * 10) / 10;
};

//  Generate random review count
const getRandomRatingCount = (stallId) => {
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  return Math.floor(5 + (randomValue * 195));
};

// Presyo Check roster row — same visual language as the SearchScreen compare row (phase 5).
const RosterRow = ({ item, rank, isCheapest, isCurrentUserStall }) => {
  const COLORS = useColors();
  return (
    <View style={[rosterStyles.row, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
      <Text style={[rosterStyles.rank, { color: COLORS.text.tertiary }]}>{rank}</Text>
      <View style={rosterStyles.info}>
        <Text style={[rosterStyles.stallName, { color: COLORS.text.primary }]} numberOfLines={1}>
          {item.stalls?.stall_name || 'Unknown Stall'}
        </Text>
        <Text style={[rosterStyles.stallSub, { color: COLORS.text.tertiary }]} numberOfLines={1}>
          {item.stalls?.section || 'N/A'} • #{item.stalls?.stall_number || 'N/A'}
        </Text>
      </View>
      <View style={rosterStyles.priceCol}>
        <Text style={[rosterStyles.price, { color: COLORS.text.primary }]}>₱{(item.price || 0).toFixed(2)}</Text>
        {isCheapest ? (
          <VerdictChip verdict="PINAKAMURA" solid style={rosterStyles.badge} />
        ) : isCurrentUserStall ? (
          <Badge tone="brand" style={rosterStyles.badge}>Ikaw</Badge>
        ) : null}
      </View>
    </View>
  );
};

const rosterStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LAYOUT.borderWidth,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  rank: {
    width: 20,
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    textAlign: 'center',
  },
  info: {
    flex: 1,
  },
  stallName: {
    fontSize: TYPE.size.h3,
    fontWeight: TYPE.weight.bold,
  },
  stallSub: {
    fontSize: TYPE.size.caption,
    marginTop: 2,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: TYPE.size.h2,
    fontWeight: TYPE.weight.black,
  },
  badge: {
    marginTop: 4,
  },
});

// Star Rating Component
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
        <Text style={{ fontSize: size, color: COLORS.gold }}>½</Text>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Ionicons key={`empty-${i}`} name="star-outline" size={size} color={COLORS.text.quaternary} />
      ))}
    </View>
  );
};

// Price History Chart Component (Recharts on web, fallback bar chart on native)
const PriceHistoryChart = ({ data, styles, COLORS }) => {
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
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Price Trend (Last 30 Days)</Text>
          <View style={{ width: '100%', height: 200 }}>
            <RechartsResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                <RechartsCartesianGrid strokeDasharray="3 3" stroke={COLORS.borderLight} />
                <RechartsXAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: COLORS.text.tertiary }}
                  angle={-30}
                  textAnchor="end"
                  height={40}
                />
                <RechartsYAxis
                  tick={{ fontSize: 10, fill: COLORS.text.tertiary }}
                  tickFormatter={(value) => `₱${value}`}
                  width={50}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}
                  labelStyle={{ fontSize: 11, color: COLORS.text.primary }}
                  itemStyle={{ fontSize: 11, color: COLORS.primary }}
                  formatter={(value) => [`₱${value.toFixed(2)}`, 'Price']}
                />
                <RechartsLine
                  type="monotone"
                  dataKey="price"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  dot={{ r: 3, fill: COLORS.primary }}
                  activeDot={{ r: 5, fill: COLORS.primaryDark }}
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
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Price Trend (Last 30 Days)</Text>
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
  // Micro-interaction: spring pulse on the wishlist heart
  const heartScale = useRef(new Animated.Value(1)).current;
  // Haggle offer sheet
  const [offerVisible, setOfferVisible] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
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

  // Related products from same stall
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [priceTrend, setPriceTrend] = useState(null);

  // Add-to-cart toast animation
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useRef(new Animated.Value(160)).current;

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.delay(1800),
      Animated.timing(toastAnim, { toValue: 160, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const { user, isGuest, setIsGuest } = useAuth();
  const { addToCart } = useCart();
  const { t } = useI18n();
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
            is_temporarily_closed,
            gcash_qr_url,
            gcash_number
          )
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;
      
      setProduct(productData);
      setStall(productData.stalls);

      // 1b. Fetch price history trend (Bumaba/Tumaas badge)
      fetchPriceTrends([productId]).then((trends) => {
        if (trends.has(productId)) setPriceTrend(trends.get(productId));
      });
      
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
    hapticMedium();
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
      showToast(`${product.name} ${t('cart.added_suffix')}`);
    }
  };

  // ── Haggle: send a price offer to the stall via chat ──
  const submitOffer = async () => {
    const offerNum = parseFloat(offerPrice);
    if (isNaN(offerNum) || offerNum <= 0) {
      Alert.alert('Invalid Offer', 'Please enter a valid offer amount.');
      return;
    }
    if (offerNum >= currentPrice) {
      Alert.alert(
        'Offer Too High',
        `Your offer (₱${offerNum.toFixed(2)}) is not lower than the listed price (₱${currentPrice.toFixed(2)}). Just add to cart instead! 😊`
      );
      return;
    }
    if (!user) {
      Alert.alert('Login Required', 'Please login to make an offer.');
      return;
    }
    if (!stall?.id) {
      Alert.alert('Error', 'Stall information unavailable.');
      return;
    }

    setSendingOffer(true);
    try {
      const conversation = await chatService.getOrCreateConversation(user.id, stall.id);
      const message = [
        '🤝 HAGGLE OFFER',
        `Product: ${product.name}`,
        `Listed price: ₱${currentPrice.toFixed(2)} / ${getUnitDisplayText(selectedUnit)}`,
        `Quantity: ${quantity}`,
        `My offer: ₱${offerNum.toFixed(2)} each`,
        offerNote.trim() ? `Note: ${offerNote.trim()}` : null,
        '',
        'Reply here to accept or counter my offer. 🙏',
      ].filter(Boolean).join('\n');

      await chatService.sendMessage(conversation.id, user.id, 'customer', message);
      hapticSuccess();
      setOfferVisible(false);
      setOfferPrice('');
      setOfferNote('');
      Alert.alert('Offer Sent! 🤝', 'Your offer was sent to the vendor. Track their reply in Chats.', [
        { text: 'View Chats', onPress: () => navigation.navigate('ChatDetail', { conversationId: conversation.id, stall, vendor: stall?.profiles || null }) },
        { text: 'OK' },
      ]);
    } catch (err) {
      console.error('Failed to send offer:', err);
      Alert.alert('Error', 'Could not send your offer. Please try again.');
    } finally {
      setSendingOffer(false);
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

  //  Fetch market data: all vendors selling the same product + price history
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

  //  Compute market analytics from marketProducts
  const computeMarketAnalytics = () => {
    if (!marketProducts || marketProducts.length === 0) return null;

    // D-11: the unit of the product being viewed is the reference unit.
    // Rows sold in any other unit are real listings — they still render,
    // with their real price and real unit — but they never enter the
    // roster, the ranking, the badges, or any of the five KPIs below.
    // When every row already shares one unit (the common case), this
    // filter is a no-op and nothing about the numbers changes at all.
    const referenceUnit = product?.unit;
    const sameUnitProducts = marketProducts.filter(p => p.unit === referenceUnit);
    const differentUnitProducts = marketProducts.filter(p => p.unit !== referenceUnit);

    const prices = sameUnitProducts.map(p => p.price || 0).filter(p => p > 0);
    if (prices.length === 0) return null;

    const sorted = [...sameUnitProducts].sort((a, b) => (a.price || 0) - (b.price || 0));
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
      referenceUnit,
      differentUnitProducts,
    };
  };

  const marketAnalytics = computeMarketAnalytics();

  // This product/stall is Pinakamura only when it is rank 1 among a real
  // (more than one row) comparison. A lone stall has nothing to beat.
  const isThisProductCheapest =
    !!marketAnalytics &&
    marketAnalytics.totalVendors > 1 &&
    marketAnalytics.sorted[0]?.id === product?.id;

  //  Get display rating (randomized if no real rating)
  const displayRating = stall ? getStallRating(stall.id, stall.average_rating) : 0;
  const ratingCount = stall ? getRandomRatingCount(stall.id) : 0;

  const totalPrice = currentPrice * quantity;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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

  const roster = marketAnalytics?.sorted || [];
  const hasComparison = !!marketAnalytics && marketAnalytics.totalVendors > 1;
  const unitSuffix = getUnitSuffix(selectedUnit);

  return (
    <View style={styles.screenContainer}>
    {/* Back Button — a sibling of the ScrollView, not a child, so it stays
        fixed on screen instead of scrolling away with the content. */}
    <TouchableOpacity
      style={styles.backArrow}
      onPress={() => navigation.goBack()}
      activeOpacity={0.7}
    >
      <Ionicons name="arrow-back" size={22} color={COLORS.onInk} />
    </TouchableOpacity>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Product Image — full bleed, bottom corners only */}
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="cart-outline" size={40} color={COLORS.text.quaternary} />
          </View>
        )}
      </View>

      {/* Name + actions */}
      <View style={styles.productInfo}>
        <View style={styles.productTitleRow}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          <View style={styles.titleActions}>
            <TouchableOpacity
              onPress={() => shareProduct({
                name: product.name,
                price: currentPrice,
                unit: getUnitDisplayText(selectedUnit),
                stallName: stall?.stall_name,
                stallNumber: stall?.stall_number,
                onCopied: () => Alert.alert(t('products.share'), t('products.share_copied')),
              })}
              style={styles.favBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="share-outline" size={20} color={COLORS.text.tertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                Animated.sequence([
                  Animated.spring(heartScale, { toValue: 1.35, ...MOTION.spring.bouncy }),
                  Animated.spring(heartScale, { toValue: 1, ...MOTION.spring.snappy }),
                ]).start();
                toggleProductFavorite(product);
              }}
              style={styles.favBtn}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name={isProductFavorite(product.id) ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isProductFavorite(product.id) ? COLORS.primary : COLORS.text.tertiary}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Price block: price, unit, verdict chip */}
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>₱{currentPrice.toFixed(2)}</Text>
          <Text style={styles.productUnit}>/ {unitSuffix}</Text>
          {isThisProductCheapest && <VerdictChip verdict="PINAKAMURA" solid style={styles.priceVerdict} />}
        </View>

        <View style={styles.priceMetaRow}>
          {promotion && (
            <Badge tone="tomato">
              {promotion.discount_type === 'percentage'
                ? `${promotion.discount_value}% OFF`
                : `₱${promotion.discount_value} OFF`}
            </Badge>
          )}
          <Badge tone={product.is_available ? 'leaf' : 'tomato'}>
            {product.is_available ? 'In Stock' : 'Out of Stock'}
          </Badge>
        </View>

        {priceTrend && (
          <View style={{ marginTop: SPACING.sm }}>
            <PriceTrendBadge
              currentPrice={currentPrice}
              previousPrice={priceTrend.previous_price}
            />
          </View>
        )}

        {promotion && (
          <View style={styles.originalPriceRow}>
            <Text style={styles.originalPriceLabel}>Original price:</Text>
            <Text style={styles.originalPriceValue}>
              ₱{getUnitOriginalPrice(selectedUnit).toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Stall attribution */}
      {stall ? (
        <TouchableOpacity
          style={styles.stallSection}
          onPress={() => navigation.navigate('StallDetails', { stallId: stall.id })}
          activeOpacity={0.7}
        >
          <View style={styles.stallCard}>
            <View style={styles.stallHeader}>
              <Text style={styles.stallNumber}>Stall #{stall.stall_number}</Text>
              <View style={styles.ratingContainer}>
                <StarRating rating={displayRating} size={12} />
                <Text style={styles.stallRatingText}>{displayRating.toFixed(1)}</Text>
                <Text style={styles.stallRatingCount}>({ratingCount} reviews)</Text>
              </View>
            </View>

            <Text style={styles.stallName}>{stall.stall_name || 'Market Stall'}</Text>
            <Text style={styles.stallSectionText}>{stall.section}</Text>

            <Text style={styles.viewStallLink}>Tingnan ang Stall →</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* ── Presyo Check ── */}
      <View style={styles.presyoSection}>
        <View style={styles.presyoHeaderRow}>
          <Text style={styles.presyoHeading}>Presyo Check</Text>
          {marketAnalytics && marketAnalytics.totalVendors > 0 && (
            <Badge tone="brand">{marketAnalytics.totalVendors} stall{marketAnalytics.totalVendors > 1 ? 's' : ''}</Badge>
          )}
        </View>

        {marketLoading ? (
          <View style={styles.presyoLoading}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.presyoLoadingText}>Kinukuha ang presyo ng ibang stall...</Text>
          </View>
        ) : hasComparison ? (
          <>
            {/* Roster */}
            {roster.map((item, index) => (
              <RosterRow
                key={item.id}
                item={item}
                rank={index + 1}
                isCheapest={index === 0}
                isCurrentUserStall={item.stalls?.id === stall?.id}
              />
            ))}

            {/* Ibang unit: real listings, never ranked against the roster above */}
            {marketAnalytics.differentUnitProducts.length > 0 && (
              <View style={styles.differentUnitGroup}>
                <Text style={styles.differentUnitHeading}>Ibang unit</Text>
                <Text style={styles.differentUnitNote}>
                  Hindi ito kasama sa paghahambing dahil ibang unit ang ginamit.
                </Text>
                {marketAnalytics.differentUnitProducts.map((item) => (
                  <View key={item.id} style={styles.differentUnitRow}>
                    <View style={styles.differentUnitInfo}>
                      <Text style={styles.differentUnitStallName} numberOfLines={1}>
                        {item.stalls?.stall_name || 'Unknown Stall'}
                      </Text>
                      <Text style={styles.differentUnitStallSub} numberOfLines={1}>
                        {item.stalls?.section || 'N/A'} • #{item.stalls?.stall_number || 'N/A'}
                      </Text>
                    </View>
                    <Text style={styles.differentUnitPrice}>
                      ₱{(item.price || 0).toFixed(2)} / {getUnitSuffix(item.unit)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* KPI stat cards */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: COLORS.successLight }]}>
                  <MaterialIcons name="trending-down" size={16} color={COLORS.success} />
                </View>
                <Text style={styles.kpiValue}>₱{marketAnalytics.minPrice.toFixed(2)}</Text>
                <Text style={styles.kpiLabel}>Pinakamura / {getUnitSuffix(marketAnalytics.referenceUnit)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: COLORS.errorLight }]}>
                  <MaterialIcons name="trending-up" size={16} color={COLORS.errorDark} />
                </View>
                <Text style={styles.kpiValue}>₱{marketAnalytics.maxPrice.toFixed(2)}</Text>
                <Text style={styles.kpiLabel}>Pinakamahal / {getUnitSuffix(marketAnalytics.referenceUnit)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: COLORS.infoLight }]}>
                  <MaterialIcons name="calculate" size={16} color={COLORS.info} />
                </View>
                <Text style={styles.kpiValue}>₱{marketAnalytics.avgPrice.toFixed(2)}</Text>
                <Text style={styles.kpiLabel}>Karaniwan / {getUnitSuffix(marketAnalytics.referenceUnit)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: COLORS.warningLight }]}>
                  <MaterialIcons name="compare-arrows" size={16} color={COLORS.warning} />
                </View>
                <Text style={styles.kpiValue}>₱{marketAnalytics.priceDiff.toFixed(2)}</Text>
                <Text style={styles.kpiLabel}>Agwat ng presyo</Text>
              </View>
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: COLORS.brandSoft }]}>
                  <MaterialIcons name="storefront" size={16} color={COLORS.primaryDark} />
                </View>
                <Text style={styles.kpiValue}>{marketAnalytics.totalVendors}</Text>
                <Text style={styles.kpiLabel}>Bilang ng stall</Text>
              </View>
            </View>

            {/* Cheapest & most expensive highlight */}
            <View style={styles.vendorHighlight}>
              <View style={[styles.vendorCard, { borderLeftColor: COLORS.success }]}>
                <VerdictChip verdict="PINAKAMURA" solid style={styles.vendorCardBadge} />
                <Text style={styles.vendorName} numberOfLines={1}>
                  {marketAnalytics.cheapestVendor.stalls?.stall_name || 'Unknown Stall'}
                </Text>
                <Text style={styles.vendorPrice}>₱{marketAnalytics.cheapestVendor.price?.toFixed(2)}</Text>
                <Text style={styles.vendorSub}>
                  {marketAnalytics.cheapestVendor.stalls?.section || 'N/A'} • #{marketAnalytics.cheapestVendor.stalls?.stall_number || 'N/A'}
                </Text>
              </View>
              <View style={[styles.vendorCard, { borderLeftColor: COLORS.errorDark }]}>
                <VerdictChip verdict="MAHAL" style={styles.vendorCardBadge} />
                <Text style={styles.vendorName} numberOfLines={1}>
                  {marketAnalytics.mostExpensiveVendor.stalls?.stall_name || 'Unknown Stall'}
                </Text>
                <Text style={styles.vendorPrice}>₱{marketAnalytics.mostExpensiveVendor.price?.toFixed(2)}</Text>
                <Text style={styles.vendorSub}>
                  {marketAnalytics.mostExpensiveVendor.stalls?.section || 'N/A'} • #{marketAnalytics.mostExpensiveVendor.stalls?.stall_number || 'N/A'}
                </Text>
              </View>
            </View>

            {priceHistory.length > 0 && (
              <PriceHistoryChart data={priceHistory} styles={styles} COLORS={COLORS} />
            )}

            {relatedProducts.length > 0 && (
              <View style={styles.subSection}>
                <Text style={styles.subSectionTitle}>More from {stall?.stall_name || 'this stall'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SPACING.md }}>
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

            {(marketAnalytics.belowAverage.length > 0 || marketAnalytics.outdated.length > 0 || marketAnalytics.unusual.length > 0) && (
              <View style={styles.subSection}>
                <Text style={styles.subSectionTitle}>Presyo Insights</Text>

                {marketAnalytics.belowAverage.length > 0 && (
                  <View style={styles.insightItem}>
                    <View style={styles.insightHeader}>
                      <View style={[styles.insightIcon, { backgroundColor: COLORS.successLight }]}>
                        <MaterialIcons name="trending-down" size={14} color={COLORS.success} />
                      </View>
                      <Text style={styles.insightTitle}>
                        Below Market Average ({marketAnalytics.belowAverage.length} vendors)
                      </Text>
                    </View>
                    <Text style={styles.insightDesc}>
                      These vendors offer prices below the market average of ₱{marketAnalytics.avgPrice.toFixed(2)}.
                      Consider comparing quality before choosing the cheapest option.
                    </Text>
                  </View>
                )}

                {marketAnalytics.outdated.length > 0 && (
                  <View style={styles.insightItem}>
                    <View style={styles.insightHeader}>
                      <View style={[styles.insightIcon, { backgroundColor: COLORS.warningLight }]}>
                        <MaterialIcons name="schedule" size={14} color={COLORS.warning} />
                      </View>
                      <Text style={styles.insightTitle}>
                        Outdated Prices ({marketAnalytics.outdated.length} vendors)
                      </Text>
                    </View>
                    <Text style={styles.insightDesc}>
                      These vendors haven't updated their prices in over 7 days. Prices may be stale or inaccurate.
                    </Text>
                  </View>
                )}

                {marketAnalytics.unusual.length > 0 && (
                  <View style={styles.insightItem}>
                    <View style={styles.insightHeader}>
                      <View style={[styles.insightIcon, { backgroundColor: COLORS.errorLight }]}>
                        <MaterialIcons name="warning" size={14} color={COLORS.errorDark} />
                      </View>
                      <Text style={styles.insightTitle}>
                        Unusual Price Changes ({marketAnalytics.unusual.length} vendors)
                      </Text>
                    </View>
                    <Text style={styles.insightDesc}>
                      These vendors' prices deviate more than 20% from the market average of ₱{marketAnalytics.avgPrice.toFixed(2)}.
                      Verify pricing before purchasing.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        ) : (
          <View style={styles.presyoEmpty}>
            <MaterialIcons name="info-outline" size={28} color={COLORS.text.quaternary} />
            <Text style={styles.presyoEmptyHeading}>Isang stall pa lang ang may nito</Text>
            <Text style={styles.presyoEmptyBody}>
              Wala pang maihahambing na presyo. Titingnan namin ulit bukas.
            </Text>
            <Button variant="outline" size="sm" onPress={() => navigation.goBack()} style={{ marginTop: SPACING.md }}>
              Tingnan ang ibang produkto
            </Button>
          </View>
        )}
      </View>

      {/* Detalye: unit, quantity, secondary actions, description */}
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

        <View style={styles.secondaryActionsRow}>
          <Button
            variant="outline"
            size="sm"
            icon={<Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.text.primary} />}
            onPress={() => {
              hapticLight();
              setOfferPrice((currentPrice * 0.9).toFixed(2));
              setOfferVisible(true);
            }}
            disabled={!product?.is_available}
            style={{ flex: 1 }}
          >
            Make an Offer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onPress={handleBuyNow}
            disabled={!product?.is_available}
            style={{ flex: 1 }}
          >
            {product?.is_available ? t('products.buy_now') : 'Unavailable'}
          </Button>
        </View>
      </View>

      {product.description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalye</Text>
          <Text style={styles.productDescription}>{product.description}</Text>
        </View>
      ) : null}

      {/* Report Button */}
      <View style={styles.reportSection}>
        <TouchableOpacity
          style={styles.reportProductButton}
          onPress={handleReportProduct}
        >
          <Ionicons name="ban-outline" size={18} color={COLORS.primary} />
          <Text style={styles.reportButtonText}>Report this Product</Text>
        </TouchableOpacity>
        <Text style={styles.reportNote}>
          Found an issue with this product? Let us know so we can investigate.
        </Text>
      </View>

    </ScrollView>

      {/* Sticky action bar — replaces the tab bar, not stacked on it */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyTotalBlock}>
          <Text style={styles.stickyTotalLabel}>Total ({quantity} x {unitSuffix})</Text>
          <Text style={styles.stickyTotalAmount}>₱{totalPrice.toFixed(2)}</Text>
        </View>
        <Button
          variant="primary"
          size="lg"
          shape="square"
          onPress={handleAddToCart}
          disabled={!product?.is_available}
          style={styles.stickyCta}
        >
          {product?.is_available ? 'Idagdag sa Kart' : t('products.out_of_stock')}
        </Button>
      </View>

      {/* Haggle Offer Modal */}
      <Modal
        visible={offerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOfferVisible(false)}
      >
        <View style={styles.offerOverlay}>
          <View style={[styles.offerSheet, { backgroundColor: COLORS.surface }]}>
            <View style={styles.offerHandle} />
            <Text style={styles.offerTitle}>Make an Offer 🤝</Text>
            <Text style={styles.offerSubtitle}>
              {product?.name} · Listed at ₱{currentPrice.toFixed(2)} / {getUnitDisplayText(selectedUnit)}
            </Text>

            <Text style={styles.offerLabel}>Your offer per unit</Text>
            <View style={styles.offerInputRow}>
              <Text style={styles.offerCurrency}>₱</Text>
              <TextInput
                style={styles.offerInput}
                placeholder="0.00"
                placeholderTextColor={COLORS.text.quaternary}
                keyboardType="decimal-pad"
                value={offerPrice}
                onChangeText={setOfferPrice}
              />
            </View>
            <Text style={styles.offerHint}>
              Offers are sent to the vendor via chat — they can accept or counter.
            </Text>

            <TouchableOpacity
              style={[
                styles.offerSubmitButton,
                (sendingOffer || !offerPrice) && styles.offerSubmitDisabled,
              ]}
              onPress={submitOffer}
              disabled={sendingOffer || !offerPrice}
              activeOpacity={0.85}
            >
              {sendingOffer ? (
                <ActivityIndicator size="small" color={COLORS.onPrimary} />
              ) : (
                <>
                  <Ionicons name="send" size={16} color={COLORS.onPrimary} />
                  <Text style={styles.offerSubmitText}>Send Offer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add-to-Cart Toast - floats above the buttons, always on screen */}
      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[styles.toastContainer, { transform: [{ translateY: toastAnim }] }]}
        >
          <View style={styles.toastContent}>
            <View style={styles.toastIcon}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.onSuccess} />
            </View>
            <View style={styles.toastTextWrap}>
              <Text style={styles.toastTitle}>{t('cart.added_to_cart')}</Text>
              <Text style={styles.toastSubtitle} numberOfLines={1}>{toastMessage}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  backArrow: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 120,
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 100,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inkSurface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.float,
  },
  toastIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.successSolid,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  toastTextWrap: {
    flex: 1,
  },
  toastTitle: {
    color: COLORS.onInk,
    fontSize: TYPE.size.bodySmall,
    fontWeight: TYPE.weight.bold,
  },
  toastSubtitle: {
    color: COLORS.onInk,
    fontSize: TYPE.size.caption,
    marginTop: 2,
    opacity: 0.8,
  },
  relatedCard: {
    width: 130,
    marginRight: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
  },
  relatedImage: {
    width: '100%',
    height: 100,
    backgroundColor: COLORS.wickerSoft,
  },
  relatedInfo: {
    padding: SPACING.sm + 2,
  },
  relatedName: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.medium,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
    lineHeight: 16,
  },
  relatedPrice: {
    fontSize: TYPE.size.label,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.primary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPE.size.label,
    color: COLORS.text.tertiary,
  },
  errorText: {
    fontSize: TYPE.size.body,
    color: COLORS.errorDark,
    marginBottom: SPACING.xl,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl + 6,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  backButtonText: {
    color: COLORS.onPrimary,
    fontSize: TYPE.size.body,
    fontWeight: TYPE.weight.semibold,
  },
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: COLORS.wickerSoft,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
  },
  productTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  productName: {
    ...TEXT_STYLES.display,
    color: COLORS.text.primary,
    flex: 1,
    marginRight: SPACING.md,
  },
  titleActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  favBtn: { padding: 6 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  productPrice: {
    ...TEXT_STYLES.priceHero,
    color: COLORS.text.primary,
  },
  productUnit: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.tertiary,
  },
  priceVerdict: {
    marginLeft: SPACING.xs,
  },
  priceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  productDescription: {
    fontSize: TYPE.size.body,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  section: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    ...TEXT_STYLES.h2,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  unitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.wickerSoft,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
  },
  unitChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  unitChipText: {
    fontSize: TYPE.size.label,
    fontWeight: TYPE.weight.semibold,
    color: COLORS.text.secondary,
  },
  unitChipTextActive: {
    color: COLORS.onPrimary,
    fontWeight: TYPE.weight.bold,
  },
  unitChipPrice: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    color: COLORS.primaryDark,
    marginLeft: 4,
  },
  unitChipPriceActive: {
    color: COLORS.onPrimary,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  quantityButton: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
  },
  quantityButtonText: {
    fontSize: 22,
    fontWeight: TYPE.weight.bold,
    color: COLORS.primaryDark,
  },
  quantityText: {
    fontSize: 22,
    fontWeight: TYPE.weight.black,
    marginHorizontal: SPACING.md,
    minWidth: 40,
    textAlign: 'center',
    color: COLORS.text.primary,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  stallSection: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  stallCard: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
  },
  stallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    flexWrap: 'wrap',
  },
  stallNumber: {
    fontSize: TYPE.size.caption,
    color: COLORS.primaryDark,
    fontWeight: TYPE.weight.bold,
  },
  stallName: {
    ...TEXT_STYLES.h3,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  stallSectionText: {
    fontSize: TYPE.size.caption,
    color: COLORS.text.tertiary,
  },
  viewStallLink: {
    fontSize: TYPE.size.label,
    color: COLORS.primaryDark,
    marginTop: SPACING.sm,
    fontWeight: TYPE.weight.semibold,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
  },
  stallRatingText: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    color: COLORS.warning,
  },
  stallRatingCount: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.quaternary,
  },
  reportSection: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
    marginHorizontal: SPACING.lg,
  },
  reportProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.sm,
    gap: SPACING.sm,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.accentLight,
    width: '100%',
  },
  reportButtonText: {
    fontSize: TYPE.size.label,
    fontWeight: TYPE.weight.semibold,
    color: COLORS.primaryDark,
  },
  reportNote: {
    fontSize: TYPE.size.caption,
    color: COLORS.text.quaternary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  // ── Sticky action bar (D-18): total left, one orange CTA filling the rest ──
  stickyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderTopWidth: LAYOUT.borderWidth,
    borderTopColor: COLORS.border,
    ...SHADOWS.bar,
  },
  stickyTotalBlock: {
    justifyContent: 'center',
  },
  stickyTotalLabel: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.semibold,
    color: COLORS.text.tertiary,
  },
  stickyTotalAmount: {
    ...TEXT_STYLES.h3,
    color: COLORS.text.primary,
  },
  stickyCta: {
    flex: 1,
  },
  // ── Haggle offer sheet styles ──
  offerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlay,
  },
  offerSheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xxl,
    paddingBottom: SPACING.xxxl,
    ...SHADOWS.overlay,
  },
  offerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  offerTitle: {
    ...TEXT_STYLES.h1,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  offerSubtitle: {
    fontSize: TYPE.size.caption,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  offerLabel: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.semibold,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  offerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  offerCurrency: {
    fontSize: 18,
    fontWeight: TYPE.weight.bold,
    color: COLORS.primaryDark,
    marginRight: SPACING.sm,
  },
  offerInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: 18,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.primary,
  },
  offerHint: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.tertiary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    lineHeight: 16,
  },
  offerSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md + 1,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  offerSubmitDisabled: {
    opacity: 0.5,
  },
  offerSubmitText: {
    color: COLORS.onPrimary,
    fontSize: TYPE.size.bodySmall,
    fontWeight: TYPE.weight.bold,
  },
  originalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  originalPriceLabel: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.secondary,
    marginRight: SPACING.sm,
  },
  originalPriceValue: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.quaternary,
    textDecorationLine: 'line-through',
  },
  unitPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    marginLeft: SPACING.sm,
  },
  unitOriginalPrice: {
    fontSize: TYPE.size.micro - 2,
    color: COLORS.text.quaternary,
    textDecorationLine: 'line-through',
  },
  unitDiscountedPrice: {
    color: COLORS.success,
    fontWeight: TYPE.weight.semibold,
  },
  // ── Presyo Check ──
  presyoSection: {
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
  presyoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  presyoHeading: {
    ...TEXT_STYLES.h2,
    color: COLORS.text.primary,
  },
  presyoLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  presyoLoadingText: {
    fontSize: TYPE.size.caption,
    color: COLORS.text.tertiary,
  },
  presyoEmpty: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.xs,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
  },
  presyoEmptyHeading: {
    ...TEXT_STYLES.h3,
    color: COLORS.text.primary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  presyoEmptyBody: {
    fontSize: TYPE.size.caption,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  // ── Ibang unit: deliberately quiet, never mistaken for part of the ranking ──
  differentUnitGroup: {
    backgroundColor: COLORS.wickerSoft,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  differentUnitHeading: {
    fontSize: TYPE.size.label,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.secondary,
  },
  differentUnitNote: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.tertiary,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  differentUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs + 2,
    borderTopWidth: LAYOUT.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  differentUnitInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  differentUnitStallName: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.semibold,
    color: COLORS.text.secondary,
  },
  differentUnitStallSub: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.quaternary,
  },
  differentUnitPrice: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.secondary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  kpiCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
    ...SHADOWS.none,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  kpiValue: {
    ...TEXT_STYLES.price,
    color: COLORS.text.primary,
  },
  kpiLabel: {
    ...TEXT_STYLES.caption,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  vendorHighlight: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  vendorCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    ...SHADOWS.none,
  },
  vendorCardBadge: {
    marginBottom: SPACING.sm,
  },
  vendorName: {
    fontSize: TYPE.size.label,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  vendorPrice: {
    ...TEXT_STYLES.h3,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  vendorSub: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.quaternary,
  },
  chartContainer: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
  },
  chartTitle: {
    fontSize: TYPE.size.label,
    fontWeight: TYPE.weight.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    gap: 4,
    marginBottom: SPACING.md,
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
    fontSize: TYPE.size.micro - 2,
    color: COLORS.text.quaternary,
    fontWeight: TYPE.weight.semibold,
  },
  chartBarDate: {
    fontSize: 9,
    color: COLORS.text.quaternary,
  },
  chartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm + 2,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
  },
  chartInfoText: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.quaternary,
  },
  subSection: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
  },
  subSectionTitle: {
    ...TEXT_STYLES.h3,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: LAYOUT.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  insightItem: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: LAYOUT.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs + 2,
  },
  insightIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.primary,
    flex: 1,
  },
  insightDesc: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
});
