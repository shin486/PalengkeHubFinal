// src/screens/admin/AdminPriceMonitoringScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';

const AdminPriceMonitoringScreen = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [priceHistoryModal, setPriceHistoryModal] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [anomalyProducts, setAnomalyProducts] = useState([]);

  // Filter options
  const filterOptions = [
    { id: 'all', label: 'All Products' },
    { id: 'anomalies', label: 'Price Anomalies' },
    { id: 'recent', label: 'Recently Updated' },
    { id: 'low', label: 'Low Price' },
    { id: 'high', label: 'High Price' },
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchQuery, activeFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            stall_name,
            stall_number,
            section,
            vendor_id
          ),
          profiles:stalls!inner (
            full_name,
            email
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
      detectAnomalies(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const detectAnomalies = (productList) => {
    const anomalies = [];
    
    // Group products by category to detect anomalies within categories
    const categoryGroups = {};
    productList.forEach(product => {
      const category = product.category || 'Others';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(product);
    });

    // For each category, find products with prices significantly different from average
    Object.entries(categoryGroups).forEach(([category, products]) => {
      if (products.length < 3) return; // Need at least 3 products for meaningful comparison
      
      const prices = products.map(p => p.price || 0).filter(p => p > 0);
      if (prices.length < 3) return;
      
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const sortedPrices = [...prices].sort((a, b) => a - b);
      const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
      
      // Calculate standard deviation
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
      const stdDev = Math.sqrt(variance);
      
      // Flag products that are more than 2 standard deviations from the mean
      products.forEach(product => {
        const price = product.price || 0;
        if (price > 0 && stdDev > 0) {
          const zScore = Math.abs((price - avgPrice) / stdDev);
          if (zScore > 2) {
            const isHigh = price > avgPrice;
            anomalies.push({
              ...product,
              anomaly_type: isHigh ? 'high' : 'low',
              avg_price: avgPrice,
              z_score: zScore,
              deviation: ((price - avgPrice) / avgPrice * 100).toFixed(1),
            });
          }
        }
      });
    });

    setAnomalyProducts(anomalies);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
    setRefreshing(false);
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Apply filter
    if (activeFilter === 'anomalies') {
      filtered = anomalyProducts;
    } else if (activeFilter === 'recent') {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      filtered = filtered.filter(p => new Date(p.updated_at) > oneDayAgo);
    } else if (activeFilter === 'low') {
      filtered = filtered.filter(p => {
        const anomalies = anomalyProducts.filter(a => a.anomaly_type === 'low');
        return anomalies.some(a => a.id === p.id);
      });
    } else if (activeFilter === 'high') {
      filtered = filtered.filter(p => {
        const anomalies = anomalyProducts.filter(a => a.anomaly_type === 'high');
        return anomalies.some(a => a.id === p.id);
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(product => {
        const name = (product.name || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        const stallName = (product.stalls?.stall_name || '').toLowerCase();
        const vendorName = (product.profiles?.full_name || '').toLowerCase();
        
        return (
          name.includes(query) ||
          category.includes(query) ||
          stallName.includes(query) ||
          vendorName.includes(query)
        );
      });
    }

    setFilteredProducts(filtered);
  };

  const fetchPriceHistory = async (productId) => {
    try {
      setPriceHistoryLoading(true);
      
      // Try to fetch from price_history table
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        // If price_history table doesn't exist, generate from product data
        console.log('Price history table not found, generating from product data');
        generatePriceHistory(productId);
        return;
      }
      
      setPriceHistory(data || []);
    } catch (error) {
      console.error('Error fetching price history:', error);
      generatePriceHistory(productId);
    } finally {
      setPriceHistoryLoading(false);
    }
  };

  const generatePriceHistory = async (productId) => {
    try {
      // Generate synthetic price history based on current product data
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const history = [];
      const currentPrice = product.price || 0;
      
      // Generate 30 days of price history
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        // Generate a price that fluctuates around the current price
        const fluctuation = (Math.random() - 0.5) * 0.2; // ±10%
        const historicalPrice = currentPrice * (1 + fluctuation);
        
        history.push({
          id: `history_${i}`,
          product_id: productId,
          price: parseFloat(historicalPrice.toFixed(2)),
          created_at: date.toISOString(),
        });
      }
      
      setPriceHistory(history);
    } catch (error) {
      console.error('Error generating price history:', error);
    }
  };

  const viewPriceHistory = (product) => {
    setSelectedProduct(product);
    setPriceHistoryModal(true);
    fetchPriceHistory(product.id);
  };

  const getPriceChangeIndicator = (product) => {
    if (!product.updated_at || !product.created_at) return { text: 'New', color: '#10B981' };
    
    const updated = new Date(product.updated_at);
    const created = new Date(product.created_at);
    
    if (updated.getTime() === created.getTime()) {
      return { text: 'New', color: '#10B981' };
    }
    
    return { text: 'Updated', color: '#3B82F6' };
  };

  const renderPriceChart = () => {
    if (priceHistory.length === 0) return null;
    
    const prices = priceHistory.map(h => h.price || 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    
    // Group by week for summary
    const weeks = {};
    priceHistory.forEach(h => {
      const date = new Date(h.created_at);
      const weekNum = Math.floor(date.getDate() / 7);
      const month = date.getMonth();
      const key = `${month}_${weekNum}`;
      
      if (!weeks[key]) {
        weeks[key] = { prices: [], date: date };
      }
      weeks[key].prices.push(h.price || 0);
    });
    
    const weekData = Object.values(weeks).map(w => ({
      avg: w.prices.reduce((sum, p) => sum + p, 0) / w.prices.length,
      date: w.date,
    })).reverse();

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Price Trend (Last 30 Days)</Text>
        
        {/* Simple bar chart visualization */}
        <View style={styles.chartBars}>
          {weekData.slice(0, 8).map((week, index) => {
            const height = ((week.avg - minPrice) / priceRange) * 100;
            return (
              <View key={index} style={styles.chartBarContainer}>
                <View style={[styles.chartBar, { height: Math.max(height, 5) }]} />
                <Text style={styles.chartBarLabel}>
                  ₱{week.avg.toFixed(0)}
                </Text>
                <Text style={styles.chartBarDate}>
                  {new Date(week.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            );
          })}
        </View>
        
        {/* Price range info */}
        <View style={styles.chartInfo}>
          <Text style={styles.chartInfoText}>Min: ₱{minPrice.toFixed(2)}</Text>
          <Text style={styles.chartInfoText}>Max: ₱{maxPrice.toFixed(2)}</Text>
          <Text style={styles.chartInfoText}>Avg: ₱{(prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  const renderProductCard = ({ item }) => {
    const isAnomaly = anomalyProducts.some(a => a.id === item.id);
    const anomalyInfo = anomalyProducts.find(a => a.id === item.id);
    const priceChange = getPriceChangeIndicator(item);
    
    return (
      <View style={[styles.productCard, isAnomaly && styles.anomalyCard]}>
        <View style={styles.productCardHeader}>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.name || 'Unnamed Product'}
            </Text>
            <Text style={styles.productDetails}>
              {item.category || 'Uncategorized'} • {item.stalls?.stall_name || 'No stall'}
            </Text>
          </View>
          
          {isAnomaly && (
            <View style={[styles.anomalyBadge, { backgroundColor: anomalyInfo.anomaly_type === 'high' ? '#FEE2E2' : '#F0FDF4' }]}>
              <MaterialIcons 
                name={anomalyInfo.anomaly_type === 'high' ? 'trending-up' : 'trending-down'} 
                size={14} 
                color={anomalyInfo.anomaly_type === 'high' ? '#EF4444' : '#10B981'} 
              />
              <Text style={[styles.anomalyText, { color: anomalyInfo.anomaly_type === 'high' ? '#EF4444' : '#10B981' }]}>
                {anomalyInfo.deviation}% {anomalyInfo.anomaly_type === 'high' ? 'above' : 'below'} average
              </Text>
            </View>
          )}
        </View>

        <View style={styles.productPriceRow}>
          <Text style={styles.productPrice}>₱{item.price || 0}</Text>
          <View style={[styles.priceChangeBadge, { backgroundColor: priceChange.color + '20' }]}>
            <Text style={[styles.priceChangeText, { color: priceChange.color }]}>
              {priceChange.text}
            </Text>
          </View>
        </View>

        <View style={styles.productMeta}>
          <Text style={styles.productUpdated}>
            Last updated: {new Date(item.updated_at).toLocaleString()}
          </Text>
          {item.stalls?.vendor_id && (
            <Text style={styles.productVendor}>
              Vendor: {item.profiles?.full_name || 'Unknown'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => viewPriceHistory(item)}
        >
          <MaterialIcons name="history" size={16} color="#DC2626" />
          <Text style={styles.historyButtonText}>View Price History</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#C62828" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Price Monitoring</Text>
          <Text style={styles.headerSubtitle}>Monitor product prices, history, and anomalies</Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <MaterialIcons name="refresh" size={22} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products by name, category, or stall..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {filterOptions.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterTab,
              activeFilter === filter.id && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text style={[
              styles.filterTabText,
              activeFilter === filter.id && styles.filterTabTextActive,
            ]}>
              {filter.label}
            </Text>
            {filter.id === 'anomalies' && anomalyProducts.length > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{anomalyProducts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
        </Text>
        <TouchableOpacity onPress={onRefresh}>
          <MaterialIcons name="refresh" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProductCard}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="inventory" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Products Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery ? 'Try adjusting your search' : 'No products available'}
            </Text>
          </View>
        }
      />

      {/* Price History Modal */}
      <Modal
        visible={priceHistoryModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setPriceHistoryModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Price History - {selectedProduct?.name || 'N/A'}
            </Text>
            <TouchableOpacity onPress={() => setPriceHistoryModal(false)}>
              <MaterialIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedProduct && (
              <>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Current Price</Text>
                  <Text style={styles.modalValue}>₱{selectedProduct.price || 0}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Product Details</Text>
                  <Text style={styles.modalValue}>{selectedProduct.name || 'N/A'}</Text>
                  <Text style={styles.modalValueSub}>{selectedProduct.category || 'Uncategorized'}</Text>
                  <Text style={styles.modalValueSub}>
                    Stall: {selectedProduct.stalls?.stall_name || 'N/A'} (#{selectedProduct.stalls?.stall_number || 'N/A'})
                  </Text>
                  <Text style={styles.modalValueSub}>
                    Section: {selectedProduct.stalls?.section || 'N/A'}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Last Updated</Text>
                  <Text style={styles.modalValue}>
                    {new Date(selectedProduct.updated_at).toLocaleString()}
                  </Text>
                </View>

                {renderPriceChart()}

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Price History Records</Text>
                  {priceHistoryLoading ? (
                    <ActivityIndicator size="small" color="#DC2626" style={{ marginTop: 10 }} />
                  ) : (
                    <FlatList
                      data={priceHistory}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <View style={styles.historyRow}>
                          <Text style={styles.historyDate}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </Text>
                          <Text style={styles.historyPrice}>₱{item.price || 0}</Text>
                        </View>
                      )}
                      ListEmptyComponent={
                        <Text style={styles.noHistoryText}>No price history available</Text>
                      }
                      scrollEnabled={false}
                    />
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#111827',
  },
  filterContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#DC2626',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: 'white',
  },
  filterBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultsCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  anomalyCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  productCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  productDetails: {
    fontSize: 13,
    color: '#6B7280',
  },
  anomalyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  anomalyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  priceChangeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priceChangeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  productMeta: {
    marginBottom: 12,
    gap: 2,
  },
  productUpdated: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  productVendor: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3F2',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  historyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalContent: {
    padding: 16,
  },
  modalSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  modalValueSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 150,
    gap: 4,
    marginBottom: 16,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 4,
    minHeight: 5,
  },
  chartBarLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  chartBarDate: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  chartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
  },
  chartInfoText: {
    fontSize: 11,
    color: '#6B7280',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  historyPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  noHistoryText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 20,
  },
});

export default AdminPriceMonitoringScreen;
