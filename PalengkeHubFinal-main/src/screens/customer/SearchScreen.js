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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { startListening, stopListening, isVoiceInputSupported } from '../../services/voiceService';

const RECENT_SEARCHES_KEY = '@palengkehub_recent_searches';
const MAX_RECENT_SEARCHES = 10;

// Generate a stable pseudo-random rating seeded by stall id
const getStallRating = (stallId, realRating) => {
  if (realRating && realRating > 0) return realRating;
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  const rating = 2.5 + (randomValue * 2.5);
  return Math.round(rating * 10) / 10;
};

const getRandomRatingCount = (stallId) => {
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  return Math.floor(5 + (randomValue * 195));
};

const getStarDistribution = (rating) => {
  const fullStars = Math.floor(rating);
  const halfStar = (rating % 1) >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  return { fullStars, halfStar, emptyStars };
};

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

// ── Tagalog → English product synonyms (for elderly users searching in Tagalog) ──
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

export default function SearchScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Stop any active voice session when leaving the screen
  useEffect(() => () => { stopListening(); }, []);
  const [productsData, setProductsData] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('products');
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecent, setShowRecent] = useState(true);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [suggestion, setSuggestion] = useState(null);

  const debounceTimer = useRef(null);

  useEffect(() => {
    loadRecentSearches();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

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

  const clearRecentSearches = () => {
    Alert.alert(
      'Clear Recent Searches',
      'Are you sure you want to clear all recent searches?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setRecentSearches([]);
            await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
          }
        }
      ]
    );
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
    performSearch(suggestedName);
  };

  // Voice search — speak in Tagalog or English and the results update live
  const handleVoiceSearch = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }
    if (!isVoiceInputSupported()) {
      Alert.alert(
        'Voice Search',
        'Voice search is not supported in this browser. Please type your search instead.',
      );
      return;
    }
    setIsListening(true);
    const started = startListening({
      language: 'tl-PH',
      onResult: (text, isFinal) => {
        if (!text) return;
        setSearchQuery(text.trim());
        if (isFinal) {
          setIsListening(false);
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
            'Microphone access was blocked. Please allow microphone permission in your browser and try again.',
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
            stall_id,
            stalls!inner (
              id,
              stall_number,
              stall_name,
              section,
              average_rating
            )
          `)
          .or(buildSearchFilter(searchTerm))
          .eq('is_available', true);

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
            variants.sort((a, b) => a.price - b.price);
            results.push({ type: 'header', name: productName });
            variants.forEach(variant => {
              results.push({ type: 'product', data: variant });
            });
          }
          setProductsData(results);
        } else {
          // No exact match — try to find a close match ("Did you mean?")
          const closest = await findClosestProductName(searchTerm);
          if (closest && closest !== searchTerm.toLowerCase()) {
            setSuggestion(closest);
            // Show the corrected products below (same shape as normal search)
            const { data: correctedData } = await supabase
              .from('products')
              .select(`
                id, name, price, unit, stall_id,
                stalls!inner (id, stall_number, stall_name, section, average_rating)
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
                variants.sort((a, b) => a.price - b.price);
                results.push({ type: 'header', name: productName });
                variants.forEach(variant => {
                  results.push({ type: 'product', data: variant });
                });
              }
              setProductsData(results);
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
          .or(`stall_number.ilike.%${searchTerm}%,stall_name.ilike.%${searchTerm}%,section.ilike.%${searchTerm}%`)
          .order('stall_number')
          .limit(50);

        if (error) throw error;
        
        const stallsWithRatings = (data || []).map(stall => ({
          ...stall,
          displayRating: getStallRating(stall.id, stall.average_rating),
          ratingCount: getRandomRatingCount(stall.id)
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
      saveRecentSearch(searchQuery.trim());
      performSearch();
    }
  };

  const handleRecentSearch = (query) => {
    setSearchQuery(query);
    setShowRecent(false);
    saveRecentSearch(query);
    setTimeout(() => performSearch(), 100);
  };

  const addToCartFromComparison = async (product, stall) => {
    Alert.alert(
      'Add to Cart',
      `Add ${product.name} to cart from ${stall?.stall_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'View Product',
          onPress: () => navigation.navigate('ProductDetails', { productId: product.id })
        }
      ]
    );
  };

  const renderProductComparisonItem = ({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.comparisonHeader}>
          <View style={styles.comparisonHeaderLeft}>
            <Text style={styles.comparisonHeaderText}>{item.name}</Text>
            <Text style={styles.comparisonHeaderSubtext}>Available from multiple stalls</Text>
          </View>
          <View style={styles.comparisonHeaderBadge}>
            <Text style={styles.comparisonHeaderBadgeText}>
              {productsData.filter(i => i.type === 'product' && i.data.name === item.name).length} stalls
            </Text>
          </View>
        </View>
      );
    }

    const product = item.data;
    const stall = product.stalls;
    const groupItems = productsData.filter(i => i.type === 'product' && i.data.name === product.name);
    const isCheapest = groupItems.length > 0 && product.price === Math.min(...groupItems.map(i => i.data.price));
    
    const stallRating = getStallRating(stall.id, stall.average_rating);
    const ratingCount = getRandomRatingCount(stall.id);

    return (
      <TouchableOpacity
        style={[styles.comparisonCard, isCheapest && styles.comparisonCardBestDeal]}
        onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
        activeOpacity={0.7}
      >
        {isCheapest && (
          <View style={styles.bestDealBadge}>
            <Ionicons name="ribbon" size={12} color="#FFFFFF" />
            <Text style={styles.bestDealText}>Best Deal</Text>
          </View>
        )}
        <View style={styles.comparisonContent}>
          <View style={styles.comparisonStallInfo}>
            <View style={styles.comparisonStallHeader}>
              <Ionicons name="storefront-outline" size={14} color={COLORS.primary} />
              <Text style={styles.comparisonStallName}>{stall.stall_name || 'Market Stall'}</Text>
            </View>
            <Text style={styles.comparisonStallNumber}>Stall #{stall.stall_number}</Text>
            <Text style={styles.comparisonSection}>{stall.section}</Text>
            <View style={styles.ratingRow}>
              <StarRating rating={stallRating} size={12} />
              <Text style={styles.comparisonRating}> {stallRating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({ratingCount} reviews)</Text>
            </View>
          </View>
          <View style={styles.comparisonPriceSection}>
            {product.hasPromotion && (
              <Text style={styles.originalPrice}>₱{product.originalPrice.toFixed(2)}</Text>
            )}
            <Text style={[styles.comparisonPrice, isCheapest && styles.comparisonPriceBest]}>
              ₱{product.price.toFixed(2)}
            </Text>
            <Text style={styles.comparisonUnit}>/ {product.unit}</Text>
            {product.hasPromotion && (
              <View style={styles.promoMiniBadge}>
                <Text style={styles.promoMiniText}>
                  {product.promotion?.discount_type === 'percentage'
                    ? `${product.promotion.discount_value}% OFF`
                    : `₱${product.promotion.discount_value} OFF`}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={() => addToCartFromComparison(product, stall)}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStallCard = ({ item }) => {
    const displayRating = item.displayRating || getStallRating(item.id, item.average_rating);
    const ratingCount = item.ratingCount || getRandomRatingCount(item.id);
    
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
            <Text style={styles.resultName}>Stall #{item.stall_number}</Text>
            <Text style={styles.resultStallName}>{item.stall_name || 'Market Stall'}</Text>
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

  const renderRecentSearches = () => (
    <Animated.View style={[styles.recentSection, { opacity: fadeAnim }]}>
      <View style={styles.recentHeader}>
        <View style={styles.recentHeaderLeft}>
          <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          <Text style={styles.recentTitle}>Recent Searches</Text>
        </View>
        {recentSearches.length > 0 && (
          <TouchableOpacity onPress={clearRecentSearches} activeOpacity={0.7}>
            <Text style={styles.clearRecentText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
      {recentSearches.length === 0 ? (
        <View style={styles.noRecentContainer}>
          <Ionicons name="search-outline" size={48} color={COLORS.text.lighter} />
          <Text style={styles.noRecentText}>No recent searches</Text>
          <Text style={styles.noRecentSubtext}>Your searches will appear here</Text>
        </View>
      ) : (
        recentSearches.map((item, index) => (
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
        ))
      )}
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="search-outline" size={56} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>No results found</Text>
      <Text style={styles.emptyText}>Try searching with a different keyword</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

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
              placeholder={isListening ? 'Listening... speak now (Tagalog or English)' : 'Search products or stalls...'}
              placeholderTextColor={isListening ? COLORS.primary : COLORS.text.lighter}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
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
          <LinearGradient
            colors={searchType === 'products' ? [COLORS.primary, COLORS.primaryLight] : ['transparent', 'transparent']}
            style={[styles.toggleGradient, searchType === 'products' && styles.toggleGradientActive]}
          >
            <Ionicons name="cube-outline" size={16} color={searchType === 'products' ? '#FFFFFF' : COLORS.text.medium} />
            <Text style={[styles.toggleText, searchType === 'products' && styles.toggleTextActive]}>
              Products
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, searchType === 'stalls' && styles.toggleButtonActive]}
          onPress={() => {
            setSearchType('stalls');
            if (searchQuery) performSearch();
          }}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={searchType === 'stalls' ? [COLORS.primary, COLORS.primaryLight] : ['transparent', 'transparent']}
            style={[styles.toggleGradient, searchType === 'stalls' && styles.toggleGradientActive]}
          >
            <Ionicons name="storefront-outline" size={16} color={searchType === 'stalls' ? '#FFFFFF' : COLORS.text.medium} />
            <Text style={[styles.toggleText, searchType === 'stalls' && styles.toggleTextActive]}>
              Stalls
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* "Did you mean?" suggestion banner */}
      {suggestion && (
        <View style={styles.suggestionBanner}>
          <Ionicons name="bulb-outline" size={18} color={COLORS.warning} />
          <Text style={styles.suggestionText}>
            Did you mean <Text style={styles.suggestionHighlight}>"{suggestion}"</Text>?
          </Text>
          <TouchableOpacity
            style={styles.suggestionButton}
            onPress={() => applySuggestion(suggestion)}
            activeOpacity={0.8}
          >
            <Text style={styles.suggestionButtonText}>Search</Text>
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
        </ScrollView>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searchType === 'products' ? (
        <FlatList
          data={productsData}
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
    </SafeAreaView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    color: '#B45309',
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
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 16,
    color: COLORS.text.dark,
  },
  clearButton: {
    padding: 4,
  },
  micButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
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
    color: COLORS.text.white,
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
    fontSize: 10,
    color: COLORS.text.lighter,
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
    backgroundColor: COLORS.primarySurface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  comparisonHeaderLeft: {
    flex: 1,
  },
  comparisonHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  comparisonHeaderSubtext: {
    fontSize: 12,
    color: COLORS.text.medium,
    marginTop: 2,
  },
  comparisonHeaderBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  comparisonHeaderBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.primary,
  },
  comparisonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    position: 'relative',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  comparisonCardBestDeal: {
    borderColor: COLORS.success,
    borderWidth: 1.5,
  },
  bestDealBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
    gap: 4,
  },
  bestDealText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  comparisonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comparisonStallInfo: {
    flex: 2,
  },
  comparisonStallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  comparisonStallName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  comparisonStallNumber: {
    fontSize: 12,
    color: COLORS.text.medium,
    marginTop: 2,
  },
  comparisonSection: {
    fontSize: 11,
    color: COLORS.text.lighter,
    marginTop: 2,
  },
  comparisonRating: {
    fontSize: 11,
    color: COLORS.gold,
    fontWeight: '500',
  },
  comparisonPriceSection: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  originalPrice: {
    fontSize: 12,
    color: COLORS.text.lighter,
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  comparisonPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  comparisonPriceBest: {
    color: COLORS.success,
  },
  comparisonUnit: {
    fontSize: 11,
    color: COLORS.text.medium,
  },
  promoMiniBadge: {
    marginTop: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  promoMiniText: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.primary,
  },
  addToCartButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
});