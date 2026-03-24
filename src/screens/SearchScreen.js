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
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

const RECENT_SEARCHES_KEY = '@palengkehub_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export default function SearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
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
      setProducts([]);
      setStalls([]);
    }
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

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
            *,
            stalls (
              stall_number,
              stall_name,
              section
            )
          `)
          .ilike('name', `%${searchQuery}%`)
          .eq('is_available', true)
          .order('name')
          .limit(50);

        if (error) throw error;
        setProducts(data || []);
        setStalls([]);
      } else {
        const { data, error } = await supabase
          .from('stalls')
          .select('*')
          .or(`stall_number.ilike.%${searchQuery}%,stall_name.ilike.%${searchQuery}%,section.ilike.%${searchQuery}%`)
          .order('stall_number')
          .limit(50);

        if (error) throw error;
        setStalls(data || []);
        setProducts([]);
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

  const renderProductCard = ({ item }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.productIcon}>
          <Text style={styles.productEmoji}>🛒</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.resultName}>{item.name}</Text>
          <Text style={styles.resultPrice}>₱{item.price} / {item.unit}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.resultStall}>Stall {item.stalls?.stall_number}</Text>
            <Text style={styles.resultCategory}>{item.category}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderStallCard = ({ item }) => (
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
            {item.average_rating > 0 && (
              <Text style={styles.resultRating}>⭐ {item.average_rating.toFixed(1)}</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

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
      <Text style={styles.emptyText}>
        Try searching with a different keyword
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Search Input - Simple and clean */}
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

      {/* Search Type Toggle */}
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

      {/* Results Area */}
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
      ) : (
        <FlatList
          data={searchType === 'products' ? products : stalls}
          keyExtractor={(item) => item.id.toString()}
          renderItem={searchType === 'products' ? renderProductCard : renderStallCard}
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
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  productIcon: {
    width: 50,
    height: 50,
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  productEmoji: {
    fontSize: 24,
  },
  stallEmoji: {
    fontSize: 24,
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
  resultPrice: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
    marginBottom: 4,
  },
  resultStallName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  resultStall: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  resultCategory: {
    fontSize: 12,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    color: '#6B7280',
  },
  resultSection: {
    fontSize: 12,
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    color: '#FF6B6B',
  },
  resultRating: {
    fontSize: 12,
    color: '#F59E0B',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
});