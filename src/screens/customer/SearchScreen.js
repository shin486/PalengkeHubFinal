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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../lib/supabase';

const RECENT_SEARCHES_KEY = '@palengkehub_recent_searches';
const MAX_RECENT_SEARCHES = 10;

// Generate a stable pseudo-random rating seeded by stall id
// This ensures the same stall always gets the same "random" rating
const getStallRating = (stallId, realRating) => {
  // If there's a real rating from users, use it
  if (realRating && realRating > 0) return realRating;
  
  // Otherwise generate a deterministic random rating based on stall ID
  // This ensures the rating doesn't change every time you load the page
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  
  // Ratings between 2.5 and 5.0 stars
  const rating = 2.5 + (randomValue * 2.5);
  return Math.round(rating * 10) / 10; // Round to 1 decimal
};

// Helper function to get random rating count
const getRandomRatingCount = (stallId) => {
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  // Between 5 and 200 reviews
  return Math.floor(5 + (randomValue * 195));
};

// Helper function to get random star distribution (for visual stars)
const getStarDistribution = (rating) => {
  const fullStars = Math.floor(rating);
  const halfStar = (rating % 1) >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  return { fullStars, halfStar, emptyStars };
};

// Helper function to calculate discounted price
const getDiscountedPrice = (originalPrice, promotion) => {
  if (!promotion) return originalPrice;
  if (promotion.discount_type === 'percentage') {
    return originalPrice * (1 - promotion.discount_value / 100);
  } else {
    return Math.max(0, originalPrice - promotion.discount_value);
  }
};

// Star rating component
const StarRating = ({ rating, size = 12 }) => {
  const { fullStars, halfStar, emptyStars } = getStarDistribution(rating);
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[...Array(fullStars)].map((_, i) => (
        <Text key={`full-${i}`} style={{ fontSize: size, color: '#F59E0B' }}>★</Text>
      ))}
      {halfStar && (
        <Text style={{ fontSize: size, color: '#F59E0B' }}>½</Text>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Text key={`empty-${i}`} style={{ fontSize: size, color: '#D1D5DB' }}>★</Text>
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

  const debounceTimer = useRef(null);

  useEffect(() => {
    loadRecentSearches();
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
        // Fetch products with stall info
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
          // Fetch promotions for all products in one query
          const productIds = data.map(p => p.id);
          const now = new Date().toISOString();
          const { data: promotions } = await supabase
            .from('promotions')
            .select('*')
            .in('product_id', productIds)
            .eq('is_active', true)
            .lte('start_date', now)
            .gte('end_date', now);

          // Create a map of product_id -> promotion
          const promoMap = new Map();
          if (promotions) {
            promotions.forEach(promo => {
              promoMap.set(promo.product_id, promo);
            });
          }

          // Add promotion and discounted price to each product
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

          // Group by product name
          const grouped = {};
          productsWithPromo.forEach(product => {
            if (!grouped[product.name]) {
              grouped[product.name] = [];
            }
            grouped[product.name].push(product);
          });

          // Build flat list with headers and products, sorted by discounted price
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
      } 
      else if (searchType === 'stalls') {
        const { data, error } = await supabase
          .from('stalls')
          .select('*')
          .or(`stall_number.ilike.%${searchQuery}%,stall_name.ilike.%${searchQuery}%,section.ilike.%${searchQuery}%`)
          .order('stall_number')
          .limit(50);

        if (error) throw error;
        
        // Add randomized ratings to stalls
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
          <Text style={styles.comparisonHeaderText}>{item.name}</Text>
          <Text style={styles.comparisonHeaderSubtext}>Available from multiple stalls</Text>
        </View>
      );
    }

    const product = item.data;
    const stall = product.stalls;
    const groupItems = productsData.filter(i => i.type === 'product' && i.data.name === product.name);
    const isCheapest = groupItems.length > 0 && product.price === Math.min(...groupItems.map(i => i.data.price));
    
    // Get stall rating
    const stallRating = getStallRating(stall.id, stall.average_rating);
    const ratingCount = getRandomRatingCount(stall.id);

    return (
      <TouchableOpacity
        style={styles.comparisonCard}
        onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
        activeOpacity={0.7}
      >
        {isCheapest && (
          <View style={styles.bestDealBadge}>
            <Text style={styles.bestDealText}>Best Deal</Text>
          </View>
        )}
        <View style={styles.comparisonContent}>
          <View style={styles.comparisonStallInfo}>
            <Text style={styles.comparisonStallName}>{stall.stall_name || 'Market Stall'}</Text>
            <Text style={styles.comparisonStallNumber}>Stall #{stall.stall_number}</Text>
            <Text style={styles.comparisonSection}>{stall.section}</Text>
            <View style={styles.ratingRow}>
              <StarRating rating={stallRating} size={12} />
              <Text style={styles.comparisonRating}> {stallRating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({ratingCount} reviews)</Text>
            </View>
          </View>
          <View style={styles.comparisonPriceSection}>
            {/* Show original price with strikethrough if promotion exists */}
            {product.hasPromotion && (
              <Text style={styles.originalPrice}>₱{product.originalPrice.toFixed(2)}</Text>
            )}
            <Text style={styles.comparisonPrice}>₱{product.price.toFixed(2)}</Text>
            <Text style={styles.comparisonUnit}>per {product.unit}</Text>
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
            <Text style={styles.addToCartButtonText}>Add</Text>
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
            <Text style={styles.stallEmoji}>🏪</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.resultName}>Stall #{item.stall_number}</Text>
            <Text style={styles.resultStallName}>{item.stall_name || 'Market Stall'}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.resultSection}>{item.section}</Text>
              <View style={styles.ratingContainer}>
                <StarRating rating={displayRating} size={10} />
                <Text style={styles.resultRating}> {displayRating.toFixed(1)}</Text>
                <Text style={styles.ratingCountSmall}>({ratingCount})</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRecentSearches = () => (
    <View style={styles.recentSection}>
      <View style={styles.recentHeader}>
        <Text style={styles.recentTitle}>Recent Searches</Text>
        {recentSearches.length > 0 && (
          <TouchableOpacity onPress={clearRecentSearches}>
            <Text style={styles.clearRecentText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
      {recentSearches.length === 0 ? (
        <View style={styles.noRecentContainer}>
          <Text style={styles.noRecentText}>No recent searches</Text>
          <Text style={styles.noRecentSubtext}>Your searches will appear here</Text>
        </View>
      ) : (
        recentSearches.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.recentItem}
            onPress={() => handleRecentSearch(item)}
          >
            <View style={styles.recentItemContent}>
              <Text style={styles.recentItemIcon}>🔍</Text>
              <Text style={styles.recentItemText}>{item}</Text>
            </View>
            <TouchableOpacity
              onPress={() => removeRecentSearch(item)}
              style={styles.removeRecentButton}
            >
              <Text style={styles.removeRecentText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔍</Text>
      <Text style={styles.emptyTitle}>No results found</Text>
      <Text style={styles.emptyText}>Try searching with a different keyword</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products or stalls..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.typeToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, searchType === 'products' && styles.toggleButtonActive]}
          onPress={() => {
            setSearchType('products');
            if (searchQuery) performSearch();
          }}
        >
          <Text style={[styles.toggleText, searchType === 'products' && styles.toggleTextActive]}>
            Products
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, searchType === 'stalls' && styles.toggleButtonActive]}
          onPress={() => {
            setSearchType('stalls');
            if (searchQuery) performSearch();
          }}
        >
          <Text style={[styles.toggleText, searchType === 'stalls' && styles.toggleTextActive]}>
            Stalls
          </Text>
        </TouchableOpacity>
      </View>

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
          <ActivityIndicator size="large" color="#FF6B6B" />
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
    backgroundColor: '#F9FAFB',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
    color: '#FF6B6B',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  clearIcon: {
    fontSize: 16,
    color: '#9CA3AF',
    padding: 8,
  },
  typeToggle: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  toggleButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: 'white',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 20,
  },
  recentSection: {
    paddingHorizontal: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  clearRecentText: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recentItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentItemIcon: {
    fontSize: 16,
    marginRight: 12,
    color: '#FF6B6B',
  },
  recentItemText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  removeRecentButton: {
    padding: 8,
  },
  removeRecentText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  noRecentContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noRecentText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  noRecentSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  resultCard: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: 'white',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stallIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stallEmoji: {
    fontSize: 24,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  cardInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  resultStallName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  resultSection: {
    fontSize: 12,
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    color: '#FF6B6B',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultRating: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
  },
  ratingCountSmall: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingCount: {
    fontSize: 10,
    color: '#9CA3AF',
    marginLeft: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  comparisonHeader: {
    backgroundColor: '#FEF3F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  comparisonHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  comparisonHeaderSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  comparisonCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bestDealBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  bestDealText: {
    fontSize: 10,
    fontWeight: 'bold',
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
  comparisonStallName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  comparisonStallNumber: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  comparisonSection: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  comparisonRating: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '500',
  },
  comparisonPriceSection: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  originalPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  comparisonPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  comparisonUnit: {
    fontSize: 11,
    color: '#6B7280',
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
    color: '#DC2626',
  },
  addToCartButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  addToCartButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});