// src/screens/customer/SearchScreen.js

import React, { useState, useEffect, useRef } from 'react';
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

const RECENT_SEARCHES_KEY = '@palengkehub_recent_searches';
const MAX_RECENT_SEARCHES = 10;

const COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  primarySurface: '#FEF2F2',
  background: '#F8F9FA',
  surface: '#FFFFFF',
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
  gold: '#F59E0B',
  shadow: 'rgba(0, 0, 0, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.12)',
};

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

// Star rating component with Ionicons
const StarRating = ({ rating, size = 12 }) => {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [productsData, setProductsData] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('products');
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecent, setShowRecent] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  const performSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);

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
          .ilike('name', `%${searchQuery}%`)
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
          setProductsData([]);
        }
      } else if (searchType === 'stalls') {
        const { data, error } = await supabase
          .from('stalls')
          .select('*')
          .or(`stall_number.ilike.%${searchQuery}%,stall_name.ilike.%${searchQuery}%,section.ilike.%${searchQuery}%`)
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
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={20} color={COLORS.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products or stalls..."
            placeholderTextColor={COLORS.text.lighter}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={COLORS.text.lighter} />
            </TouchableOpacity>
          )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  searchInputWrapper: {
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