import { useColors } from '../../contexts/ThemeContext';
// src/screens/customer/SearchScreen.js

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Animated,
  Modal,
  Image,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useAnnounceActiveScreen } from '../../contexts/ActiveScreenContext';
import { startListening, stopListening, isVoiceInputSupported } from '../../services/voiceService';
import { PriceTrendBadge } from '../../components/PriceTrendBadge';
import { fetchPriceTrends } from '../../services/priceHistoryService';
import { fetchAllStallRatings } from '../../services/stallRatingsService';
import { useI18n } from '../../contexts/i18nContext';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../contexts/AuthContext';
import { MOTION, hapticSelection, hapticMedium } from '../../theme/motion';
import { SPACING, RADIUS, LAYOUT, TYPE, TEXT_STYLES, SHADOWS } from '../../theme/tokens';
import { Badge } from '../../components/ui/Badge';
import { Chip } from '../../components/ui/Chip';
import { VerdictChip } from '../../components/ui/VerdictChip';
import { getProductPriceRange } from '../../utils/priceRange';
import { getProductFallbackPhoto } from '../../utils/productPhotoFallbacks';
import { CATEGORY_OPTIONS } from '../../constants/productCategories';

const RECENT_SEARCHES_KEY = '@palengkehub_recent_searches';
const MAX_RECENT_SEARCHES = 10;

// Sort chips shown above the comparison list.
const SORT_OPTIONS = [
  { id: 'best_match', label: 'Best Match' },
  { id: 'price_asc', label: '₱ Mababa' },
  { id: 'price_desc', label: '₱ Mataas' },
  { id: 'rating', label: 'Rating' },
];

// Preset buckets rather than a true drag slider — no slider component
// exists yet in this app and adding one pulls in a new native
// dependency (needs a rebuild, not just a reload). These solve the
// same "filter by price" need without that.
const PRICE_RANGES = [
  { id: 'under_100', label: 'Under ₱100', min: null, max: 100 },
  { id: '100_300', label: '₱100 – ₱300', min: 100, max: 300 },
  { id: '300_500', label: '₱300 – ₱500', min: 300, max: 500 },
  { id: 'over_500', label: '₱500+', min: 500, max: null },
];

const getStarDistribution = (rating) => {
  const fullStars = Math.floor(rating);
  const halfStar = (rating % 1) >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  return { fullStars, halfStar, emptyStars };
};

// D-14: a product-name group has no single "viewed product" to anchor a
// reference unit the way ProductDetailsScreen does, so the reference unit
// here is whichever unit the most stalls actually use. Rows in any other
// unit are real listings, just never ranked or badged against this group.
const getReferenceUnit = (items) => {
  const counts = {};
  items.forEach((i) => {
    const unit = i.data ? i.data.unit : i.unit;
    counts[unit] = (counts[unit] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
};

// Fallback-aware thumbnail for the compact suggestion strip — same
// real-photo -> fallback-photo -> icon chain ProductCard.js uses, just
// sized for this smaller card. Needs its own component (not inline in
// the .map() below) since it tracks its own image-load error in state.
const SuggestionThumbnail = ({ product }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  // Safety net: a stale/dead image_url can fail to load without ever
  // firing onError on every platform, leaving a permanently blank box
  // instead of falling back — see ProductCard.js for the same pattern.
  useEffect(() => { setImageLoaded(false); setImageError(false); }, [product?.image_url]);
  useEffect(() => {
    if (!product?.image_url || imageError || imageLoaded) return;
    const timer = setTimeout(() => setImageError(true), 4000);
    return () => clearTimeout(timer);
  }, [product?.image_url, imageError, imageLoaded]);
  const fallbackPhoto = !product?.image_url || imageError ? getProductFallbackPhoto(product?.name) : null;

  if (product?.image_url && !imageError) {
    return (
      <Image
        source={{ uri: product.image_url }}
        style={thumbnailStyles.image}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        resizeMode="cover"
      />
    );
  }
  if (fallbackPhoto) {
    return <Image source={fallbackPhoto} style={thumbnailStyles.image} resizeMode="cover" />;
  }
  return (
    <View style={thumbnailStyles.placeholder}>
      <Ionicons name="cart-outline" size={24} color="#9CA3AF" />
    </View>
  );
};

const thumbnailStyles = StyleSheet.create({
  image: { width: '100%', height: 90, backgroundColor: '#F3F4F6' },
  placeholder: { width: '100%', height: 90, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
});

const getDiscountedPrice = (originalPrice, promotion) => {
  if (!promotion) return originalPrice;
  if (promotion.discount_type === 'percentage') {
    return originalPrice * (1 - promotion.discount_value / 100);
  } else {
    return Math.max(0, originalPrice - promotion.discount_value);
  }
};

// Levenshtein distance — for "Did you mean?" fuzzy matching
const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

// Cache of all product names for suggestions (avoids repeated DB hits)
let productNamesCache = null;

// ── Tagalog  English product synonyms (for elderly users searching in Tagalog) ──
const TAGALOG_SYNONYMS = {
  // Karne (meat)
  baboy: ['pork'], 'karneng baboy': ['pork'], liempo: ['pork belly', 'liempo'],
  kasim: ['pork shoulder'], pata: ['pork leg', 'pata'], atay: ['liver'],
  manok: ['chicken'], baka: ['beef'], 'karneng baka': ['beef'], karne: ['meat'],
  itik: ['duck'], pato: ['duck'], bibe: ['duck'], pabo: ['turkey'],
  kambing: ['goat'], tupa: ['lamb'], longganisa: ['sausage', 'longganisa'],
  sausage: ['sausage'], tocino: ['tocino', 'cured pork'], tapa: ['tapa', 'cured beef'],
  hotdog: ['hotdog'], embutido: ['embutido', 'meatloaf'], 'corned beef': ['corned beef'],
  // Isda (fish & seafood)
  isda: ['fish'], bangus: ['milkfish', 'bangus'], tilapia: ['tilapia'],
  galunggong: ['galunggong', 'mackerel'], hipon: ['shrimp'], sugpo: ['prawn'],
  pusit: ['squid'], alimango: ['crab'], alimasag: ['crab'], ulang: ['crayfish', 'lobster'],
  tahong: ['mussel'], talaba: ['oyster'], kuhol: ['snail'], suso: ['snail'],
  dilis: ['anchovy'], tuyo: ['dried fish'], daing: ['dried fish'], danggit: ['dried fish'],
  tinapa: ['smoked fish'], sardinas: ['sardines'], tamban: ['sardine'],
  tuna: ['tuna'], salmon: ['salmon'], 'lapu-lapu': ['grouper', 'lapu-lapu'],
  'maya-maya': ['red snapper'], talakitok: ['trevally'], 'hasa-hasa': ['mackerel'],
  alumahan: ['mackerel'], 'matang baka': ['mackerel'], sapsap: ['ponyfish'],
  hito: ['catfish'], kanduli: ['catfish'], dalag: ['mudfish'],
  igat: ['eel'], palos: ['eel'],
  // Gulay (vegetables)
  gulay: ['vegetable', 'vegetables'], sibuyas: ['onion'], bawang: ['garlic'],
  luya: ['ginger'], kamatis: ['tomato'], patatas: ['potato'], repolyo: ['cabbage'],
  karot: ['carrot'], talong: ['eggplant'], okra: ['okra'],
  sitaw: ['string beans', 'sitaw'], kalabasa: ['squash', 'pumpkin'],
  ampalaya: ['bitter gourd', 'ampalaya'], kangkong: ['water spinach', 'kangkong'],
  petsay: ['pechay', 'bok choy'], 'bok choy': ['bok choy'],
  kamote: ['sweet potato', 'kamote'], 'kamote tops': ['sweet potato leaves', 'talbos'],
  talbos: ['leaves', 'vegetable tops'], sayote: ['chayote', 'sayote'],
  pipino: ['cucumber'], singkamas: ['jicama', 'singkamas'], labanos: ['radish'],
  letsugas: ['lettuce'], broccoli: ['broccoli'], cauliflower: ['cauliflower'],
  upo: ['bottle gourd'], patola: ['sponge gourd'], kundol: ['winter melon'],
  sigarilyas: ['winged bean'], mani: ['peanut'], kasoy: ['cashew'],
  munggo: ['mung bean'], 'mung beans': ['mung bean'], garbanzos: ['chickpeas'],
  patani: ['lima bean'], kadyos: ['pigeon pea'], toge: ['bean sprouts'],
  labong: ['bamboo shoots'], kabute: ['mushroom'], 'tenga ng daga': ['wood ear mushroom'],
  'dahon ng sibuyas': ['spring onion', 'scallion'], kintsay: ['celery', 'parsley'],
  kinchay: ['celery'], wansoy: ['cilantro', 'coriander'],
  alugbati: ['malabar spinach'], saluyot: ['jute leaves'],
  kangkong: ['water spinach'], malunggay: ['moringa', 'malunggay'],
  tanglad: ['lemongrass', 'tanglad'],
  // Prutas (fruits)
  prutas: ['fruit', 'fruits'], saging: ['banana'], mangga: ['mango'],
  pinya: ['pineapple'], pakwan: ['watermelon'], melon: ['melon'],
  niyog: ['coconut'], kalamansi: ['calamansi'], dalandan: ['orange'],
  dalanghita: ['mandarin', 'orange'], mansanas: ['apple'], ubas: ['grape'],
  bayabas: ['guava'], langka: ['jackfruit'], atis: ['sugar apple', 'custard apple'],
  chico: ['sapodilla'], lanzones: ['lanzones'], rambutan: ['rambutan'],
  durian: ['durian'], guyabano: ['soursop', 'guyabano'], suha: ['pomelo'],
  peras: ['pear'], sampalok: ['tamarind', 'sampalok'], kamias: ['bilimbi'],
  santol: ['santol', 'cotton fruit'],
  // Bigas at iba pa (rice & staples)
  bigas: ['rice'], kanin: ['rice'], itlog: ['egg'],
  asukal: ['sugar'], 'pulang asukal': ['brown sugar'], 'brown sugar': ['brown sugar'],
  asin: ['salt'], suka: ['vinegar'], toyo: ['soy sauce'], patis: ['fish sauce'],
  mantika: ['cooking oil', 'oil'], kape: ['coffee'], gatas: ['milk'],
  keso: ['cheese'], 'kesong puti': ['white cheese', 'kesong puti'],
  'keso de bola': ['edam cheese'], tinapay: ['bread'], harina: ['flour'],
  arina: ['flour'], noodles: ['noodles'], pansit: ['noodles'], miswa: ['noodles'],
  sotanghon: ['noodles'], gata: ['coconut milk'], 'kakang gata': ['coconut cream'],
  kakanggata: ['coconut cream'], gawgaw: ['cornstarch'], cornstarch: ['cornstarch'],
  'baking powder': ['baking powder'], 'baking soda': ['baking soda'],
  pampaalsa: ['yeast'], yeast: ['yeast'], vetsin: ['msg', 'seasoning'],
  // Pampalasa (herbs & spices)
  'dahon ng laurel': ['bay leaf', 'bay leaves'], laurel: ['bay leaf', 'bay leaves'],
  paminta: ['pepper', 'black pepper'], 'siling labuyo': ['chili', 'red chili'],
  sili: ['chili', 'chili pepper'], 'siling haba': ['long chili', 'green chili'],
  oregano: ['oregano'], basil: ['basil'], rosemary: ['rosemary'],
  thyme: ['thyme'], cinnamon: ['cinnamon'], kanela: ['cinnamon'],
  anis: ['anise'], cloves: ['cloves'], nutmeg: ['nutmeg'],
};

// Translate a Tagalog query into extra English search terms
const translateQuery = (query) => {
  const q = (query || '').toLowerCase();
  const found = new Set();
  for (const [tagalog, englishTerms] of Object.entries(TAGALOG_SYNONYMS)) {
    if (q.includes(tagalog)) {
      englishTerms.forEach(t => found.add(t));
    }
  }
  return [...found];
};

// Build a PostgREST .or() filter string: original term + Tagalog translations
const buildSearchFilter = (searchTerm) => {
  const filters = [`name.ilike.%${searchTerm}%`];
  const translated = translateQuery(searchTerm);
  translated.forEach(term => filters.push(`name.ilike.%${term}%`));
  return filters.join(',');
};

// Star rating component with Ionicons
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

// ── Animated quantity stepper (C1) ──────────────────────────────────────────
// Spring-pulses the count on every change; haptics handled by parent.
function QuantityStepper({ value, onChange }) {
  const scale = useRef(new Animated.Value(1)).current;
  const C = useColors();
  const styles = useMemo(() => createQtyStyles(C), [C]);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.2, ...MOTION.spring.bouncy }),
      Animated.spring(scale, { toValue: 1, ...MOTION.spring.snappy }),
    ]).start();
  }, [value]);

  const press = (delta) => {
    if (value + delta < 1) return;
    onChange(delta);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.btn, value <= 1 && styles.btnDisabled]}
        onPress={() => press(-1)}
        activeOpacity={0.7}
        disabled={value <= 1}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="remove" size={14} color={value <= 1 ? C.text.quaternary : C.text.secondary} />
      </TouchableOpacity>
      <Animated.Text style={[styles.count, { transform: [{ scale }] }]}>
        {value}
      </Animated.Text>
      <TouchableOpacity
        style={styles.btnInc}
        onPress={() => press(+1)}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="add" size={14} color={C.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const createQtyStyles = (C) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  btn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnInc: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  count: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: C.text.primary,
    marginHorizontal: 4,
  },
});

export default function SearchScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  // See ChatDetailScreen.js for why this screen announces itself directly
  // instead of App.js trying to infer the active screen from outside.
  const announceActiveScreen = useAnnounceActiveScreen();
  useFocusEffect(
    React.useCallback(() => {
      announceActiveScreen('Search');
    }, [announceActiveScreen])
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [priceTrends, setPriceTrends] = useState(new Map());
  // Real per-stall ratings (see stallRatingsService.js) — not query-specific,
  // fetched once on mount. getStallRating/getRatingCount below read from
  // this instead of the seeded-random generator this screen used to have,
  // which showed a different "rating" for the same stall than every other
  // screen.
  const [stallRatingsMap, setStallRatingsMap] = useState({});
  useEffect(() => { fetchAllStallRatings().then(setStallRatingsMap); }, []);
  const getStallRating = (stallId) => {
    const s = stallRatingsMap[stallId] ?? stallRatingsMap[String(stallId)];
    return s?.average ?? 0;
  };
  const getRatingCount = (stallId) => {
    const s = stallRatingsMap[stallId] ?? stallRatingsMap[String(stallId)];
    return s?.count ?? 0;
  };
  const { t } = useI18n();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [quantities, setQuantities] = useState({});
  const [addedProductId, setAddedProductId] = useState(null);

  const changeQty = (productId, delta) => {
    hapticSelection();
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta),
    }));
  };

  // Stop any active voice session when leaving the screen
  useEffect(() => () => { stopListening(); }, []);
  const [productsData, setProductsData] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('products');
  const [sortOption, setSortOption] = useState('best_match');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [priceRangeFilter, setPriceRangeFilter] = useState(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecent, setShowRecent] = useState(true);
  // Separate from "has results" — live search-as-you-type populates
  // productsData on every keystroke (300ms after typing pauses), so
  // gating the sort/filter row on results alone made it pop in mid-type,
  // before the search was actually finished. This only flips true on a
  // real completed search (Enter, a recent/suggested query, or finished
  // voice input) and flips back false the moment the query is edited
  // again, so the row can't show for a stale/in-progress query either.
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [suggestion, setSuggestion] = useState(null);

  // Shown before the user has typed or picked anything — a first-time (or
  // just-cleared) visit otherwise landed on a bare "no recent searches" box
  // with nothing else to do. A small starter set of real products/stalls
  // gives them somewhere to tap instead of a dead end.
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [suggestedStalls, setSuggestedStalls] = useState([]);

  const debounceTimer = useRef(null);

  useEffect(() => {
    loadRecentSearches();
    loadSuggestions();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadSuggestions = async () => {
    try {
      const [ratings, { data: products }, { data: stallRows }] = await Promise.all([
        fetchAllStallRatings(),
        supabase
          .from('products')
          .select(`
            id, name, price, unit, stall_id,
            stalls!inner ( id, stall_number, stall_name, section, average_rating, is_active, vendor_id )
          `)
          .eq('is_available', true)
          .eq('stalls.is_active', true)
          .not('stalls.vendor_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('stalls')
          .select('*')
          .eq('is_active', true)
          .not('vendor_id', 'is', null)
          .order('stall_number')
          .limit(4),
      ]);
      if (ratings) {
        setStallRatingsMap(ratings);
      }
      setSuggestedProducts(products || []);
      setSuggestedStalls(stallRows || []);
    } catch (error) {
      console.warn('Could not load search suggestions:', error?.message);
    }
  };

  useEffect(() => {
    if (searchQuery.length > 0) {
      setShowRecent(false);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        performSearch();
      }, 300);
    } else {
      setShowRecent(true);
      setProductsData([]);
      setStalls([]);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, searchType]);

  const loadRecentSearches = async () => {
    try {
      const saved = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (query) => {
    if (!query.trim()) return;
    try {
      const updated = [query, ...recentSearches.filter(s => s !== query)];
      const trimmed = updated.slice(0, MAX_RECENT_SEARCHES);
      setRecentSearches(trimmed);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  // No confirmation dialog — matches removeRecentSearch's (the "X" button)
  // own no-confirm pattern below, and a multi-button Alert.alert doesn't
  // reliably fire its onPress callbacks on React Native Web, which is why
  // this button silently did nothing there while "X" worked fine.
  const clearRecentSearches = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const removeRecentSearch = async (queryToRemove) => {
    const updated = recentSearches.filter(s => s !== queryToRemove);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };


  // Find the closest product name to a misspelled query (for "Did you mean?")
  // Matches against individual words too (e.g. "brest" -> "chicken breast")
  const findClosestProductName = async (query) => {
    try {
      if (!productNamesCache) {
        const { data } = await supabase
          .from('products')
          .select('name')
          .eq('is_available', true)
          .limit(1000);
        productNamesCache = (data || []).map(p => (p.name || '').trim()).filter(Boolean);
      }
      const q = (query || '').trim().toLowerCase();
      if (!q || productNamesCache.length === 0) return null;

      // Allow typos up to ~40% of the word length (minimum 1)
      const threshold = Math.max(1, Math.floor(q.length * 0.4));

      let bestName = null;
      let bestDist = Infinity;

      // 0. Compare against Tagalog dictionary words FIRST (e.g. "babow" -> "baboy")
      //    so Tagalog typos beat unrelated English products like "bacon"
      for (const tagalogWord of Object.keys(TAGALOG_SYNONYMS)) {
        const tagalogDist = levenshtein(q, tagalogWord.toLowerCase());
        if (tagalogDist < bestDist) {
          bestDist = tagalogDist;
          bestName = tagalogWord;
        }
        if (tagalogDist === 0) break;
      }

      // 1. Compare against English product names (full names and individual words)
      for (const fullName of productNamesCache) {
        const fullDist = levenshtein(q, fullName.toLowerCase());
        if (fullDist < bestDist) {
          bestDist = fullDist;
          bestName = fullName;
        }
        if (fullDist === 0) break;

        // 2. Compare against each word in the name (e.g. "brest" vs "breast" in "chicken breast")
        const words = fullName.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length < 3) continue;
          const wordDist = levenshtein(q, word);
          if (wordDist < bestDist) {
            bestDist = wordDist;
            bestName = fullName;
          }
          if (wordDist === 0) break;
        }
        if (bestDist === 0) break;
      }

      if (bestName && bestDist > 0 && bestDist <= threshold) {
        return bestName.toLowerCase();
      }
      return null;
    } catch {
      return null;
    }
  };

  // Apply the "did you mean" suggestion
  const applySuggestion = (suggestedName) => {
    setSuggestion(null);
    setSearchQuery(suggestedName);
    setSearchSubmitted(true);
    performSearch(suggestedName);
  };

  // Voice search — speak in Tagalog or English and the results update live
  const handleVoiceSearch = async () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }
    if (!isVoiceInputSupported()) {
      Alert.alert(
        'Voice Search',
        'Voice search is not supported on this device. Please type your search instead.',
      );
      return;
    }
    setIsListening(true);
    const started = await startListening({
      language: 'tl-PH',
      onResult: (text, isFinal) => {
        if (!text) return;
        setSearchQuery(text.trim());
        if (isFinal) {
          setIsListening(false);
          setSearchSubmitted(true);
          performSearch(text.trim());
        }
      },
      onEnd: () => setIsListening(false),
      onError: (error) => {
        console.warn('Voice recognition error:', error?.message);
        setIsListening(false);
        if (error?.message === 'not-allowed' || error?.message === 'service-not-allowed') {
          Alert.alert(
            'Voice Search',
            'Microphone access was blocked. Please allow microphone permission for PalengkeHub and try again.',
          );
        } else if (error?.message === 'no-speech') {
          Alert.alert('Voice Search', 'No speech detected. Please try again.');
        } else if (error?.message !== 'aborted') {
          Alert.alert('Voice Search', 'Could not understand the speech. Please try again or type instead.');
        }
      },
    });
    if (!started) {
      setIsListening(false);
      Alert.alert('Voice Search', 'Voice search could not be started. Please type instead.');
    }
  };

  const performSearch = async (overrideQuery) => {
    const query = (overrideQuery || searchQuery).trim();
    if (!query) return;
    setLoading(true);
    setSuggestion(null);
    
    const searchTerm = query;

    try {
      if (searchType === 'products') {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id,
            name,
            price,
            unit,
            category,
            stall_id,
            stalls!inner (
              id,
              stall_number,
              stall_name,
              section,
              average_rating,
              gcash_qr_url,
              gcash_number
            )
          `)
          .or(buildSearchFilter(searchTerm))
          .eq('is_available', true)
          .eq('stalls.is_active', true);

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

          const grouped = {};
          productsWithPromo.forEach(product => {
            if (!grouped[product.name]) {
              grouped[product.name] = [];
            }
            grouped[product.name].push(product);
          });

          const results = [];
          for (const [productName, variants] of Object.entries(grouped)) {
            // D-14: comparable (reference-unit) rows sort by price and lead
            // the group; different-unit rows sort by price among themselves
            // but always trail, since they are not part of the ranking.
            const referenceUnit = getReferenceUnit(variants);
            variants.sort((a, b) => {
              const aRef = a.unit === referenceUnit ? 0 : 1;
              const bRef = b.unit === referenceUnit ? 0 : 1;
              return aRef !== bRef ? aRef - bRef : a.price - b.price;
            });
            results.push({ type: 'header', name: productName });
            variants.forEach(variant => {
              results.push({ type: 'product', data: variant });
            });
          }
          setProductsData(results);
          setSearchSubmitted(true);

          // Fetch price trends for the result products (Bumaba/Tumaas badges)
          const resultIds = results
            .filter(i => i.type === 'product')
            .map(i => i.data.id)
            .filter(Boolean);
          if (resultIds.length > 0) {
            fetchPriceTrends(resultIds).then((trends) => {
              if (trends.size > 0) {
                setPriceTrends(prev => new Map([...prev, ...trends]));
              }
            });
          }
        } else {
          // No exact match — try to find a close match ("Did you mean?")
          const closest = await findClosestProductName(searchTerm);
          if (closest && closest !== searchTerm.toLowerCase()) {
            setSuggestion(closest);
            // Show the corrected products below (same shape as normal search)
            const { data: correctedData } = await supabase
              .from('products')
              .select(`
                id, name, price, unit, category, stall_id,
                stalls!inner (id, stall_number, stall_name, section, average_rating, gcash_qr_url, gcash_number)
              `)
              .eq('is_available', true)
              .or(buildSearchFilter(closest))
              .limit(30);
            if (correctedData && correctedData.length > 0) {
              const correctedIds = correctedData.map(p => p.id);
              const now = new Date().toISOString();
              const { data: corrPromos } = await supabase
                .from('promotions')
                .select('*')
                .in('product_id', correctedIds)
                .eq('is_active', true)
                .lte('start_date', now)
                .gte('end_date', now);
              const corrPromoMap = new Map();
              if (corrPromos) corrPromos.forEach(p => corrPromoMap.set(p.product_id, p));
              const correctedWithPromo = correctedData.map(product => {
                const promotion = corrPromoMap.get(product.id);
                const discountedPrice = getDiscountedPrice(product.price, promotion);
                return {
                  ...product,
                  promotion,
                  originalPrice: product.price,
                  price: discountedPrice,
                  hasPromotion: !!promotion,
                };
              });
              const grouped = {};
              correctedWithPromo.forEach(product => {
                if (!grouped[product.name]) grouped[product.name] = [];
                grouped[product.name].push(product);
              });
              const results = [];
              for (const [productName, variants] of Object.entries(grouped)) {
                const referenceUnit = getReferenceUnit(variants);
                variants.sort((a, b) => {
                  const aRef = a.unit === referenceUnit ? 0 : 1;
                  const bRef = b.unit === referenceUnit ? 0 : 1;
                  return aRef !== bRef ? aRef - bRef : a.price - b.price;
                });
                results.push({ type: 'header', name: productName });
                variants.forEach(variant => {
                  results.push({ type: 'product', data: variant });
                });
              }
              setProductsData(results);
              setSearchSubmitted(true);
            } else {
              setProductsData([]);
            }
          } else {
            setProductsData([]);
          }
        }
      } else if (searchType === 'stalls') {
        const { data, error } = await supabase
          .from('stalls')
          .select('*')
          .eq('is_active', true)
          .not('vendor_id', 'is', null)
          .or(`stall_number.ilike.%${searchTerm}%,stall_name.ilike.%${searchTerm}%,section.ilike.%${searchTerm}%`)
          .order('stall_number')
          .limit(50);

        if (error) throw error;
        
        const stallsWithRatings = (data || []).map(stall => ({
          ...stall,
          displayRating: getStallRating(stall.id),
          ratingCount: getRatingCount(stall.id)
        }));
        
        setStalls(stallsWithRatings);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      setSearchSubmitted(true);
      saveRecentSearch(searchQuery.trim());
      performSearch();
    }
  };

  const handleRecentSearch = (query) => {
    setSearchQuery(query);
    setShowRecent(false);
    setSearchSubmitted(true);
    saveRecentSearch(query);
    setTimeout(() => performSearch(), 100);
  };

  // Explicit, immediate reset rather than only relying on the
  // searchQuery-watching useEffect further up to clear productsData —
  // that effect does the same thing, but firing it directly here means
  // results (and the sort/filter row that depends on them) drop the
  // instant the X is tapped, not just once state settles.
  const handleClearSearch = () => {
    setSearchQuery('');
    setProductsData([]);
    setStalls([]);
    setShowRecent(true);
    setSuggestion(null);
    setSearchSubmitted(false);
  };

  // Editing the query again after a completed search means the results
  // on screen (and the filter row) are for a now-stale query — hide the
  // row until this new query is itself finished/submitted.
  const handleQueryChange = (text) => {
    setSearchQuery(text);
    setSearchSubmitted(false);
  };

  const addToCartFromComparison = async (product, stall, qty) => {
    if (!user) {
      // react-native-web does NOT implement Alert.alert — use window.confirm on web
      if (Platform.OS === 'web') {
        if (window.confirm('Login Required\n\nPlease login to add items to cart')) {
          navigation.navigate('Login');
        }
        return;
      }
      Alert.alert('Login Required', 'Please login to add items to cart', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigation.navigate('Login') },
      ]);
      return;
    }
    await addToCart(product, stall.id, stall, qty || 1);
    hapticMedium();
    setAddedProductId(product.id);
    setTimeout(() => {
      setAddedProductId(prev => (prev === product.id ? null : prev));
    }, 1400);
  };

  // Derived from productsData (the raw search result), never mutates it —
  // re-filters + re-groups + re-sorts on every change to the sort/filter
  // controls. Re-grouping (not just filtering the flat list) matters
  // because each header's "N stalls" count and each product's rank need
  // to reflect what's actually visible, not the original unfiltered set.
  const displayedResults = useMemo(() => {
    const rawProducts = productsData.filter(i => i.type === 'product').map(i => i.data);

    const filtered = rawProducts.filter((p) => {
      if (categoryFilter && (p.category || '').toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (priceRangeFilter) {
        const price = Number(p.price) || 0;
        if (priceRangeFilter.min != null && price < priceRangeFilter.min) return false;
        if (priceRangeFilter.max != null && price > priceRangeFilter.max) return false;
      }
      return true;
    });

    const grouped = {};
    filtered.forEach((product) => {
      if (!grouped[product.name]) grouped[product.name] = [];
      grouped[product.name].push(product);
    });

    let groupEntries = Object.entries(grouped);
    if (sortOption === 'price_asc') {
      groupEntries = groupEntries.sort((a, b) => {
        const aMin = Math.min(...a[1].map((p) => Number(p.price) || 0));
        const bMin = Math.min(...b[1].map((p) => Number(p.price) || 0));
        return aMin - bMin;
      });
    } else if (sortOption === 'price_desc') {
      groupEntries = groupEntries.sort((a, b) => {
        const aMax = Math.max(...a[1].map((p) => Number(p.price) || 0));
        const bMax = Math.max(...b[1].map((p) => Number(p.price) || 0));
        return bMax - aMax;
      });
    } else if (sortOption === 'rating') {
      groupEntries = groupEntries.sort((a, b) => {
        const aRating = Math.max(...a[1].map((p) => getStallRating(p.stalls?.id)));
        const bRating = Math.max(...b[1].map((p) => getStallRating(p.stalls?.id)));
        return bRating - aRating;
      });
    }

    const out = [];
    groupEntries.forEach(([productName, variants]) => {
      // Same reference-unit-first-by-price ordering the original fetch
      // uses (D-14) — kept identical so ranking/Pinakamura stay correct.
      const referenceUnit = getReferenceUnit(variants);
      const sortedVariants = [...variants].sort((a, b) => {
        const aRef = a.unit === referenceUnit ? 0 : 1;
        const bRef = b.unit === referenceUnit ? 0 : 1;
        if (aRef !== bRef) return aRef - bRef;

        const aPrice = Number(a.price) || 0;
        const bPrice = Number(b.price) || 0;

        if (sortOption === 'price_desc') {
          return bPrice - aPrice;
        }
        if (sortOption === 'rating') {
          const aRate = getStallRating(a.stalls?.id);
          const bRate = getStallRating(b.stalls?.id);
          if (bRate !== aRate) return bRate - aRate;
          return aPrice - bPrice;
        }
        return aPrice - bPrice;
      });
      out.push({ type: 'header', name: productName });
      sortedVariants.forEach((variant) => out.push({ type: 'product', data: variant }));
    });

    return out;
  }, [productsData, categoryFilter, priceRangeFilter, sortOption]);

  const activeFilterCount = (categoryFilter ? 1 : 0) + (priceRangeFilter ? 1 : 0);

  const renderProductComparisonItem = ({ item }) => {
    if (item.type === 'header') {
      const groupItems = displayedResults.filter(i => i.type === 'product' && i.data.name === item.name);
      const referenceUnit = getReferenceUnit(groupItems);
      const comparableCount = groupItems.filter(i => i.data.unit === referenceUnit).length;
      const differentUnitCount = groupItems.length - comparableCount;
      return (
        <View style={styles.comparisonHeader}>
          <View style={styles.comparisonHeaderLeft}>
            <Text style={styles.comparisonHeaderText}>{item.name}</Text>
            <Text style={styles.comparisonHeaderSubtext}>{t('search.available_multiple_stalls')}</Text>
          </View>
          <Badge tone="brand">
            {t('search.stalls_count', { count: comparableCount, defaultValue: `${comparableCount} ${comparableCount === 1 ? 'stall' : 'stalls'}` })}
            {differentUnitCount > 0 ? ` (+${differentUnitCount} ${t('search.other_units')})` : ''}
          </Badge>
        </View>
      );
    }

    const product = item.data;
    const stall = product.stalls;
    const groupItems = displayedResults.filter(i => i.type === 'product' && i.data.name === product.name);

    // D-11/D-14: the reference unit is whichever unit most stalls in this
    // group use. Only rows in that unit ever rank or carry Pinakamura — a
    // stall selling by "bundle" never competes against one selling by "kilo",
    // and two different units can't each produce their own "cheapest".
    const referenceUnit = getReferenceUnit(groupItems);
    const isInReferenceUnit = product.unit === referenceUnit;
    const sameUnitItems = isInReferenceUnit ? groupItems.filter(i => i.data.unit === referenceUnit) : [];
    const hasDifferentUnitSiblings = !isInReferenceUnit;
    const isComparable = isInReferenceUnit && sameUnitItems.length > 1;
    const minPriceInUnit = isComparable ? Math.min(...sameUnitItems.map(i => Number(i.data.price) || 0)) : (Number(product.price) || 0);
    const isCheapest = isComparable && (Number(product.price) || 0) === minPriceInUnit;
    const sortedSameUnit = isComparable
      ? [...sameUnitItems].sort((a, b) => {
          const aPrice = Number(a.data.price) || 0;
          const bPrice = Number(b.data.price) || 0;
          if (sortOption === 'price_desc') return bPrice - aPrice;
          if (sortOption === 'rating') {
            const aRate = getStallRating(a.data.stalls?.id);
            const bRate = getStallRating(b.data.stalls?.id);
            if (bRate !== aRate) return bRate - aRate;
            return aPrice - bPrice;
          }
          return aPrice - bPrice;
        })
      : [];
    const rank = isComparable
      ? sortedSameUnit.findIndex(i => i.data.id === product.id) + 1
      : 0;

    const stallRating = getStallRating(stall.id);
    const ratingCount = getRatingCount(stall.id);

    return (
      <TouchableOpacity
        style={[styles.comparisonCard, isCheapest && styles.comparisonCardBestDeal]}
        onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
        activeOpacity={0.7}
      >
        <View style={styles.comparisonTopRow}>
          {isComparable && (
            <View style={styles.comparisonRankCol}>
              <Text style={[styles.comparisonRank, isCheapest && styles.comparisonRankBest]}>{rank}</Text>
            </View>
          )}
          <View style={styles.comparisonStallInfo}>
            <View style={styles.comparisonStallHeader}>
              <Ionicons name="storefront-outline" size={14} color={COLORS.primary} />
              <Text style={styles.comparisonStallName} numberOfLines={2}>{stall.stall_name || t('stalls.vendor_fallback')}</Text>
            </View>
            <Text style={styles.comparisonStallNumber}>{t('stalls.stall_number')} #{stall.stall_number}</Text>
            <Text style={styles.comparisonSection}>{stall.section ? t('market_sections.' + stall.section, stall.section) : ''}</Text>
            <View style={styles.ratingRow}>
              <StarRating rating={stallRating} size={12} />
              <Text style={styles.comparisonRating}> {stallRating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({ratingCount} {t('search.reviews_count')})</Text>
            </View>
            {isCheapest && (
              <VerdictChip verdict={t('products.cheapest', 'PINAKAMURA')} solid style={styles.bestDealBadge} />
            )}
            {hasDifferentUnitSiblings && !isCheapest && (
              <Text style={styles.differentUnitMarker}>{t('search.other_unit')}</Text>
            )}
          </View>
          <View style={styles.comparisonPriceSection}>
            {product.hasPromotion && (
              <Text style={styles.originalPrice}>₱{product.originalPrice.toFixed(2)}</Text>
            )}
            <Text style={styles.comparisonPrice}>
              ₱{product.price.toFixed(2)}
            </Text>
            <Text style={styles.comparisonUnit}>/ {product.unit}</Text>
            <PriceTrendBadge
              currentPrice={product.price}
              previousPrice={priceTrends.get(product.id)?.previous_price}
            />
            {product.hasPromotion && (
              <Badge tone="tomato" style={styles.promoMiniBadge}>
                {product.promotion?.discount_type === 'percentage'
                  ? `${product.promotion.discount_value}% OFF`
                  : `₱${product.promotion.discount_value} OFF`}
              </Badge>
            )}
          </View>
        </View>
        <View style={styles.comparisonBottomRow}>
          <QuantityStepper
            value={quantities[product.id] || 1}
            onChange={(delta) => changeQty(product.id, delta)}
          />
          <TouchableOpacity
            style={[
              styles.addToCartButton,
              addedProductId === product.id && styles.addToCartButtonAdded,
            ]}
            onPress={() => addToCartFromComparison(product, stall, quantities[product.id] || 1)}
            activeOpacity={0.8}
          >
            {/* A distinct cart icon, not the same "+" the quantity stepper
                just used two inches to the left — two identical plus signs
                side by side (one for quantity, one for add-to-cart) is
                exactly what read as duplicated/misleading. */}
            <Ionicons
              name={addedProductId === product.id ? 'checkmark' : 'cart'}
              size={16}
              color={COLORS.onPrimary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStallCard = ({ item }) => {
    const ratingData = stallRatingsMap[item.id] ?? stallRatingsMap[String(item.id)];
    const displayRating = ratingData?.average ?? item.displayRating ?? item.average_rating ?? 0;
    const ratingCount = ratingData?.count ?? item.ratingCount ?? item.total_ratings ?? 0;
    
    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => navigation.navigate('StallDetails', { stallId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.stallIcon}>
            <Ionicons name="storefront" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.resultName}>{t('stalls.stall_number', { number: item.stall_number })}</Text>
            <Text style={styles.resultStallName}>{item.stall_name || t('stalls.vendor_fallback', 'Market Stall')}</Text>
            <View style={styles.cardMeta}>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{item.section}</Text>
              </View>
              <View style={styles.ratingContainer}>
                <StarRating rating={displayRating} size={10} />
                <Text style={styles.resultRating}> {displayRating.toFixed(1)}</Text>
                <Text style={styles.ratingCountSmall}>({ratingCount})</Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.text.light} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderRecentSearches = () => {
    // Nothing to show and nothing useful to say beyond that — the section
    // (header included) just doesn't render, rather than showing an empty
    // state for a "recent searches" list on someone's very first visit.
    if (recentSearches.length === 0) return null;

    return (
    <Animated.View style={[styles.recentSection, { opacity: fadeAnim }]}>
      <View style={styles.recentHeader}>
        <View style={styles.recentHeaderLeft}>
          <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          <Text style={styles.recentTitle}>{t('search.recent_searches')}</Text>
        </View>
        <TouchableOpacity onPress={clearRecentSearches} activeOpacity={0.7}>
          <Text style={styles.clearRecentText}>{t('search.clear_all', 'Clear All')}</Text>
        </TouchableOpacity>
      </View>
      {recentSearches.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.recentItem}
            onPress={() => handleRecentSearch(item)}
            activeOpacity={0.7}
          >
            <View style={styles.recentItemContent}>
              <Ionicons name="search-outline" size={16} color={COLORS.primary} />
              <Text style={styles.recentItemText}>{item}</Text>
            </View>
            <TouchableOpacity
              onPress={() => removeRecentSearch(item)}
              style={styles.removeRecentButton}
            >
              <Ionicons name="close" size={16} color={COLORS.text.lighter} />
            </TouchableOpacity>
          </TouchableOpacity>
      ))}
    </Animated.View>
    );
  };

  const renderSuggestions = () => {
    if (suggestedProducts.length === 0 && suggestedStalls.length === 0) return null;
    return (
      <Animated.View style={[styles.recentSection, { opacity: fadeAnim }]}>
        {suggestedProducts.length > 0 && (
          <>
            <View style={styles.recentHeader}>
              <View style={styles.recentHeaderLeft}>
                <Ionicons name="pricetag-outline" size={18} color={COLORS.primary} />
                <Text style={styles.recentTitle}>{t('search.suggested_products') || 'Suggested Products'}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
              {suggestedProducts.map((product) => {
                const priceRange = getProductPriceRange(product);
                return (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.suggestionCard}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
                  >
                    <SuggestionThumbnail product={product} />
                    <View style={styles.suggestionCardBody}>
                      <Text style={styles.suggestionCardName} numberOfLines={2}>{product.name}</Text>
                      <Text style={styles.suggestionCardPrice}>
                        {priceRange
                          ? `₱${priceRange.min.toFixed(2)} – ₱${priceRange.max.toFixed(2)}`
                          : `₱${Number(product.price).toFixed(2)} / ${product.unit}`}
                      </Text>
                      <Text style={styles.suggestionCardStall} numberOfLines={1}>{product.stalls?.stall_name || t('stalls.vendor_fallback', 'Market Stall')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}
        {suggestedStalls.length > 0 && (
          <>
            <View style={[styles.recentHeader, { marginTop: SPACING.lg }]}>
              <View style={styles.recentHeaderLeft}>
                <Ionicons name="storefront-outline" size={18} color={COLORS.primary} />
                <Text style={styles.recentTitle}>{t('search.suggested_stalls', 'Suggested Stalls')}</Text>
              </View>
            </View>
            {suggestedStalls.map((stall) => (
              <View key={stall.id}>{renderStallCard({ item: stall })}</View>
            ))}
          </>
        )}
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="search-outline" size={56} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>{t('common.no_results')}</Text>
      <Text style={styles.emptyText}>{t('search.try_different_keyword', 'Try searching with a different keyword')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.background} />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <TouchableOpacity
            style={styles.backArrow}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text.primary} />
          </TouchableOpacity>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search-outline" size={20} color={COLORS.primary} />
            <TextInput
              style={styles.searchInput}
              placeholder={isListening ? t('search.voice_listening', 'Listening... speak now (Tagalog or English)') : t('search.placeholder')}
              placeholderTextColor={isListening ? COLORS.primary : COLORS.text.lighter}
              value={searchQuery}
              onChangeText={handleQueryChange}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={COLORS.text.lighter} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleVoiceSearch}
              style={[styles.micButton, isListening && styles.micButtonActive]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isListening ? 'radio' : 'mic-outline'}
                size={19}
                color={isListening ? '#FFFFFF' : COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.typeToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, searchType === 'products' && styles.toggleButtonActive]}
          onPress={() => {
            setSearchType('products');
            if (searchQuery) performSearch();
          }}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.toggleGradient,
              searchType === 'products' && styles.toggleGradientActive,
              { backgroundColor: searchType === 'products' ? COLORS.primary : 'transparent' },
            ]}
          >
            <Ionicons name="cube-outline" size={16} color={searchType === 'products' ? COLORS.onPrimary : COLORS.text.medium} />
            <Text style={[styles.toggleText, searchType === 'products' && styles.toggleTextActive]}>
              {t('search.products_tab')}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, searchType === 'stalls' && styles.toggleButtonActive]}
          onPress={() => {
            setSearchType('stalls');
            if (searchQuery) performSearch();
          }}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.toggleGradient,
              searchType === 'stalls' && styles.toggleGradientActive,
              { backgroundColor: searchType === 'stalls' ? COLORS.primary : 'transparent' },
            ]}
          >
            <Ionicons name="storefront-outline" size={16} color={searchType === 'stalls' ? COLORS.onPrimary : COLORS.text.medium} />
            <Text style={[styles.toggleText, searchType === 'stalls' && styles.toggleTextActive]}>
              {t('search.stalls_tab')}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Sort + filter chips — shown whenever search has product results */}
      {searchType === 'products' && productsData.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sortFilterRow}
          contentContainerStyle={styles.sortFilterContent}
        >
          {SORT_OPTIONS.map((opt) => (
            <Chip
              key={opt.id}
              size="compact"
              isOn={sortOption === opt.id}
              onPress={() => setSortOption(opt.id)}
              style={styles.sortChip}
            >
              {t('search.sort_' + opt.id, opt.label)}
            </Chip>
          ))}
          <Chip
            size="compact"
            icon={<Ionicons name="options-outline" size={14} color={activeFilterCount > 0 ? COLORS.primaryDark : COLORS.text.primary} />}
            isOn={activeFilterCount > 0}
            onPress={() => setFilterSheetVisible(true)}
            style={styles.sortChip}
          >
            {t('search.filters', 'Filters')}
          </Chip>
          {activeFilterCount > 0 && (
            <View style={styles.filterCountDot}>
              <Text style={styles.filterCountDotText}>{activeFilterCount}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* "Did you mean?" suggestion banner */}
      {suggestion && (
        <View style={styles.suggestionBanner}>
          <Ionicons name="bulb-outline" size={18} color={COLORS.warning} />
          <Text style={styles.suggestionText}>
            {t('search.did_you_mean', 'Did you mean')} <Text style={styles.suggestionHighlight}>"{suggestion}"</Text>?
          </Text>
          <TouchableOpacity
            style={styles.suggestionButton}
            onPress={() => applySuggestion(suggestion)}
            activeOpacity={0.8}
          >
            <Text style={styles.suggestionButtonText}>{t('common.search', 'Search')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {showRecent && !searchQuery ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {renderRecentSearches()}
          {renderSuggestions()}
        </ScrollView>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('search.searching', 'Searching...')}</Text>
        </View>
      ) : searchType === 'products' ? (
        <FlatList
          data={displayedResults}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={renderProductComparisonItem}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={searchQuery ? renderEmptyState : null}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={stalls}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderStallCard}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={searchQuery ? renderEmptyState : null}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Filter bottom sheet — phones use a sheet rather than a side
          drawer per the design system's Filters spec. */}
      <Modal visible={filterSheetVisible} animationType="slide" transparent onRequestClose={() => setFilterSheetVisible(false)}>
        <TouchableOpacity style={styles.filterSheetOverlay} activeOpacity={1} onPress={() => setFilterSheetVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.filterSheet} onPress={() => {}}>
            <View style={styles.filterSheetHandle} />
            <Text style={styles.filterSheetTitle}>{t('search.filters', 'Filters')}</Text>

            <Text style={styles.filterSectionLabel}>{t('categories.title', 'Category')}</Text>
            <View style={styles.filterChipWrap}>
              <Chip size="compact" isOn={!categoryFilter} onPress={() => setCategoryFilter(null)} style={styles.filterChipItem}>
                {t('categories.all', 'All')}
              </Chip>
              {CATEGORY_OPTIONS.map((cat) => (
                <Chip
                  key={cat.id}
                  size="compact"
                  isOn={categoryFilter === cat.id}
                  onPress={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
                  style={styles.filterChipItem}
                >
                  {t(`categories.${cat.id}`, cat.label)}
                </Chip>
              ))}
            </View>

            <Text style={styles.filterSectionLabel}>{t('search.price_range', 'Price Range')}</Text>
            <View style={styles.filterChipWrap}>
              <Chip size="compact" isOn={!priceRangeFilter} onPress={() => setPriceRangeFilter(null)} style={styles.filterChipItem}>
                {t('search.any_price', 'Any')}
              </Chip>
              {PRICE_RANGES.map((range) => (
                <Chip
                  key={range.id}
                  size="compact"
                  isOn={priceRangeFilter?.id === range.id}
                  onPress={() => setPriceRangeFilter(priceRangeFilter?.id === range.id ? null : range)}
                  style={styles.filterChipItem}
                >
                  {t('search.range_' + range.id, range.label)}
                </Chip>
              ))}
            </View>

            <View style={styles.filterSheetActions}>
              <TouchableOpacity
                style={styles.filterClearButton}
                onPress={() => { setCategoryFilter(null); setPriceRangeFilter(null); }}
              >
                <Text style={styles.filterClearButtonText}>{t('search.clear_all', 'Clear All')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterApplyButton, { backgroundColor: COLORS.primary }]}
                onPress={() => setFilterSheetVisible(false)}
              >
                <Text style={styles.filterApplyButtonText}>{t('search.show_results', 'Show Results')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Sort + filter chips ──
  // Explicit height, not just paddingVertical around content — a
  // horizontal ScrollView doesn't reliably auto-size its own cross-axis
  // height from its content on every platform (React Native Web
  // included), which is what was clipping the chips.
  // flexGrow/flexShrink: 0 — ScrollView defaults to flexGrow:1 on web,
  // which a bare `height` doesn't cancel. Left as-is, this row would
  // stretch to fill whatever vertical space is free in the screen's flex
  // column (shrinking the results list and shoving the chips/results
  // apart with a blank gap) any time the results list is short enough,
  // or the device tall enough, to leave slack for it to grow into.
  sortFilterRow: {
    height: 56,
    flexGrow: 0,
    flexShrink: 0,
  },
  sortFilterContent: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  sortChip: {
    marginRight: 0,
  },
  filterCountDot: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -SPACING.xs,
    alignSelf: 'center',
  },
  filterCountDotText: {
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.onPrimary,
  },

  // ── Filter bottom sheet ──
  filterSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(38,16,6,0.5)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxl,
    maxHeight: '80%',
  },
  filterSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  filterSheetTitle: {
    ...TEXT_STYLES.h2,
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
  },
  filterSectionLabel: {
    fontSize: TYPE.size.label,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  filterChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  filterChipItem: {
    marginRight: 0,
  },
  filterSheetActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  filterClearButton: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.full,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterClearButtonText: {
    fontSize: TYPE.size.body,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.text.primary,
  },
  filterApplyButton: {
    flex: 2,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApplyButtonText: {
    fontSize: TYPE.size.body,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.onPrimary,
  },

  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.warningSoft || '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.warning || '#F59E0B',
    gap: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.primary,
  },
  suggestionHighlight: {
    fontWeight: '700',
    color: COLORS.warning,
    textTransform: 'capitalize',
  },
  suggestionButton: {
    backgroundColor: COLORS.warning || '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  suggestionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: COLORS.text.dark,
  },
  clearButton: {
    padding: 4,
    flexShrink: 0,
  },
  micButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
    flexShrink: 0,
  },
  micButtonActive: {
    backgroundColor: COLORS.primary,
  },
  typeToggle: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
  },
  toggleGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  toggleGradientActive: {
    borderWidth: 0,
  },
  toggleButtonActive: {
    borderColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.medium,
  },
  toggleTextActive: {
    color: COLORS.onPrimary,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  recentSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  suggestionRow: {
    gap: 12,
    paddingRight: 16,
    paddingBottom: 4,
  },
  suggestionCard: {
    width: 140,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  suggestionCardBody: {
    padding: 12,
  },
  suggestionCardName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 6,
    minHeight: 34,
  },
  suggestionCardPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  suggestionCardStall: {
    fontSize: 11.5,
    color: COLORS.text.tertiary,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  recentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  clearRecentText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  recentItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  recentItemText: {
    fontSize: 15,
    color: COLORS.text.dark,
    flex: 1,
  },
  removeRecentButton: {
    padding: 8,
  },
  noRecentContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noRecentText: {
    fontSize: 14,
    color: COLORS.text.medium,
    marginBottom: 4,
  },
  noRecentSubtext: {
    fontSize: 12,
    color: COLORS.text.lighter,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.text.medium,
    fontSize: 14,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  resultCard: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  stallIcon: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.primarySurface,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  cardInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.dark,
    marginBottom: 2,
  },
  resultStallName: {
    fontSize: 14,
    color: COLORS.text.medium,
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionBadge: {
    backgroundColor: COLORS.primarySurface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultRating: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '500',
  },
  ratingCountSmall: {
    fontSize: 10,
    color: COLORS.text.lighter,
    marginLeft: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingCount: {
    fontSize: TYPE.size.micro,
    color: COLORS.text.tertiary,
    marginLeft: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.dark,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.medium,
    textAlign: 'center',
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.brandSoft,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  comparisonHeaderLeft: {
    flex: 1,
  },
  comparisonHeaderText: {
    ...TEXT_STYLES.h2,
    color: COLORS.text.primary,
  },
  comparisonHeaderSubtext: {
    fontSize: TYPE.size.caption,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  comparisonCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderWidth: LAYOUT.borderWidth,
    borderColor: COLORS.border,
    position: 'relative',
  },
  comparisonCardBestDeal: {
    borderColor: COLORS.success,
  },
  comparisonRankCol: {
    marginRight: SPACING.sm,
    minWidth: 18,
    alignItems: 'center',
  },
  comparisonRank: {
    ...TEXT_STYLES.label,
    color: COLORS.text.tertiary,
  },
  comparisonRankBest: {
    color: COLORS.verdictBestText,
  },
  bestDealBadge: {
    marginTop: SPACING.xs,
  },
  differentUnitMarker: {
    fontSize: TYPE.size.micro,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.tertiary,
    marginTop: SPACING.xs,
  },
  comparisonTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  comparisonBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  comparisonStallInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: SPACING.sm,
  },
  comparisonStallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  comparisonStallName: {
    ...TEXT_STYLES.h3,
    color: COLORS.text.primary,
  },
  comparisonStallNumber: {
    ...TEXT_STYLES.caption,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  comparisonSection: {
    ...TEXT_STYLES.caption,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  comparisonRating: {
    ...TEXT_STYLES.caption,
    color: COLORS.text.tertiary,
  },
  comparisonPriceSection: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  originalPrice: {
    ...TEXT_STYLES.caption,
    color: COLORS.text.tertiary,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  comparisonPrice: {
    ...TEXT_STYLES.price,
    color: COLORS.text.primary,
  },
  comparisonUnit: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    color: COLORS.text.tertiary,
  },
  promoMiniBadge: {
    marginTop: SPACING.xs,
  },
  addToCartButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartButtonAdded: {
    backgroundColor: COLORS.success,
  },
});