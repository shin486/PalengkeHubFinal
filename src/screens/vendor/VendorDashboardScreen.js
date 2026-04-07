// src/screens/vendor/VendorDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorProducts } from '../../hooks/useVendorProducts';
import { useVendorOrders } from '../../hooks/useVendorOrders';
import { ProductCard } from '../../components/vendor/ProductCard';
import { OrderCard } from '../../components/vendor/OrderCard';
import { AddProductModal } from '../../components/vendor/AddProductModal';
import { StatsCard } from '../../components/vendor/StatsCard';
import { SalesChart } from '../../components/vendor/SalesChart';
import { Header } from '../../components/Header';

const { width } = Dimensions.get('window');

export default function VendorDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [stall, setStall] = useState(null);
  const [loadingStall, setLoadingStall] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [salesSummary, setSalesSummary] = useState({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
    ordersToday: 0,
    ordersWeek: 0,
    ordersMonth: 0
  });

  // Fetch stall
  useEffect(() => {
    if (user) {
      fetchStall();
    }
  }, [user]);

  const fetchStall = async () => {
    try {
      setLoadingStall(true);
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .eq('vendor_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setStall(data);
    } catch (error) {
      console.error('Error fetching stall:', error);
    } finally {
      setLoadingStall(false);
    }
  };

  // Fetch sales data for chart
  const fetchSalesData = useCallback(async () => {
    if (!stall?.id) return;

    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('stall_id', stall.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      if (!orders) return;

      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dayOrders = orders.filter(order => {
          const orderDate = new Date(order.created_at);
          orderDate.setHours(0, 0, 0, 0);
          return orderDate.getTime() === date.getTime();
        });
        
        const dayTotal = dayOrders.reduce((sum, o) => sum + o.total_amount, 0);
        
        last7Days.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: dayTotal,
          orders: dayOrders.length
        });
      }
      setSalesData(last7Days);

      const now = new Date();
      const today = new Date(now.setHours(0, 0, 0, 0));
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));

      const todayOrders = orders.filter(o => new Date(o.created_at) >= today);
      const weekOrders = orders.filter(o => new Date(o.created_at) >= weekAgo);
      const monthOrders = orders.filter(o => new Date(o.created_at) >= monthAgo);

      setSalesSummary({
        today: todayOrders.reduce((sum, o) => sum + o.total_amount, 0),
        week: weekOrders.reduce((sum, o) => sum + o.total_amount, 0),
        month: monthOrders.reduce((sum, o) => sum + o.total_amount, 0),
        total: orders.reduce((sum, o) => sum + o.total_amount, 0),
        ordersToday: todayOrders.length,
        ordersWeek: weekOrders.length,
        ordersMonth: monthOrders.length
      });

    } catch (error) {
      console.error('Error fetching sales data:', error);
    }
  }, [stall]);

  // Check low stock items
  const checkLowStock = useCallback(async () => {
    if (!stall?.id) return;

    try {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('stall_id', stall.id)
        .not('stock_quantity', 'is', null);

      const lowStock = products.filter(p => p.stock_quantity <= 5 && p.stock_quantity > 0);
      const outOfStock = products.filter(p => p.stock_quantity === 0);
      
      setLowStockItems([...lowStock, ...outOfStock]);
      
      if (lowStock.length > 0 || outOfStock.length > 0) {
        if (outOfStock.length > 0) {
          Alert.alert(
            '⚠️ Out of Stock Alert',
            `${outOfStock.length} product(s) are out of stock. Update your inventory.`,
            [{ text: 'View', onPress: () => setActiveTab('inventory') }]
          );
        } else if (lowStock.length > 0) {
          Alert.alert(
            '⚠️ Low Stock Alert',
            `${lowStock.length} product(s) are running low. Consider restocking soon.`,
            [{ text: 'View', onPress: () => setActiveTab('inventory') }]
          );
        }
      }
    } catch (error) {
      console.error('Error checking stock:', error);
    }
  }, [stall]);

  // Vendor hooks
  const {
    products,
    loading: productsLoading,
    addProduct,
    updateProduct,
    toggleAvailability,
    deleteProduct,
    refreshProducts,
  } = useVendorProducts(stall?.id);

  const {
    orders,
    loading: ordersLoading,
    orderStats,
    updateOrderStatus,
    refreshOrders,
  } = useVendorOrders(stall?.id);

  // Refresh data on focus
  useFocusEffect(
    useCallback(() => {
      if (stall?.id) {
        fetchSalesData();
        checkLowStock();
      }
    }, [stall, fetchSalesData, checkLowStock])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProducts(), refreshOrders(), fetchStall(), fetchSalesData(), checkLowStock()]);
    setRefreshing(false);
  };

  const handleAddProduct = async (productData) => {
    const success = await addProduct(productData);
    if (success) setShowAddModal(false);
  };

  const handleUpdateProduct = async (productData) => {
    const success = await updateProduct(editingProduct.id, productData);
    if (success) setEditingProduct(null);
  };

  // ========== LOGOUT FUNCTION - WORKS ON BOTH MOBILE AND WEB ==========
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // For web - force page reload to login
              if (Platform.OS === 'web') {
                window.location.href = '/';
              } else {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
            } catch (error) {
              console.error('Logout error:', error);
              if (Platform.OS === 'web') {
                window.location.href = '/';
              } else {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }
            }
          }
        }
      ]
    );
  };

  if (loadingStall) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading your stall...</Text>
      </SafeAreaView>
    );
  }

  if (!stall) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>🏪</Text>
        <Text style={styles.emptyTitle}>No Stall Assigned</Text>
        <Text style={styles.emptyText}>Contact administrator to get your stall registered</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const renderContent = () => {
    if (activeTab === 'products') {
      return (
        <>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.addGradient}>
              <Text style={styles.addButtonText}>+ Add New Product</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Products ({products.length})</Text>
            {productsLoading ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : products.length === 0 ? (
              <Text style={styles.emptyText}>No products yet. Add your first product!</Text>
            ) : (
              products.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onToggleAvailability={toggleAvailability}
                  onEdit={setEditingProduct}
                  onDelete={deleteProduct}
                />
              ))
            )}
          </View>
        </>
      );
    }

    if (activeTab === 'orders') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Active Orders ({orderStats.active.length})
          </Text>
          {ordersLoading ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : orderStats.active.length === 0 ? (
            <View style={styles.emptyOrdersContainer}>
              <Text style={styles.emptyOrdersIcon}>📭</Text>
              <Text style={styles.emptyOrdersText}>No active orders</Text>
              <Text style={styles.emptyOrdersSubtext}>
                New orders will appear here
              </Text>
            </View>
          ) : (
            orderStats.active.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={updateOrderStatus}
              />
            ))
          )}
        </View>
      );
    }

    if (activeTab === 'analytics') {
      return (
        <ScrollView>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sales Overview</Text>
            <View style={styles.summaryCards}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>₱{salesSummary.today.toFixed(2)}</Text>
                <Text style={styles.summaryLabel}>Today</Text>
                <Text style={styles.summarySubtext}>{salesSummary.ordersToday} orders</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>₱{salesSummary.week.toFixed(2)}</Text>
                <Text style={styles.summaryLabel}>This Week</Text>
                <Text style={styles.summarySubtext}>{salesSummary.ordersWeek} orders</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>₱{salesSummary.month.toFixed(2)}</Text>
                <Text style={styles.summaryLabel}>This Month</Text>
                <Text style={styles.summarySubtext}>{salesSummary.ordersMonth} orders</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>₱{salesSummary.total.toFixed(2)}</Text>
                <Text style={styles.summaryLabel}>Total Sales</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Sales (Last 7 Days)</Text>
            <SalesChart data={salesData} />
          </View>
        </ScrollView>
      );
    }

    if (activeTab === 'inventory') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory Management</Text>
          
          {lowStockItems.length > 0 && (
            <View style={styles.lowStockAlert}>
              <Text style={styles.lowStockAlertTitle}>⚠️ Low Stock Alert</Text>
              {lowStockItems.map(item => (
                <View key={item.id} style={styles.lowStockItem}>
                  <Text style={styles.lowStockItemName}>{item.name}</Text>
                  <Text style={[
                    styles.lowStockItemQty,
                    item.stock_quantity === 0 && styles.outOfStock
                  ]}>
                    {item.stock_quantity === 0 ? 'Out of Stock' : `${item.stock_quantity} left`}
                  </Text>
                </View>
              ))}
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.manageInventoryButton}
            onPress={() => navigation.navigate('VendorInventory')}
          >
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.manageInventoryGradient}>
              <Text style={styles.manageInventoryText}>Manage Inventory →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeTab === 'profile') {
      return (
        <View style={styles.section}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <Text style={styles.profileName}>{profile?.full_name || 'Vendor'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>🛍️ Vendor</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Stall Number</Text>
            <Text style={styles.infoValue}>{stall.stall_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Stall Name</Text>
            <Text style={styles.infoValue}>{stall.stall_name || 'Your Stall'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Section</Text>
            <Text style={styles.infoValue}>{stall.section}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Sales</Text>
            <Text style={styles.infoValue}>₱{salesSummary.total.toFixed(2)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Orders</Text>
            <Text style={styles.infoValue}>{salesSummary.ordersMonth}</Text>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.logoutGradient}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#DC2626" />
      
      <Header 
        title="Vendor Dashboard"
        subtitle={stall.stall_name || 'Manage your stall'}
      />

      <StatsCard 
        products={products.length} 
        pending={orderStats.pending.length} 
        active={orderStats.active.length}
        todaySales={salesSummary.today}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
      >
        {renderContent()}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'products' && styles.navItemActive]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={styles.navIcon}>📦</Text>
          <Text style={styles.navText}>Products</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'orders' && styles.navItemActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navText}>Orders</Text>
          {orderStats.pending.length > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{orderStats.pending.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'analytics' && styles.navItemActive]}
          onPress={() => setActiveTab('analytics')}
        >
          <Text style={styles.navIcon}>📊</Text>
          <Text style={styles.navText}>Analytics</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'inventory' && styles.navItemActive]}
          onPress={() => setActiveTab('inventory')}
        >
          <Text style={styles.navIcon}>📦</Text>
          <Text style={styles.navText}>Inventory</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>

      <AddProductModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddProduct}
      />

      <AddProductModal
        visible={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        onSubmit={handleUpdateProduct}
        editingProduct={editingProduct}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  addButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    padding: 20,
  },
  emptyOrdersContainer: {
    alignItems: 'center',
    padding: 30,
  },
  emptyOrdersIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyOrdersText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  emptyOrdersSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#DC2626',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 5,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: '#FEF3F2',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navText: {
    fontSize: 11,
    color: '#6B7280',
  },
  navBadge: {
    position: 'absolute',
    top: 0,
    right: '25%',
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  summaryCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  summarySubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  lowStockAlert: {
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  lowStockAlertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
  },
  lowStockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  lowStockItemName: {
    fontSize: 13,
    color: '#374151',
  },
  lowStockItemQty: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
  },
  outOfStock: {
    color: '#DC2626',
  },
  manageInventoryButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  manageInventoryGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  manageInventoryText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});