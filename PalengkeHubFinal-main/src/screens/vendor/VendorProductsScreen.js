// src/screens/vendor/VendorProductsScreen.js

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorProducts } from '../../hooks/useVendorProducts';
import { ModernProductCard } from '../../components/vendor/ModernProductCard';
import { AddProductModal } from '../../components/vendor/AddProductModal';
import { VendorSkeletonList } from '../../components/vendor/VendorLoadingState';
import { VendorEmptyState } from '../../components/vendor/VendorEmptyState';

// ============================================================
// COLORS - Matches Customer Side
// ============================================================
const COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  primarySurface: '#FEF2F2',
  background: '#F8F9FB',
  surface: '#FFFFFF',
  text: {
    dark: '#1F2937',
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
  info: '#3B82F6',
  purple: '#7C3AED',
  shadow: 'rgba(0, 0, 0, 0.06)',
  shadowDark: 'rgba(0, 0, 0, 0.10)',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

const FILTERS = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'available', label: 'Available', icon: 'checkmark-circle-outline' },
  { key: 'unavailable', label: 'Hidden', icon: 'eye-off-outline' },
  { key: 'low_stock', label: 'Low Stock', icon: 'warning-outline' },
  { key: 'out_of_stock', label: 'Out of Stock', icon: 'close-circle-outline' },
];

const checkStock = (product) => {
  const qty = product.stock_quantity || 0;
  if (qty <= 0) return 'out_of_stock';
  if (qty <= (product.low_stock_threshold || 5)) return 'low_stock';
  return 'in_stock';
};

export default function VendorProductsScreen({ navigation }) {
  const { user } = useAuth();
  const [stall, setStall] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStall = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select('id, stall_number, stall_name')
        .eq('vendor_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setStall(data);
    } catch (error) {
      console.error('Error fetching stall:', error);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchStall();
    }, [fetchStall])
  );

  const {
    products,
    loading,
    error: productsError,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleAvailability,
    refreshProducts,
  } = useVendorProducts(stall?.id);

  const filteredProducts = useMemo(() => {
    if (activeFilter === 'all') return products;
    if (activeFilter === 'available') return products.filter(p => p.is_available);
    if (activeFilter === 'unavailable') return products.filter(p => !p.is_available);
    if (activeFilter === 'low_stock') return products.filter(p => p.is_available && checkStock(p) === 'low_stock');
    if (activeFilter === 'out_of_stock') return products.filter(p => p.is_available && checkStock(p) === 'out_of_stock');
    return products;
  }, [products, activeFilter]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      available: products.filter(p => p.is_available).length,
      hidden: products.filter(p => !p.is_available).length,
      lowStock: products.filter(p => p.is_available && checkStock(p) === 'low_stock').length,
      outOfStock: products.filter(p => p.is_available && checkStock(p) === 'out_of_stock').length,
    };
  }, [products]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProducts(), fetchStall()]);
    setRefreshing(false);
  };

  const handleAddProduct = async (productData) => {
    const success = await addProduct(productData);
    if (success) setShowAddModal(false);
  };

  const handleUpdateProduct = async (productData) => {
    if (!editingProduct) return;
    const success = await updateProduct(editingProduct.id, productData);
    if (success) setEditingProduct(null);
  };

  // ✅ Get icon and color for stat cards
  const getStatConfig = (key) => {
    const configs = {
      total: { icon: 'cube-outline', color: COLORS.primary, bg: COLORS.primarySurface },
      available: { icon: 'checkmark-circle-outline', color: COLORS.success, bg: '#D1FAE5' },
      lowStock: { icon: 'warning-outline', color: COLORS.warning, bg: '#FEF3C7' },
      outOfStock: { icon: 'close-circle-outline', color: COLORS.error, bg: '#FEE2E2' },
    };
    return configs[key] || configs.total;
  };

  // ✅ Get icon for filter
  const getFilterIcon = (key) => {
    const icons = {
      'all': 'grid-outline',
      'available': 'checkmark-circle-outline',
      'unavailable': 'eye-off-outline',
      'low_stock': 'warning-outline',
      'out_of_stock': 'close-circle-outline',
    };
    return icons[key] || 'grid-outline';
  };

  // ✅ Get filter icon color
  const getFilterIconColor = (key, isActive) => {
    if (isActive) return '#FFFFFF';
    const colors = {
      'all': COLORS.primary,
      'available': COLORS.success,
      'unavailable': COLORS.text.light,
      'low_stock': COLORS.warning,
      'out_of_stock': COLORS.error,
    };
    return colors[key] || COLORS.text.medium;
  };

  return (
    <View style={styles.container}>
      <Header title="Products" subtitle={stall?.stall_name || 'Manage your inventory'} />

      {/* Stats Overview - No Emojis */}
      <View style={styles.statsRow}>
        {['total', 'available', 'lowStock', 'outOfStock'].map((key) => {
          const config = getStatConfig(key);
          const value = stats[key] || 0;
          const label = key === 'total' ? 'Total' : key === 'available' ? 'Available' : key === 'lowStock' ? 'Low Stock' : 'Out of Stock';
          
          return (
            <View key={key} style={styles.statCard}>
              <View style={[styles.statIconWrapper, { backgroundColor: config.bg }]}>
                <Ionicons name={config.icon} size={16} color={config.color} />
              </View>
              <Text style={[styles.statValue, { color: config.color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          );
        })}
      </View>

      {/* Filter Tabs - No Emojis */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            const iconColor = getFilterIconColor(filter.key, isActive);
            
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={filter.icon} size={14} color={iconColor} />
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Add Product Button */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add New Product</Text>
        </TouchableOpacity>
      </View>

      {/* Products List */}
      {loading ? (
        <VendorSkeletonList count={4} />
      ) : productsError ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          </View>
          <Text style={styles.emptyTitle}>Failed to load products</Text>
          <Text style={styles.emptyText}>{productsError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshProducts}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="cube-outline" size={48} color={COLORS.text.lighter} />
          </View>
          <Text style={styles.emptyTitle}>
            {products.length === 0 ? 'No products yet' : `No ${activeFilter.replace('_', ' ')} products`}
          </Text>
          <Text style={styles.emptyText}>
            {products.length === 0
              ? 'Tap "Add New Product" to start selling'
              : 'No products match this filter'}
          </Text>
          {products.length === 0 && (
            <TouchableOpacity style={styles.emptyAddButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyAddButtonText}>Add Product</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ModernProductCard
              product={item}
              onToggleAvailability={toggleAvailability}
              onEdit={setEditingProduct}
              onDelete={deleteProduct}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <AddProductModal visible={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddProduct} />
      <AddProductModal
        visible={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        onSubmit={handleUpdateProduct}
        editingProduct={editingProduct}
      />
    </View>
  );
}

// ============================================================
// STYLES - Matches Customer Side
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Stats Row ──
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  statIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.text.light,
    marginTop: 2,
    fontWeight: '500',
  },

  // ── Filter Tabs ──
  filterWrapper: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.medium,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },

  // ── Add Button ──
  addButtonContainer: {
    padding: SPACING.lg,
    paddingBottom: 0,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── List ──
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.light,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyAddButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});