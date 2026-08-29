// src/screens/customer/HomeScreen.js

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  useWindowDimensions,
  StatusBar,
  Alert,
  Image,
  Platform,
  Animated,
  Vibration,
  AccessibilityInfo,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { notificationService } from '../../services/notificationService';
import { useI18n } from '../../contexts/i18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import { SkeletonList } from '../../components/SkeletonCard';
import { useLastViewed } from '../../hooks/useLastViewed';
import { hapticLight, hapticMedium } from '../../theme/motion';
import { fetchPriceTrends } from '../../services/priceHistoryService';
import { SPACING, RADIUS, LAYOUT, TYPE, TEXT_STYLES, SHADOWS } from '../../theme/tokens';
import { ProductCard } from '../../components/ProductCard';
import { Badge } from '../../components/ui/Badge';
import { Chip } from '../../components/ui/Chip';
import { VerdictChip } from '../../components/ui/VerdictChip';
import { PriceText } from '../../components/ui/PriceText';
import { WovenBackground } from '../../components/WovenBackground';

// Tagalog first, English underneath — that is how the market is spoken.
// `categoryName` must stay the exact English string: CategoryProductsScreen
// filters `.eq('category', categoryName)` against it. Matches
// CATEGORY_CONFIG in CategoryProductsScreen.js exactly.
// `tone` picks the icon circle's tint from the same semantic tokens the
// rest of the app already uses (tokens.js: success/warning/info), not new
// colors — 'neutral' keeps the existing wicker/orange treatment. `image`
// is the reference design system's own illustration for that category
// (design-directions/assets/generated/illustrations); 'Other' has no
// illustration there either, so it keeps the Ionicons fallback.
// No 'Fish' chip: it isn't a real value in CategoryProductsScreen's
// CATEGORY_CONFIG, so navigating to it would silently return zero
// products — the icon existing upstream doesn't make the category real.
const CATEGORY_CHIPS = [
  { categoryName: 'Vegetables', tagalog: 'Gulay', english: 'Vegetables', icon: 'leaf', tone: 'success', image: require('../../../src/assets/categories/ill-cat-vegetables.png') },
  { categoryName: 'Meat', tagalog: 'Karne', english: 'Meat', icon: 'restaurant', tone: 'neutral', image: require('../../../src/assets/categories/ill-cat-meat.png') },
  { categoryName: 'Fruits', tagalog: 'Prutas', english: 'Fruits', icon: 'basket', tone: 'warning', image: require('../../../src/assets/categories/ill-cat-fruits.png') },
  { categoryName: 'Poultry', tagalog: 'Manok', english: 'Poultry', icon: 'egg', tone: 'info', image: require('../../../src/assets/categories/ill-cat-poultry.png') },
  { categoryName: 'Rice', tagalog: 'Bigas', english: 'Rice', icon: 'cafe', tone: 'neutral', image: require('../../../src/assets/categories/ill-cat-rice.png') },
  { categoryName: 'Other', tagalog: 'Iba pa', english: 'Other', icon: 'apps', tone: 'neutral', image: null },
];

const CATEGORY_TONES = {
  neutral: { bg: (c) => c.wickerSoft, icon: (c) => c.primaryDark },
  success: { bg: (c) => c.successLight, icon: (c) => c.success },
  warning: { bg: (c) => c.warningLight, icon: (c) => c.warning },
  info: { bg: (c) => c.infoLight, icon: (c) => c.info },
};

// Same rule SearchScreen.js already uses for its own price comparison
// (D-14): the reference unit for a product-name group is whichever unit
// most of that group's stalls actually sell in. Rows in a different unit
// never enter the comparison — this is what phase 6-02 fixed elsewhere,
// and Presyo Check must not reintroduce it here.
const getReferenceUnit = (items) => {
  const counts = {};
  items.forEach((i) => {
    counts[i.unit] = (counts[i.unit] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
};

// Local time gates, not server state — no query, no new dependency.
// 5:00 AM to 7:00 PM matches the hours already printed everywhere else
// in the app (Login screen, landing page, HelpSupportScreen).
const isMarketOpenNow = () => {
  const hour = new Date().getHours();
  return hour >= 5 && hour < 19;
};

const getGreetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'good_morning';
  if (hour < 18) return 'good_afternoon';
  return 'good_evening';
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
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (mounted) setReduceMotion(!!enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReduceMotion(!!enabled);
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayText(phrases[0]);
      return;
    }

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
  }, [displayText, isDeleting, phraseIndex, reduceMotion]);

  return (
    <Text style={styles.searchPlaceholder}>
      {t('home.search')} <Text style={styles.searchPlaceholderDynamic}>{displayText}</Text>
      <Text style={styles.searchCursor}>|</Text>
    </Text>
  );
};

// ============================================================
// STAR RATING COMPONENT
// ============================================================
const StarRating = ({ rating, size = 12 }) => {
  const { colors } = useTheme();
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[...Array(fullStars)].map((_, i) => (
        <Ionicons key={`full-${i}`} name="star" size={size} color={colors.gold} />
      ))}
      {hasHalfStar && (
        <Ionicons name="star-half" size={size} color={colors.gold} />
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Ionicons key={`empty-${i}`} name="star-outline" size={size} color={colors.text.quaternary} />
      ))}
    </View>
  );
};

// ============================================================
// PRODUCT CARD COMPONENT
// ============================================================
// Local ProductCard duplicate removed (phase 4) — this screen now uses the
// shared src/components/ProductCard.js primitive from phase 2, imported
// above, matching how CategoryProductsScreen already renders products.

// ============================================================
// STALL CARD COMPONENT
// ============================================================
const StallCard = ({ stall, onPress, isClosed = false, isFavorite = false, onToggleFavorite }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [imageError, setImageError] = useState(false);
  const displayRating = stall.average_rating || 3.5 + (stall.id % 3) * 0.5;
  const ratingCount = 20 + (stall.id % 80);
  // Market-hours open/closed, same local time gate as the header —
  // stall-level "temporarily closed" (isClosed) always wins over it.
  const openNow = !isClosed && isMarketOpenNow();

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
              <Ionicons name="storefront-outline" size={30} color={colors.text.quaternary} />
            </View>
          )}
          {isClosed && (
            <View style={styles.stallClosedBadge}>
              <Text style={styles.stallClosedText}>{t('common.closed')}</Text>
            </View>
          )}
          {onToggleFavorite && (
            <TouchableOpacity
              style={styles.stallFavoriteButton}
              onPress={(e) => { e.stopPropagation?.(); hapticLight(); onToggleFavorite(stall); }}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={13}
                color={isFavorite ? colors.error : colors.onInk}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.stallInfo}>
          <View style={styles.stallNameRow}>
            <View style={[styles.stallOpenDot, openNow ? styles.stallOpenDotOpen : styles.stallOpenDotClosed]} />
            <Text style={styles.stallName} numberOfLines={1}>{stall.stall_name || 'Market Stall'}</Text>
          </View>

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
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================
// TOP STALL CARD — photo-forward card for the Top-Rated Stalls rail
// only; the dense "Market Stalls" list keeps the compact StallCard row.
// priceRange comes from the same unit-safe per-stall computation as
// Presyo Check (fetchProductComparisons) — never a raw min/max across
// mixed units.
// ============================================================
const TopStallCard = ({ stall, priceRange, isFavorite, onToggleFavorite, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [imageError, setImageError] = useState(false);
  const displayRating = stall.average_rating || 3.5 + (stall.id % 3) * 0.5;
  const ratingCount = stall.total_ratings || (20 + (stall.id % 80));
  const isClosed = stall.is_temporarily_closed;
  const openNow = !isClosed && isMarketOpenNow();

  return (
    <TouchableOpacity style={styles.topStallCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.topStallImageWrap}>
        {stall.image_url && !imageError ? (
          <Image
            source={{ uri: stall.image_url }}
            style={styles.topStallImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.topStallImagePlaceholder}>
            <Ionicons name="storefront-outline" size={32} color={colors.text.quaternary} />
          </View>
        )}
        <View style={[styles.topStallStatusBadge, openNow ? styles.topStallStatusOpen : styles.topStallStatusClosed]}>
          <Text style={[styles.topStallStatusText, openNow ? styles.topStallStatusTextOpen : styles.topStallStatusTextClosed]}>
            {openNow ? 'Bukas' : 'Sarado'}
          </Text>
        </View>
        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.topStallFavoriteButton}
            onPress={(e) => { e.stopPropagation?.(); hapticLight(); onToggleFavorite(stall); }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={16}
              color={isFavorite ? colors.error : colors.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.topStallBody}>
        <Text style={styles.topStallName} numberOfLines={1}>{stall.stall_name || 'Market Stall'}</Text>
        <View style={styles.topStallMetaRow}>
          <Ionicons name="star" size={12} color={colors.gold} />
          <Text style={styles.topStallRating}>{displayRating.toFixed(1)}</Text>
          <Text style={styles.topStallRatingCount}>({ratingCount})</Text>
          <Text style={styles.topStallMetaDivider}>|</Text>
          <Text style={styles.topStallSection} numberOfLines={1}>
            {stall.section} · #{stall.stall_number}
          </Text>
        </View>
        {priceRange && (
          <View style={styles.topStallPriceRow}>
            <Text style={styles.topStallPriceRange} numberOfLines={1}>
              ₱{priceRange.min.toFixed(0)} - ₱{priceRange.max.toFixed(0)} / {priceRange.unit}
            </Text>
            <View style={styles.topStallRangeBadge}>
              <Text style={styles.topStallRangeBadgeText}>PRESYO RANGE</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ============================================================
// PROMO BANNER CARD — second card in the market banner carousel, same
// photo+overlay+badge treatment as the hours card. Only ever built from
// a real active promo (real product photo, real discount, real stall) —
// never a stock "harvest" photo standing in for content that isn't live.
// ============================================================
const PromoBannerCard = ({ promo, width, styles, onPress }) => {
  const [imageError, setImageError] = useState(false);
  const { colors } = useTheme();
  const product = promo.product;
  const stall = promo.stall;
  const discountText = promo.discount_type === 'percentage'
    ? `${promo.discount_value}% OFF`
    : `₱${promo.discount_value} OFF`;

  return (
    <TouchableOpacity style={[styles.hoursBanner, { width }]} activeOpacity={0.9} onPress={onPress}>
      {product?.image_url && !imageError ? (
        <Image
          source={{ uri: product.image_url }}
          style={styles.hoursBannerImage}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={[styles.hoursBannerImage, styles.hoursBannerImagePlaceholder]}>
          <Ionicons name="pricetag-outline" size={28} color={colors.text.quaternary} />
        </View>
      )}
      <View style={styles.hoursBannerOverlay} />
      <View style={styles.hoursBannerContent}>
        <View style={styles.hoursBannerTag}>
          <Text style={styles.hoursBannerTagText}>May Diskwento</Text>
        </View>
        <Text style={styles.hoursBannerTitle} numberOfLines={1}>
          {discountText} — {product?.name}
        </Text>
        <Text style={styles.hoursBannerText} numberOfLines={1}>
          sa {stall?.stall_name || 'stall'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================
// PRICE DROP ITEM COMPONENT
// ============================================================
const PriceDropItem = ({ item, onPress }) => {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
            <Ionicons name="trending-down-outline" size={32} color={colors.text.quaternary} />
          </View>
        )}
        <Badge tone="tomato" style={styles.savingsBadge}>
          {t('products.save')} ₱{item.savings.toFixed(2)}
        </Badge>
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
// CATEGORY CHIP — illustration when it loads, Ionicons+tone if it fails
// ============================================================
const CategoryChip = ({ cat, styles, colors, onPress }) => {
  const [imageError, setImageError] = useState(false);
  const tone = CATEGORY_TONES[cat.tone] || CATEGORY_TONES.neutral;
  const showImage = cat.image && !imageError;

  return (
    <TouchableOpacity style={styles.categoryChip} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.categoryChipIconCircle, { backgroundColor: tone.bg(colors) }]}>
        {showImage ? (
          <Image
            source={cat.image}
            style={styles.categoryChipImage}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <Ionicons name={cat.icon} size={24} color={tone.icon(colors)} />
        )}
      </View>
      <Text style={styles.categoryChipLabel} numberOfLines={1}>{cat.tagalog}</Text>
      <Text style={styles.categoryChipSubLabel} numberOfLines={1}>{cat.english}</Text>
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
  // Market Stalls (bottom section) reveals more of the already-fetched
  // `stalls` list as the user scrolls near the end of the page, instead of
  // hard-capping at 6 with no way to see the rest.
  const STALL_PAGE_SIZE = 6;
  const [visibleStallCount, setVisibleStallCount] = useState(STALL_PAGE_SIZE);
  const [loadingMoreStalls, setLoadingMoreStalls] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentOrderItems, setRecentOrderItems] = useState([]);
  const [priceDropItems, setPriceDropItems] = useState([]);
  const [priceTrends, setPriceTrends] = useState(new Map());
  const [topRatedStalls, setTopRatedStalls] = useState([]);
  const [presyoCheckItems, setPresyoCheckItems] = useState([]);
  const [stallPriceRanges, setStallPriceRanges] = useState({});
  const [stallRatings, setStallRatings] = useState({});
  const [productCompareCounts, setProductCompareCounts] = useState({});
  const { isProductFavorite, toggleProductFavorite, isStallFavorite, toggleStallFavorite } = useFavorites();
  const [homeAnnouncement, setHomeAnnouncement] = useState(null);
  const [showAllBuyAgain, setShowAllBuyAgain] = useState(false);
  const [marketOpen, setMarketOpen] = useState(isMarketOpenNow());

  useEffect(() => {
    const interval = setInterval(() => setMarketOpen(isMarketOpenNow()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Switching the section filter chip should start the reveal over —
  // otherwise a count built up under "All" could hide stalls that are
  // actually near the top of a newly-selected, shorter filtered list.
  useEffect(() => {
    setVisibleStallCount(STALL_PAGE_SIZE);
  }, [selectedSection]);

  // Reveals more of the already-fetched `stalls` list as the user
  // approaches the bottom of the Home page. All stalls are already in
  // memory (fetchData has no limit on the stalls query), so this is a
  // client-side reveal — the small delay + spinner is just so scrolling
  // down doesn't feel like content is teleporting in.
  const handleHomeScroll = useCallback((e) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceToBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceToBottom > 300) return;
    if (loadingMoreStalls) return;

    const filteredCount = selectedSection === 'All'
      ? stalls.length
      : stalls.filter(s => s.section === selectedSection).length;
    if (visibleStallCount >= filteredCount) return;

    setLoadingMoreStalls(true);
    setTimeout(() => {
      setVisibleStallCount(prev => Math.min(prev + STALL_PAGE_SIZE, filteredCount));
      setLoadingMoreStalls(false);
    }, 400);
  }, [loadingMoreStalls, selectedSection, stalls, visibleStallCount]);

  const loadPriceTrends = async (products) => {
    const ids = (products || []).map(p => p.id).filter(Boolean);
    if (ids.length === 0) return;
    const trends = await fetchPriceTrends(ids);
    if (trends.size > 0) {
      setPriceTrends(prev => new Map([...prev, ...trends]));
    }
  };

  // Top-rated stalls from real customer ratings (publicly readable table)
  const fetchTopRatedStalls = async () => {
    try {
      const { data: ratings } = await supabase
        .from('ratings')
        .select('stall_id, rating')
        .limit(1000);
      if (!ratings || ratings.length === 0) return;

      const stats = new Map();
      for (const r of ratings) {
        if (!r.stall_id) continue;
        const s = stats.get(r.stall_id) || { count: 0, sum: 0 };
        s.count += 1;
        s.sum += parseFloat(r.rating) || 0;
        stats.set(r.stall_id, s);
      }

      // Every stall's real rating, not just the top 5 — Today's Deals cards
      // need this for whichever stall happens to be running a promo.
      const allRatings = {};
      for (const [stallId, s] of stats.entries()) {
        allRatings[stallId] = { average: Math.round((s.sum / s.count) * 10) / 10, count: s.count };
      }
      setStallRatings(allRatings);

      const topIds = [...stats.entries()]
        .sort((a, b) => (b[1].count - a[1].count) || ((b[1].sum / b[1].count) - (a[1].sum / a[1].count)))
        .slice(0, 5)
        .map(([id]) => id);
      if (topIds.length === 0) return;

      const { data: stallsData } = await supabase
        .from('stalls')
        .select('*')
        .in('id', topIds)
        .eq('is_active', true);
      if (!stallsData || stallsData.length === 0) return;

      const list = stallsData.map(s => ({
        ...s,
        average_rating: Math.round((stats.get(s.id).sum / stats.get(s.id).count) * 10) / 10,
        total_ratings: stats.get(s.id).count,
      }));
      setTopRatedStalls(list);
    } catch (e) {
      console.warn('fetchTopRatedStalls failed:', e);
    }
  };

  // One products fetch feeds two things: Presyo Check (cheapest-per-unit
  // across stalls for a product name) and each stall's own price range
  // (min–max within that stall's own most-common unit). Both reuse the
  // same reference-unit rule already used on ProductDetails/Search, so
  // none of these numbers can ever disagree with those screens, and
  // neither computation needs its own round trip to the database.
  const fetchProductComparisons = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, unit, image_url, stall_id')
        .eq('is_available', true)
        .limit(500);
      if (!data || data.length === 0) return;

      // ---- Presyo Check: group by product name ----
      const byName = {};
      data.forEach((p) => {
        if (!byName[p.name]) byName[p.name] = [];
        byName[p.name].push(p);
      });

      const comparisons = [];
      const compareCounts = {};
      for (const [name, variants] of Object.entries(byName)) {
        const referenceUnit = getReferenceUnit(variants);
        const sameUnit = variants.filter((v) => v.unit === referenceUnit);
        const stallIds = new Set(sameUnit.map((v) => v.stall_id));
        if (stallIds.size < 2) continue; // nothing to compare against
        compareCounts[name] = stallIds.size;

        const prices = sameUnit.map((v) => v.price || 0).filter((p) => p > 0);
        if (prices.length === 0) continue;

        // A card with no real photo anywhere in the group is a worse
        // result than a comparison we just don't feature — skip it
        // rather than show an empty placeholder tile.
        const withPhoto = sameUnit.find((v) => v.image_url);
        if (!withPhoto) continue;

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const cheapest = sameUnit.find((v) => v.price === minPrice);

        comparisons.push({
          name,
          unit: referenceUnit,
          minPrice,
          maxPrice,
          avgPrice,
          stallCount: stallIds.size,
          image_url: withPhoto.image_url,
          productId: cheapest?.id,
        });
      }

      // Widest gap between cheapest and average first — that is the
      // comparison most worth a buyer's attention.
      comparisons.sort((a, b) => (b.avgPrice - b.minPrice) - (a.avgPrice - a.minPrice));
      setPresyoCheckItems(comparisons.slice(0, 3));
      setProductCompareCounts(compareCounts);

      // ---- Per-stall price range, same unit-safety rule ----
      const byStall = {};
      data.forEach((p) => {
        if (!byStall[p.stall_id]) byStall[p.stall_id] = [];
        byStall[p.stall_id].push(p);
      });

      const ranges = {};
      for (const [stallId, items] of Object.entries(byStall)) {
        const referenceUnit = getReferenceUnit(items);
        const sameUnit = items.filter((v) => v.unit === referenceUnit);
        const prices = sameUnit.map((v) => v.price || 0).filter((p) => p > 0);
        if (prices.length === 0) continue;
        ranges[stallId] = {
          min: Math.min(...prices),
          max: Math.max(...prices),
          unit: referenceUnit,
        };
      }
      setStallPriceRanges(ranges);
    } catch (e) {
      console.warn('fetchProductComparisons failed:', e);
    }
  }, []);

  const { user } = useAuth();
  const { addToCart } = useCart();
  const { setIsGuest } = route?.params || {};
  // useNotifications() never actually returned an `unreadCount` (it only
  // exposes push-token/permission state) — destructuring it here silently
  // gave `undefined` forever, so the bell badge could never show a real
  // number, only the announcement dot below. Fetch the real count instead.
  useNotifications();
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useI18n();
  const { colors, isDark } = useTheme();
  const { items: lastViewedItems } = useLastViewed();
  // Computed fresh here (not a module-level snapshot at import time) so
  // it can't go stale relative to the real viewport — that staleness is
  // exactly what blew card widths up to ~4x on first web-preview load.
  const { width: winWidth } = useWindowDimensions();
  const CARD_WIDTH = winWidth * 0.44;
  const BANNER_CARD_WIDTH = winWidth * 0.78;
  const styles = useMemo(() => createStyles(colors, CARD_WIDTH), [colors, CARD_WIDTH]);

  // Best live promo for the second banner card — highest real discount
  // among promos that actually have a product photo, so the card never
  // falls back to a placeholder. Same effective-percent comparison Presyo
  // Check uses, so a fixed-peso discount and a percentage discount are
  // never compared on raw numbers.
  const bestPromo = useMemo(() => {
    const withPhoto = promoProducts.filter((p) => p.product?.image_url);
    if (withPhoto.length === 0) return null;
    const scored = withPhoto.map((promo) => {
      const original = promo.product?.price || promo.original_price || 0;
      const pct = promo.discount_type === 'percentage'
        ? promo.discount_value
        : (original > 0 ? (promo.discount_value / original) * 100 : 0);
      return { promo, pct };
    });
    scored.sort((a, b) => b.pct - a.pct);
    return scored[0].promo;
  }, [promoProducts]);

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
      fetchTopRatedStalls();

      const now = new Date().toISOString();
      const { data: promosData } = await supabase
        .from('promotions')
        .select(`
          *,
          product:product_id (id, name, unit, is_available, image_url, price),
          stall:stall_id (id, stall_number, stall_name, section, gcash_qr_url, gcash_number)
        `)
        .eq('is_active', true)
        .gte('end_date', now)
        .order('created_at', { ascending: false })
        .limit(10);

      if (promosData && promosData.length > 0) {
        const validPromos = promosData.filter(p => p.product?.is_available === true);
        setPromoProducts(validPromos);
        loadPriceTrends(validPromos.map(p => p.product).filter(Boolean));
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
                .select('id, name, price, unit, image_url, stalls(id, stall_name, stall_number, gcash_qr_url, gcash_number)')
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
      const items = Array.from(itemsMap.values());
      setRecentOrderItems(items);
      loadPriceTrends(items);
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
          .select('id, name, price, unit, image_url, stalls(id, stall_name, stall_number, gcash_qr_url, gcash_number)')
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

  // ── Bell badge unread count ──
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) { setUnreadCount(0); return; }
    try {
      const count = await notificationService.getUnreadCount(user.id);
      setUnreadCount(count);
    } catch (e) {
      console.warn('Error loading unread notification count:', e?.message);
    }
  }, [user]);

  // ── Latest customer-facing announcement for the home banner ──
  // homeAnnouncement here only drives the bell dot, so it should reflect
  // "unread", not just "exists" — otherwise mark-all-read on the
  // Notifications screen has no way to ever clear this dot (see
  // notificationService.getReadAnnouncementIds for how "read" is tracked
  // for announcements, which have no per-user row of their own).
  const fetchHomeAnnouncement = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('announcements')
        .select('id, title, content, created_at')
        .contains('target_audience', ['customers'])
        .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
        .order('created_at', { ascending: false })
        .limit(1);
      const latest = data?.[0] || null;
      if (latest && user?.id) {
        const readIds = await notificationService.getReadAnnouncementIds(user.id);
        if (readIds.includes(latest.id)) {
          setHomeAnnouncement(null);
          return;
        }
      }
      setHomeAnnouncement(latest);
    } catch (e) {
      console.warn('Error loading home announcement:', e?.message);
    }
  }, [user]);

  // Refresh on focus so returning from the Notifications screen (after
  // reading/marking-all-read there) updates the badge and dot immediately.
  useEffect(() => {
    fetchUnreadCount();
    fetchHomeAnnouncement();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUnreadCount();
      fetchHomeAnnouncement();
    });
    return unsubscribe;
  }, [navigation, fetchUnreadCount, fetchHomeAnnouncement]);

  //  Fixed: Only fetch once using ref to prevent infinite loop
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchData();
      fetchHomeAnnouncement();
      fetchProductComparisons();
      if (user && !isGuest) {
        fetchRecentOrders();
        fetchPriceDrops();
      }
    }
  }, [user, isGuest]);

  const handleAddToCart = (product, stall) => {
    if (!user && !isGuest) {
      Alert.alert(t('auth.login_required'), t('auth.login_to_add_cart'), [
        { text: t('common.cancel'), style: 'cancel' },
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
      // Haptic feedback + animated toast
      hapticMedium();
      showToast(`${product.name} added to cart`);
    }
  };

  const handleOrderAgain = (item) => {
    if (!user && !isGuest) {
      Alert.alert(t('auth.login_required'), t('auth.login_to_add_cart'), [
        { text: t('common.cancel'), style: 'cancel' },
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
      // Haptic feedback + animated toast
      hapticMedium();
      showToast(`${item.quantity}× ${item.name} added to cart`);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    fetchHomeAnnouncement();
    fetchProductComparisons();
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
        <WovenBackground isDark={isDark} />
        <StatusBar barStyle={colors.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={colors.surface} />
        <View style={[styles.searchHeader, { paddingTop: Platform.OS === 'ios' ? 44 : 28, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md }]}>
          <View style={{ height: 44 }} />
        </View>
        <ScrollView>
          <SkeletonList count={4} />
          <SkeletonList count={4} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WovenBackground isDark={isDark} />
      <StatusBar barStyle={colors.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={colors.surface} />

      {/*  Brand Header: logo/wordmark, market status, notification bell */}
      <View style={styles.searchHeader}>
        <WovenBackground isDark={isDark} />
        <View style={styles.searchHeaderContent}>
          <View style={styles.brandRow}>
            <View style={styles.brandLeft}>
              <Image
                source={require('../../../src/assets/palengkehublogo.jpg')}
                style={styles.brandLogo}
                resizeMode="cover"
              />
              <Text style={styles.brandWordmark}>
                Palengke<Text style={styles.brandWordmarkAccent}>Hub</Text>
              </Text>
            </View>

            <View style={styles.brandRight}>
              <View
                style={[
                  styles.marketStatusPill,
                  marketOpen ? styles.marketStatusPillOpen : styles.marketStatusPillClosed,
                ]}
              >
                <View
                  style={[
                    styles.marketStatusDot,
                    marketOpen ? styles.marketStatusDotOpen : styles.marketStatusDotClosed,
                  ]}
                />
                <Text
                  style={[
                    styles.marketStatusText,
                    marketOpen ? styles.marketStatusTextOpen : styles.marketStatusTextClosed,
                  ]}
                >
                  {marketOpen ? t('home.market_open') : t('home.market_closed')}
                </Text>
              </View>

              {/*  Notification Bell */}
              <TouchableOpacity
                style={styles.notificationButton}
                onPress={() => navigation.navigate('Notifications')}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.text.primary} />
                {unreadCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                ) : homeAnnouncement ? (
                  // No unread notifications, but there's an active admin
                  // announcement — the Notifications screen already lists
                  // it (see NotificationScreen.js), this dot just says
                  // "something's there" instead of a banner blocking Home.
                  <View style={styles.notificationDot} />
                ) : null}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.marketRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert(t('home.other_markets_title'), t('home.other_markets_none'))}
          >
            <View style={styles.marketNameGroup}>
              <Ionicons name="location-sharp" size={13} color={colors.primary} />
              <Text style={styles.marketName} numberOfLines={1}>Lipa City Public Market</Text>
            </View>
            <Ionicons name="chevron-down" size={14} color={colors.text.tertiary} />
          </TouchableOpacity>
          <Text style={styles.marketSubtitle} numberOfLines={1}>Lipa, Batangas 4217 · Pickup only</Text>

          <View style={styles.searchHeaderRow}>
            <TouchableOpacity
              style={styles.searchBar}
              onPress={() => navigation.navigate('Search')}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={22} color={colors.text.tertiary} />
              <TypewriterPlaceholder
                phrases={searchPhrases}
                typingSpeed={100}
                deletingSpeed={50}
                pauseDelay={1500}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={handleHomeScroll}
        scrollEventThrottle={100}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* ============================================================
            GREETING — time-of-day, existing i18n keys only
        ============================================================ */}
        <View style={[styles.section, styles.greetingSection]}>
          <Text style={styles.greetingText}>{t(`home.${getGreetingKey()}`)}, Ka-Palengke</Text>
          <Text style={styles.greetingSubtitle}>{t('home.order_now_pickup')}</Text>
        </View>

        {/* ============================================================
            SHOP BY CATEGORY — the round chip row
        ============================================================ */}
        <View style={[styles.section, styles.categorySection]}>
          <Text style={styles.sectionTitle}>{t('home.shop_by_category')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChipRow}
          >
            {CATEGORY_CHIPS.map((cat) => (
              <CategoryChip
                key={cat.categoryName}
                cat={cat}
                styles={styles}
                colors={colors}
                onPress={() => navigation.navigate('CategoryProducts', { categoryName: cat.categoryName })}
              />
            ))}
          </ScrollView>
        </View>

        {/* ============================================================
            MARKET BANNER CAROUSEL — hours card (always) + best live promo
            card (only when a real one exists), same photo+overlay+badge
            treatment as the landing page's own banner cards.
        ============================================================ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bannerScrollContent}
        >
          <View style={[styles.hoursBanner, { width: BANNER_CARD_WIDTH }]}>
            <Image
              source={require('../../../src/assets/Lipapublicmarket.jpg')}
              style={styles.hoursBannerImage}
              resizeMode="cover"
            />
            <View style={styles.hoursBannerOverlay} />
            <View style={styles.hoursBannerContent}>
              <View style={styles.hoursBannerTag}>
                <Text style={styles.hoursBannerTagText}>
                  {marketOpen ? t('home.market_open') : t('home.market_closed')}
                </Text>
              </View>
              <Text style={styles.hoursBannerTitle}>5:00 AM to 7:00 PM, araw-araw</Text>
              <Text style={styles.hoursBannerText}>Pickup sa mismong stall. Walang delivery fee.</Text>
            </View>
          </View>

          <View style={[styles.hoursBanner, { width: BANNER_CARD_WIDTH }]}>
            <Image
              source={require('../../assets/banner-fresh-harvest.png')}
              style={styles.hoursBannerImage}
              resizeMode="cover"
            />
            <View style={styles.hoursBannerOverlay} />
            <View style={styles.hoursBannerContent}>
              <View style={styles.hoursBannerTag}>
                <Text style={styles.hoursBannerTagText}>Bagong Ani</Text>
              </View>
              <Text style={styles.hoursBannerTitle}>Sariwang gulay at prutas araw-araw</Text>
              <Text style={styles.hoursBannerText}>Direkta mula sa mga stall sa palengke.</Text>
            </View>
          </View>

          {bestPromo && (
            <PromoBannerCard
              promo={bestPromo}
              width={BANNER_CARD_WIDTH}
              styles={styles}
              onPress={() => navigation.navigate('ProductDetails', { productId: bestPromo.product.id })}
            />
          )}
        </ScrollView>

        {/* ============================================================
            PRESYO CHECK — cheapest-per-unit across stalls, real query,
            same reference-unit rule as ProductDetails/Search (no fake data)
        ============================================================ */}
        {presyoCheckItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Presyo Check</Text>
                <Text style={styles.sectionSubtitle}>Pinakamura kada kilo ngayon</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Search')}>
                <Text style={styles.sectionLink}>Tingnan Lahat</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {presyoCheckItems.map((item) => {
                const goTo = () => item.productId
                  ? navigation.navigate('ProductDetails', { productId: item.productId })
                  : navigation.navigate('Search');
                const fillPct = item.maxPrice > 0 ? Math.min(100, (item.minPrice / item.maxPrice) * 100) : 0;
                const tickPct = item.maxPrice > 0 ? Math.min(100, (item.avgPrice / item.maxPrice) * 100) : 0;
                return (
                  <TouchableOpacity
                    key={item.name}
                    style={styles.presyoCard}
                    activeOpacity={0.85}
                    onPress={goTo}
                  >
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.presyoImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.presyoImagePlaceholder}>
                        <Ionicons name="pricetag-outline" size={26} color={colors.text.quaternary} />
                      </View>
                    )}
                    <View style={styles.presyoDetails}>
                      <Text style={styles.presyoName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.presyoPriceRow}>
                        <PriceText price={item.minPrice} unit={item.unit} />
                        <VerdictChip verdict="PINAKAMURA" solid />
                      </View>

                      <View style={styles.presyoBarTrack}>
                        <View style={[styles.presyoBarFill, { width: `${fillPct}%` }]} />
                        <View style={[styles.presyoBarTick, { left: `${tickPct}%` }]} />
                      </View>
                      <View style={styles.presyoBarLabels}>
                        <Text style={styles.presyoBarLabel}>₱{item.minPrice.toFixed(0)} pinakamura</Text>
                        <Text style={styles.presyoBarLabel}>avg ₱{item.avgPrice.toFixed(0)}</Text>
                      </View>

                      <View style={styles.presyoFooterRow}>
                        <View style={styles.presyoStallCountRow}>
                          <Ionicons name="storefront-outline" size={13} color={colors.text.tertiary} />
                          <Text style={styles.presyoStallCount}>{item.stallCount} na stalls</Text>
                        </View>
                        <TouchableOpacity onPress={goTo} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <View style={styles.presyoCompareRow}>
                            <Text style={styles.presyoCompareText}>Ikumpara</Text>
                            <Ionicons name="chevron-forward" size={13} color={colors.primaryDark} />
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ============================================================
            TODAY'S DEALS
        ============================================================ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>{t('home.todays_deals')}</Text>
              <Text style={styles.sectionSubtitle}>{t('home.dont_miss_discounts')}</Text>
            </View>
            {promoProducts.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Search', { tab: 'promos' })}>
                <Text style={styles.sectionLink}>{t('home.see_all')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {promoProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={48} color={colors.text.quaternary} />
              <Text style={styles.emptyStateTitle}>{t('home.no_deals')}</Text>
              <Text style={styles.emptyStateText}>{t('home.check_back_later')}</Text>
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
                const stallRating = stall?.id ? stallRatings[stall.id] : null;
                const compareCount = product?.name ? productCompareCounts[product.name] : undefined;

                return (
                  <ProductCard
                    key={promo.id}
                    // ProductCard's default width ('48%') is meant for a
                    // 2-column wrapped grid — inside this horizontal
                    // ScrollView it resolves against no stable base and
                    // renders ~110px wide, clipping the price and cramming
                    // the button text. Match the app's established
                    // horizontal-card width instead (same value Presyo
                    // Check derives its own card width from).
                    style={{ width: CARD_WIDTH }}
                    product={{ ...product, price: promo.discounted_price, original_price: promo.original_price }}
                    stall={stall}
                    discountText={discountText}
                    hasPromotion={true}
                    verdict="MURA"
                    rating={stallRating?.average}
                    ratingCount={stallRating?.count}
                    compareCount={compareCount}
                    onComparePress={() => navigation.navigate('ProductDetails', { productId: product.id })}
                    priceTrend={priceTrends.get(product.id)}
                    onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
                    onAddToCart={() => handleAddToCart({ ...product, price: promo.discounted_price }, stall)}
                    isWishlisted={product?.id ? isProductFavorite(product.id) : false}
                    onToggleWishlist={() => { hapticLight(); toggleProductFavorite(product); }}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ============================================================
            RECENTLY VIEWED
        ============================================================ */}
        {lastViewedItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}> Recently Viewed</Text>
                <Text style={styles.sectionSubtitle}>Pick up where you left off</Text>
              </View>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {lastViewedItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.productCard, { marginRight: SPACING.md }]}
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: item.image }}
                    style={styles.productImage}
                  />
                  <View style={styles.recentInfo}>
                    <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                    <Text numberOfLines={1} style={styles.recentStallText}>{item.stall_name}</Text>
                    <Text style={styles.productPrice}>₱{parseFloat(item.price || 0).toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ============================================================
            BUY AGAIN (Logged-in users only)
        ============================================================ */}
        {!isGuest && user && recentOrderItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{t('home.buy_again')}</Text>
                <Text style={styles.sectionSubtitle}>{t('home.recent_favorites')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAllBuyAgain(v => !v)}>
                <Text style={styles.sectionLink}>{t('home.see_all')}</Text>
              </TouchableOpacity>
            </View>

            {showAllBuyAgain ? (
              <View style={styles.buyAgainGrid}>
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
                    priceTrend={priceTrends.get(item.id)}
                    onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                    onAddToCart={() => handleOrderAgain(item)}
                    isWishlisted={isProductFavorite(item.id)}
                    onToggleWishlist={() => { hapticLight(); toggleProductFavorite(item); }}
                  />
                ))}
              </View>
            ) : (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.horizontalListWithMargin}
              >
                {recentOrderItems.map(item => (
                  <ProductCard
                    key={item.id}
                    style={{ width: CARD_WIDTH }}
                    product={item}
                    stall={item.stall}
                    discountText={item.hasPromotion ? 
                      (item.promotion?.discount_type === 'percentage' 
                        ? `${item.promotion.discount_value}% OFF` 
                        : `₱${item.promotion.discount_value} OFF`) 
                      : null}
                    priceTrend={priceTrends.get(item.id)}
                    onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                    onAddToCart={() => handleOrderAgain(item)}
                    isWishlisted={isProductFavorite(item.id)}
                    onToggleWishlist={() => { hapticLight(); toggleProductFavorite(item); }}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ============================================================
            PRICE DROP ALERT (Logged-in users only)
        ============================================================ */}
        {!isGuest && user && priceDropItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{t('home.price_drop_alert')}</Text>
                <Text style={styles.sectionSubtitle}>{t('home.items_now_cheaper')}</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Search', { tab: 'products' })}>
                <Text style={styles.sectionLink}>{t('home.see_all')}</Text>
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
            TOP-RATED STALLS (from real customer ratings)
        ============================================================ */}
        {topRatedStalls.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}> {t('home.top_rated_stalls')}</Text>
                <Text style={styles.sectionSubtitle}>{t('home.top_rated_subtitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Search')}>
                <Text style={styles.sectionLink}>Tingnan Lahat</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {topRatedStalls.map(stall => (
                <TopStallCard
                  key={stall.id}
                  stall={stall}
                  priceRange={stallPriceRanges[stall.id]}
                  isFavorite={isStallFavorite(stall.id)}
                  onToggleFavorite={toggleStallFavorite}
                  onPress={() => {
                    if (stall.is_temporarily_closed) {
                      Alert.alert(t('stalls.temporarily_closed'), t('stalls.temporarily_closed_msg'));
                      return;
                    }
                    navigation.navigate('StallDetails', { stallId: stall.id });
                  }}
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
              <Text style={styles.sectionTitle}>{t('home.market_stalls')}</Text>
              <Text style={styles.sectionSubtitle}>{t('home.explore_vendors')}</Text>
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filterContainer}
          >
            {sections.map((section, index) => (
              <Chip
                key={index}
                isOn={selectedSection === section}
                onPress={() => setSelectedSection(section)}
              >
                {section}
              </Chip>
            ))}
          </ScrollView>

          <View style={styles.stallsContainer}>
            {filteredStalls.slice(0, visibleStallCount).map(stall => (
              <StallCard
                key={stall.id}
                stall={stall}
                isClosed={stall.is_temporarily_closed}
                isFavorite={isStallFavorite(stall.id)}
                onToggleFavorite={toggleStallFavorite}
                onPress={() => {
                  if (stall.is_temporarily_closed) {
                    Alert.alert(t('stalls.temporarily_closed'), t('stalls.temporarily_closed_msg'));
                    return;
                  }
                  navigation.navigate('StallDetails', { stallId: stall.id });
                }}
              />
            ))}
          </View>

          {loadingMoreStalls && (
            <View style={styles.loadMoreStallsRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadMoreStallsText}>Naglo-load pa ng mga stall...</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add-to-Cart Toast */}
      {toastVisible && (
        <Animated.View style={[styles.toastContainer, { transform: [{ translateY: toastAnim }] }]}>
          <View style={styles.toastContent}>
            <View style={styles.toastIcon}>
              <Ionicons name="checkmark-circle" size={22} color={colors.onSuccess} />
            </View>
            <View style={styles.toastTextWrap}>
              <Text style={styles.toastTitle}>Added to Cart</Text>
              <Text style={styles.toastSubtitle} numberOfLines={1}>{toastMessage}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
// cardWidth defaults to a fresh (not stale) Dimensions read for the three
// call sites (TypewriterPlaceholder, StallCard, PriceDropItem) that don't
// have a live useWindowDimensions() value to pass in — a JS default
// parameter evaluates at call time, so this still self-corrects instead
// of freezing at whatever the window was when the module first loaded.
const createStyles = (colors, cardWidth = Dimensions.get('window').width * 0.44) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
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
    backgroundColor: colors.inkSurface,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    ...SHADOWS.float,
  },
  toastIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toastTextWrap: {
    flex: 1,
  },
  toastTitle: {
    color: colors.onInk,
    fontSize: 15,
    fontWeight: '700',
  },
  toastSubtitle: {
    color: colors.onInk,
    opacity: 0.75,
    fontSize: 13,
    marginTop: 2,
  },

  loadingContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  loadingCategories: {
    height: 100,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  loadingProducts: {
    height: 200,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: RADIUS.lg,
  },

  // ── Search Header ──
  searchHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: LAYOUT.hairlineWidth,
    borderBottomColor: colors.border,
    paddingTop: Platform.OS === 'ios' ? 44 : 28,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  searchHeaderContent: {},

  // ── Brand Row: logo, wordmark, market status, bell ──
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
  },
  brandWordmark: {
    ...TEXT_STYLES.h2,
    color: colors.text.primary,
  },
  brandWordmarkAccent: {
    color: colors.primary,
  },
  brandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  marketStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    height: 26,
    borderRadius: RADIUS.full,
  },
  marketStatusPillOpen: {
    backgroundColor: colors.successLight,
  },
  marketStatusPillClosed: {
    backgroundColor: colors.errorLight,
  },
  marketStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  marketStatusDotOpen: {
    backgroundColor: colors.success,
  },
  marketStatusDotClosed: {
    backgroundColor: colors.error,
  },
  marketStatusText: {
    fontSize: TYPE.size.micro,
    fontWeight: TYPE.weight.bold,
  },
  marketStatusTextOpen: {
    color: colors.success,
  },
  marketStatusTextClosed: {
    color: colors.errorDark,
  },

  // ── Market Row: pin + name on the left, chevron pinned far right ──
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  marketNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    marginRight: SPACING.sm,
  },
  marketName: {
    ...TEXT_STYLES.label,
    fontSize: TYPE.size.caption,
    color: colors.text.primary,
  },
  marketSubtitle: {
    fontSize: TYPE.size.caption,
    color: colors.text.tertiary,
    marginBottom: SPACING.md,
  },

  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: RADIUS.full,
    height: LAYOUT.searchHeight,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  searchPlaceholder: {
    flex: 1,
    ...TEXT_STYLES.body,
    color: colors.text.tertiary,
    includeFontPadding: false,
  },
  searchPlaceholderDynamic: {
    color: colors.text.primary,
    fontWeight: TYPE.weight.bold,
  },
  searchCursor: {
    color: colors.text.tertiary,
    fontWeight: TYPE.weight.regular,
    opacity: 0.8,
  },

  // ── Notification Bell ──
  notificationButton: {
    width: LAYOUT.minTapTarget,
    height: LAYOUT.minTapTarget,
    borderRadius: LAYOUT.minTapTarget / 2,
    backgroundColor: colors.wickerSoft,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  notificationBadgeText: {
    fontSize: TYPE.size.micro,
    fontWeight: TYPE.weight.black,
    color: colors.onError,
    includeFontPadding: false,
  },
  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },

  // ── Sections ──
  section: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxxl,
  },
  buyAgainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.md,
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
    ...TEXT_STYLES.h2,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontSize: TYPE.size.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  sectionLink: {
    ...TEXT_STYLES.label,
    color: colors.primaryDark,
  },

  // ── Greeting ──
  greetingSection: {
    paddingTop: SPACING.xl,
    paddingBottom: 0,
  },
  greetingText: {
    ...TEXT_STYLES.h1,
    color: colors.text.primary,
  },
  greetingSubtitle: {
    ...TEXT_STYLES.bodySmall,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  // ── Market Banner Carousel ──
  bannerScrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  hoursBanner: {
    // Closer to the source photo's own aspect ratio (3552x2664, ~1.33)
    // than the old fixed 140 — that was cropping tighter than it needed
    // to, into a "too zoomed in" close-up of the building.
    height: 190,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: colors.inkSurface,
  },
  hoursBannerImage: {
    ...StyleSheet.absoluteFillObject,
    // absoluteFillObject alone (position:absolute + inset:0) doesn't
    // reliably stretch an <img> on React Native Web — same "replaced
    // element" quirk as WovenBackground's SVG. Without this, the photo
    // rendered at its native 3552x2664 size inside the clipped card, so
    // any horizontal drag over it panned across the full-res image
    // instead of showing the cover-cropped shot.
    width: '100%',
    height: '100%',
  },
  hoursBannerImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
  },
  hoursBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    // colors.overlay (not inkSurface) — inkSurface/onInk flips to a light
    // card in dark mode (it's the toast/badge pairing), which washed this
    // photo out. overlay is a fixed dark scrim in both themes, same token
    // stallClosedBadge already uses to darken a photo underneath text.
    backgroundColor: colors.overlay,
  },
  hoursBannerContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: SPACING.lg,
  },
  hoursBannerTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginBottom: SPACING.sm,
  },
  hoursBannerTagText: {
    fontSize: TYPE.size.micro,
    fontWeight: TYPE.weight.black,
    color: colors.onPrimary,
    letterSpacing: 0.5,
  },
  hoursBannerTitle: {
    ...TEXT_STYLES.h3,
    // Fixed white, not a theme token: this sits on a photo behind a
    // permanently-dark scrim (colors.overlay) in both light and dark mode,
    // so it must not flip dark the way body text does in light mode.
    color: '#FFFFFF',
    marginBottom: 2,
  },
  hoursBannerText: {
    fontSize: TYPE.size.caption,
    color: '#FFFFFF',
    opacity: 0.85,
  },

  // ── Category Chips ──
  categorySection: {
    paddingTop: SPACING.lg,
  },
  categoryChipRow: {
    paddingTop: SPACING.md,
    paddingRight: SPACING.lg,
    gap: SPACING.md,
  },
  categoryChip: {
    alignItems: 'center',
    width: 72,
    minHeight: 42,
  },
  categoryChipIconCircle: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: colors.wickerSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  categoryChipImage: {
    width: 40,
    height: 40,
  },
  categoryChipLabel: {
    ...TEXT_STYLES.label,
    color: colors.text.primary,
    textAlign: 'center',
  },
  categoryChipSubLabel: {
    fontSize: TYPE.size.micro,
    fontWeight: TYPE.weight.medium,
    color: colors.text.tertiary,
    textAlign: 'center',
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

  // ── Recently Viewed card (its own lightweight card, not the shared
  // ProductCard primitive — no add-to-cart data available for this rail) ──
  productCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: LAYOUT.borderWidth,
    borderColor: colors.border,
    marginBottom: SPACING.md,
    position: 'relative',
    width: cardWidth,
  },
  productImage: {
    width: '100%',
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: colors.inputBg,
  },
  recentInfo: {
    padding: SPACING.md,
  },
  productName: {
    ...TEXT_STYLES.bodySmall,
    color: colors.text.primary,
    marginBottom: 4,
  },
  recentStallText: {
    fontSize: TYPE.size.caption,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  productPrice: {
    ...TEXT_STYLES.price,
    color: colors.primary,
  },

  // ── Price Drop Cards ──
  priceDropCard: {
    width: cardWidth,
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: LAYOUT.borderWidth,
    borderColor: colors.border,
    marginBottom: SPACING.md,
  },
  priceDropImageWrapper: {
    position: 'relative',
    backgroundColor: colors.inputBg,
    padding: SPACING.md,
    height: 100,
  },
  priceDropImage: {
    width: '100%',
    height: 80,
    borderRadius: RADIUS.md,
    backgroundColor: colors.inputBg,
  },
  priceDropImagePlaceholder: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: RADIUS.md,
  },
  savingsBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
  },
  priceDropDetails: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  priceDropName: {
    ...TEXT_STYLES.bodySmall,
    color: colors.text.primary,
    marginBottom: 4,
  },
  priceDropPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  priceDropOldPrice: {
    fontSize: TYPE.size.caption,
    color: colors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  priceDropNewPrice: {
    ...TEXT_STYLES.price,
    color: colors.success,
  },
  priceDropVendor: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // ── Presyo Check Cards ──
  presyoCard: {
    width: cardWidth * 1.25,
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: LAYOUT.borderWidth,
    borderColor: colors.border,
  },
  presyoImage: {
    width: '100%',
    height: 90,
    backgroundColor: colors.inputBg,
  },
  presyoImagePlaceholder: {
    width: '100%',
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
  },
  presyoDetails: {
    padding: SPACING.md,
  },
  presyoName: {
    ...TEXT_STYLES.bodySmall,
    color: colors.text.primary,
    marginBottom: 6,
  },
  presyoPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  presyoBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.wickerSoft,
    overflow: 'visible',
    position: 'relative',
  },
  presyoBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  presyoBarTick: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 10,
    backgroundColor: colors.text.primary,
    marginLeft: -1,
  },
  presyoBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  presyoBarLabel: {
    fontSize: TYPE.size.micro,
    color: colors.text.tertiary,
  },
  presyoFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: LAYOUT.hairlineWidth,
    borderTopColor: colors.border,
  },
  presyoStallCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  presyoStallCount: {
    fontSize: TYPE.size.caption,
    color: colors.text.tertiary,
  },
  presyoCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  presyoCompareText: {
    ...TEXT_STYLES.label,
    color: colors.primaryDark,
  },

  // ── Filter Chips ──
  filterContainer: {
    paddingRight: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  // ── Stall Cards ──
  stallsContainer: {
    gap: SPACING.md,
  },
  loadMoreStallsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  loadMoreStallsText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  stallCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: LAYOUT.borderWidth,
    borderColor: colors.border,
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
    borderRadius: RADIUS.md,
    backgroundColor: colors.borderLight,
  },
  stallImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallClosedBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallClosedText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.onInk,
    letterSpacing: 0.5,
  },
  stallFavoriteButton: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.inkSurface,
    opacity: 0.85,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallInfo: {
    flex: 1,
  },
  stallNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  stallOpenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stallOpenDotOpen: {
    backgroundColor: colors.success,
  },
  stallOpenDotClosed: {
    backgroundColor: colors.error,
  },
  stallName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    flexShrink: 1,
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
    color: colors.primary,
  },
  stallMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.tertiaryer,
  },
  stallSection: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  stallRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stallRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },
  stallRatingCount: {
    fontSize: 11,
    color: colors.text.tertiaryer,
  },
  stallArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Top Stall Card (Top-Rated Stalls rail) ──
  topStallCard: {
    width: cardWidth * 1.7,
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: LAYOUT.borderWidth,
    borderColor: colors.border,
  },
  topStallImageWrap: {
    position: 'relative',
  },
  topStallImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.inputBg,
  },
  topStallImagePlaceholder: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
  },
  topStallStatusBadge: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  topStallStatusOpen: {
    backgroundColor: colors.successLight,
  },
  topStallStatusClosed: {
    backgroundColor: colors.errorLight,
  },
  topStallStatusText: {
    fontSize: TYPE.size.micro,
    fontWeight: TYPE.weight.black,
  },
  topStallStatusTextOpen: {
    color: colors.success,
  },
  topStallStatusTextClosed: {
    color: colors.errorDark,
  },
  topStallFavoriteButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topStallBody: {
    padding: SPACING.md,
  },
  topStallName: {
    ...TEXT_STYLES.bodySmall,
    fontWeight: TYPE.weight.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  topStallMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  topStallRating: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    color: colors.text.primary,
  },
  topStallRatingCount: {
    fontSize: TYPE.size.caption,
    color: colors.text.tertiary,
  },
  topStallMetaDivider: {
    fontSize: TYPE.size.caption,
    color: colors.border,
    marginHorizontal: 2,
  },
  topStallSection: {
    fontSize: TYPE.size.caption,
    color: colors.text.tertiary,
    flexShrink: 1,
  },
  topStallPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: LAYOUT.hairlineWidth,
    borderTopColor: colors.border,
  },
  topStallPriceRange: {
    ...TEXT_STYLES.label,
    fontWeight: TYPE.weight.bold,
    color: colors.text.primary,
    flexShrink: 1,
    marginRight: SPACING.xs,
  },
  topStallRangeBadge: {
    backgroundColor: colors.successLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  topStallRangeBadgeText: {
    fontSize: 9,
    fontWeight: TYPE.weight.black,
    color: colors.success,
    letterSpacing: 0.3,
  },

  // ── Empty States ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: colors.accentSoft,
    borderRadius: RADIUS.lg,
    marginVertical: SPACING.sm,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: SPACING.md,
  },
  emptyStateText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: SPACING.xs,
  },

  // ── Bottom Spacer ──
  bottomSpacer: {
    height: 20,
  },
});