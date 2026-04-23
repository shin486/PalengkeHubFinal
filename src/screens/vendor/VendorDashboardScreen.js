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
import { SalesChart } from '../../components/vendor/SalesChart';
import { Header } from '../../components/Header';

const { width } = Dimensions.get('window');

// Helper for status colors
const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return '#F59E0B';
    case 'confirmed': return '#3B82F6';
    case 'preparing': return '#8B5CF6';
    case 'ready': return '#10B981';
    case 'completed': return '#6B7280';
    case 'cancelled': return '#EF4444';
    default: return '#6B7280';
  }
};

// Helper to calculate percentage change
const getPercentChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
};

// Helper to get order progress percentage
const getOrderProgress = (status) => {
  const steps = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
  const index = steps.indexOf(status);
  if (index === -1) return 0;
  return (index / (steps.length - 1)) * 100;
};

export default function VendorDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [stall, setStall] = useState(null);
  const [loadingStall, setLoadingStall] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [salesSummary, setSalesSummary] = useState({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
    ordersToday: 0,
    ordersWeek: 0,
    ordersMonth: 0
  });
  const [reportStats, setReportStats] = useState({ pending: 0, total: 0 });

  // Fetch stall
  useEffect(() => {
    if (user) fetchStall();
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

  const fetchReportStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('vendor_reports')
        .select('status')
        .eq('vendor_id', user.id);
      if (error) throw error;
      const pending = data?.filter(r => r.status === 'pending').length || 0;
      setReportStats({ pending, total: data?.length || 0 });
    } catch (error) {
      console.error('Error fetching report stats:', error);
    }
  }, [user]);

  const fetchChats = useCallback(async () => {
    if (!stall?.id) return;
    try {
      setLoadingChats(true);
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`*, customer:customer_id (id, full_name, email)`)
        .eq('stall_id', stall.id)
        .order('updated_at', { ascending: false });
      if (convError) throw convError;
      if (!conversations || conversations.length === 0) {
        setChats([]);
        setUnreadCount(0);
        setLoadingChats(false);
        return;
      }
      const processedChats = conversations.map((conv) => {
        const customerData = conv.customer;
        const customerName = customerData?.full_name ||
          customerData?.email?.split('@')[0] ||
          `Customer_${conv.customer_id?.slice(-4)}`;
        return {
          id: conv.id,
          customer_id: conv.customer_id,
          customer_name: customerName,
          last_message: conv.last_message || 'No messages yet',
          last_message_time: conv.last_message_time,
          unread_count: conv.vendor_unread_count || 0,
          updated_at: conv.updated_at,
        };
      });
      setChats(processedChats);
      const totalUnread = processedChats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoadingChats(false);
    }
  }, [stall]);

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
          Alert.alert('⚠️ Out of Stock Alert', `${outOfStock.length} product(s) are out of stock.`, [{ text: 'OK' }]);
        } else if (lowStock.length > 0) {
          Alert.alert('⚠️ Low Stock Alert', `${lowStock.length} product(s) are running low.`, [{ text: 'OK' }]);
        }
      }
    } catch (error) {
      console.error('Error checking stock:', error);
    }
  }, [stall]);

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

  useFocusEffect(
    useCallback(() => {
      if (stall?.id) {
        fetchSalesData();
        checkLowStock();
        fetchChats();
        fetchReportStats();
      }
    }, [stall, fetchSalesData, checkLowStock, fetchChats, fetchReportStats])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshProducts(),
      refreshOrders(),
      fetchStall(),
      fetchSalesData(),
      checkLowStock(),
      fetchChats(),
      fetchReportStats()
    ]);
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

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          if (Platform.OS === 'web') window.location.href = '/';
          else navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    ]);
  };

  const openChat = async (chat) => {
    try {
      const { data: customerProfile, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', chat.customer_id)
        .single();
      if (error) throw error;
      navigation.navigate('VendorChatDetail', {
        conversationId: chat.id,
        customer: {
          id: customerProfile.id,
          name: customerProfile.full_name || chat.customer_name,
          email: customerProfile.email,
          avatar: customerProfile.avatar_url,
        }
      });
    } catch (error) {
      navigation.navigate('VendorChatDetail', {
        conversationId: chat.id,
        customer: { id: chat.customer_id, name: chat.customer_name }
      });
    }
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

  // ----- Welcome Header Component -----
  const WelcomeHeader = () => (
    <LinearGradient
      colors={['#DC2626', '#EF4444']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.welcomeHeader}
    >
      <View>
        <Text style={styles.welcomeGreeting}>Good day,</Text>
        <Text style={styles.welcomeName}>{profile?.full_name || 'Vendor'}!</Text>
        <Text style={styles.welcomeSubtext}>Here's your store performance</Text>
      </View>
      <View style={styles.welcomeBadge}>
        <Text style={styles.welcomeBadgeText}>Stall #{stall.stall_number}</Text>
      </View>
    </LinearGradient>
  );

  // ----- Modern Stats Card Component (with dynamic trend) -----
  const StatCard = ({ title, value, icon, gradientColors, trend, trendValue }) => (
    <LinearGradient colors={gradientColors} style={styles.statCardModern}>
      <Text style={styles.statIconModern}>{icon}</Text>
      <Text style={styles.statValueModern}>{typeof value === 'number' ? `₱${value.toFixed(2)}` : value}</Text>
      <Text style={styles.statLabelModern}>{title}</Text>
      {trend && (
        <View style={[styles.statTrend, trendValue > 0 ? styles.trendPositive : styles.trendNegative]}>
          <Text style={styles.statTrendText}>
            {trendValue > 0 ? '↑' : '↓'} {Math.abs(trendValue).toFixed(1)}% vs last period
          </Text>
        </View>
      )}
    </LinearGradient>
  );

  // ----- OVERVIEW TAB (upgraded with Phase 1 features) -----
  const renderOverview = () => {
    // Find the most urgent order (oldest pending > confirmed > preparing)
    const urgentOrder = [...orderStats.active].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))[0];
    // Dummy trend values – you can replace with real calculations later
    const salesTrend = 12.5;
    const pendingTrend = -8.3;
    const lowStockTrend = lowStockItems.length > 0 ? 20 : -100;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
      >
        <WelcomeHeader />

        <View style={styles.statsGridModern}>
          <StatCard
            title="Today's Sales"
            value={salesSummary.today}
            icon="💰"
            gradientColors={['#DC2626', '#EF4444']}
            trend={true}
            trendValue={salesTrend}
          />
          <StatCard
            title="Pending Orders"
            value={orderStats.pending.length}
            icon="📋"
            gradientColors={['#F59E0B', '#FBBF24']}
            trend={true}
            trendValue={pendingTrend}
          />
          <StatCard
            title="Total Products"
            value={products.length}
            icon="📦"
            gradientColors={['#10B981', '#34D399']}
            trend={false}
          />
          <StatCard
            title="Low Stock"
            value={lowStockItems.length}
            icon="⚠️"
            gradientColors={['#EF4444', '#F87171']}
            trend={true}
            trendValue={lowStockTrend}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity activeOpacity={0.8} style={styles.quickActionCard} onPress={() => setActiveTab('products')}>
              <LinearGradient colors={['#FEF2F2', '#FFF']} style={styles.quickActionGradient}>
                <View style={styles.quickActionIconCircle}>
                  <Text style={styles.quickActionIcon}>➕</Text>
                </View>
                <Text style={styles.quickActionTitle}>Add Product</Text>
                <Text style={styles.quickActionDesc}>New item to your stall</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} style={styles.quickActionCard} onPress={() => setActiveTab('orders')}>
              <LinearGradient colors={['#EFF6FF', '#FFF']} style={styles.quickActionGradient}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: '#3B82F6' }]}>
                  <Text style={styles.quickActionIcon}>📋</Text>
                </View>
                <Text style={styles.quickActionTitle}>View Orders</Text>
                <Text style={styles.quickActionDesc}>Manage incoming orders</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} style={styles.quickActionCard} onPress={() => setActiveTab('chats')}>
              <LinearGradient colors={['#FEF3C7', '#FFF']} style={styles.quickActionGradient}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.quickActionIcon}>💬</Text>
                </View>
                <Text style={styles.quickActionTitle}>Messages</Text>
                <Text style={styles.quickActionDesc}>Customer chats</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reports Quick Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Reports</Text>
          <View style={styles.reportsRow}>
            <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('VendorReportsList')}>
              <Text style={styles.reportBtnIcon}>📊</Text>
              <View>
                <Text style={styles.reportBtnText}>My Reports</Text>
                {reportStats.total > 0 && <Text style={styles.reportBtnSubtext}>{reportStats.total} total</Text>}
              </View>
              {reportStats.total > 0 && <View style={styles.reportBadge}><Text style={styles.reportBadgeText}>{reportStats.total}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('VendorReportIssue')}>
              <Text style={styles.reportBtnIcon}>🚩</Text>
              <View>
                <Text style={styles.reportBtnText}>Report Customer</Text>
                <Text style={styles.reportBtnSubtext}>Submit new report</Text>
              </View>
            </TouchableOpacity>
          </View>
          {reportStats.pending > 0 && (
            <Text style={styles.pendingReportsText}>{reportStats.pending} report(s) pending review</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sales Overview (Last 7 Days)</Text>
          <SalesChart data={salesData} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {urgentOrder && (
            <View style={styles.urgentOrderCard}>
              <Text style={styles.urgentOrderTitle}>⚠️ Urgent Order</Text>
              <Text style={styles.urgentOrderNumber}>#{urgentOrder.order_number?.slice(-8) || urgentOrder.id.slice(-8)}</Text>
              <Text style={styles.urgentOrderStatus}>Status: {urgentOrder.status.toUpperCase()}</Text>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${getOrderProgress(urgentOrder.status)}%` }]} />
              </View>
              <TouchableOpacity
                style={styles.updateStatusBtn}
                onPress={() => updateOrderStatus(urgentOrder, 'ready')}
              >
                <Text style={styles.updateStatusBtnText}>Mark as Ready</Text>
              </TouchableOpacity>
            </View>
          )}
          {orderStats.active.slice(0, 3).map(order => (
            <OrderCard key={order.id} order={order} onUpdateStatus={updateOrderStatus} />
          ))}
          {orderStats.active.length === 0 && (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateEmoji}>📦</Text>
              <Text style={styles.emptyStateTitle}>No orders yet</Text>
              <Text style={styles.emptyStateText}>When customers place orders, they'll appear here</Text>
            </View>
          )}
        </View>

        {lowStockItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Low Stock Alert</Text>
            {lowStockItems.slice(0, 3).map(item => (
              <View key={item.id} style={styles.lowStockItem}>
                <Text style={styles.lowStockItemName}>{item.name}</Text>
                <Text style={styles.lowStockItemQty}>
                  {item.stock_quantity === 0 ? 'Out of Stock' : `${item.stock_quantity} left`}
                </Text>
                <TouchableOpacity
                  style={styles.restockBtn}
                  onPress={() => {
                    setEditingProduct(item);
                    setShowAddModal(true);
                  }}
                >
                  <Text style={styles.restockBtnText}>Restock</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  // ----- PRODUCTS TAB -----
  const renderProducts = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
    >
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
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateEmoji}>📦</Text>
            <Text style={styles.emptyStateTitle}>No products yet</Text>
            <Text style={styles.emptyStateText}>Tap "Add Product" to get started</Text>
          </View>
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
    </ScrollView>
  );

  // ----- ORDERS TAB -----
  const renderOrders = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Orders ({orderStats.active.length})</Text>
        {ordersLoading ? (
          <ActivityIndicator size="small" color="#DC2626" />
        ) : orderStats.active.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateEmoji}>📭</Text>
            <Text style={styles.emptyStateTitle}>No active orders</Text>
            <Text style={styles.emptyStateText}>New orders will appear here</Text>
          </View>
        ) : (
          orderStats.active.map(order => (
            <OrderCard key={order.id} order={order} onUpdateStatus={updateOrderStatus} />
          ))
        )}
      </View>
    </ScrollView>
  );

  // ----- CHATS TAB -----
  const renderChats = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💬 Customer Conversations</Text>
        {loadingChats ? (
          <ActivityIndicator size="small" color="#DC2626" style={styles.chatLoader} />
        ) : chats.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateEmoji}>💬</Text>
            <Text style={styles.emptyStateTitle}>No conversations yet</Text>
            <Text style={styles.emptyStateText}>When customers message you, they'll appear here</Text>
          </View>
        ) : (
          chats.map(chat => (
            <TouchableOpacity key={chat.id} style={styles.chatItem} onPress={() => openChat(chat)}>
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarText}>{chat.customer_name?.charAt(0).toUpperCase() || '👤'}</Text>
              </View>
              <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName}>{chat.customer_name}</Text>
                  <Text style={styles.chatTime}>
                    {chat.last_message_time ? new Date(chat.last_message_time).toLocaleDateString() : ''}
                  </Text>
                </View>
                <Text style={[styles.chatMessage, chat.unread_count > 0 && styles.chatMessageUnread]} numberOfLines={1}>
                  {chat.last_message}
                </Text>
              </View>
              {chat.unread_count > 0 && (
                <View style={styles.chatBadge}>
                  <Text style={styles.chatBadgeText}>{chat.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  // ----- PROFILE TAB -----
  const renderProfile = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
    >
      <View style={styles.section}>
        <View style={styles.profileHeader}>
          <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.profileAvatarGradient}>
            <Text style={styles.avatarText}>👤</Text>
          </LinearGradient>
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
        {Platform.OS === 'web' ? (
          <button
            onClick={async () => {
              if (window.confirm('Are you sure you want to logout?')) {
                await supabase.auth.signOut();
                window.location.href = '/';
              }
            }}
            style={{
              backgroundColor: '#DC2626',
              color: 'white',
              padding: '14px 20px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              fontSize: '16px',
              fontWeight: '600',
              marginTop: '20px',
              marginBottom: '10px',
            }}
          >
            🚪 Logout
          </button>
        ) : (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.logoutGradient}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'products': return renderProducts();
      case 'orders': return renderOrders();
      case 'chats': return renderChats();
      case 'profile': return renderProfile();
      default: return renderOverview();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#DC2626" />
      <Header title="PalengkeHub" subtitle={stall.stall_name || 'Manage your stall'} />
      <View style={styles.contentArea}>{renderContent()}</View>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'overview' && styles.navItemActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.navIcon, activeTab === 'overview' && styles.navIconActive]}>📊</Text>
          <Text style={[styles.navText, activeTab === 'overview' && styles.navTextActive]}>Overview</Text>
          {activeTab === 'overview' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'products' && styles.navItemActive]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.navIcon, activeTab === 'products' && styles.navIconActive]}>📦</Text>
          <Text style={[styles.navText, activeTab === 'products' && styles.navTextActive]}>Products</Text>
          {activeTab === 'products' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'orders' && styles.navItemActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.navIcon, activeTab === 'orders' && styles.navIconActive]}>📋</Text>
          <Text style={[styles.navText, activeTab === 'orders' && styles.navTextActive]}>Orders</Text>
          {orderStats.pending.length > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{orderStats.pending.length}</Text>
            </View>
          )}
          {activeTab === 'orders' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'chats' && styles.navItemActive]}
          onPress={() => setActiveTab('chats')}
        >
          <Text style={[styles.navIcon, activeTab === 'chats' && styles.navIconActive]}>💬</Text>
          <Text style={[styles.navText, activeTab === 'chats' && styles.navTextActive]}>Chats</Text>
          {unreadCount > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{unreadCount}</Text>
            </View>
          )}
          {activeTab === 'chats' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.navIcon, activeTab === 'profile' && styles.navIconActive]}>👤</Text>
          <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>Profile</Text>
          {activeTab === 'profile' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
      </View>

      <AddProductModal visible={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddProduct} />
      <AddProductModal visible={!!editingProduct} onClose={() => setEditingProduct(null)} onSubmit={handleUpdateProduct} editingProduct={editingProduct} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  contentArea: { flex: 1 },
  loadingText: { marginTop: 12, color: '#6C757D' },
  emptyIcon: { fontSize: 60, marginBottom: 16, opacity: 0.3 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#212529', marginBottom: 8 },
  emptyText: { textAlign: 'center', color: '#ADB5BD', padding: 20 },
  backButton: { marginTop: 20, backgroundColor: '#212529', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  backButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  // Welcome Header – plain white
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  welcomeGreeting: { fontSize: 14, color: '#6C757D' },
  welcomeName: { fontSize: 24, fontWeight: '700', color: '#212529', marginTop: 4 },
  welcomeSubtext: { fontSize: 12, color: '#ADB5BD', marginTop: 4 },
  welcomeBadge: { backgroundColor: '#F1F3F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  welcomeBadgeText: { color: '#495057', fontWeight: '500', fontSize: 12 },

  // Stats Grid – clean white cards, no colors
  statsGridModern: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  statCardModern: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  statIconModern: { fontSize: 28, marginBottom: 8, color: '#6C757D' },
  statValueModern: { fontSize: 24, fontWeight: '700', color: '#212529', marginBottom: 4 },
  statLabelModern: { fontSize: 12, color: '#6C757D', marginBottom: 8 },
  statTrendText: { fontSize: 10, fontWeight: '500', color: '#6C757D' },
  trendPositive: { color: '#2E7D32' },
  trendNegative: { color: '#C62828' },

  // Sections – plain white cards
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#212529', marginBottom: 16 },

  // Quick Actions – neutral gray
  quickActionsRow: { flexDirection: 'row', gap: 12 },
  quickActionCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E9ECEF' },
  quickActionGradient: { padding: 12, alignItems: 'center' },
  quickActionIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F1F3F5', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickActionIcon: { fontSize: 24, color: '#495057' },
  quickActionTitle: { fontSize: 14, fontWeight: '600', color: '#212529', marginTop: 4 },
  quickActionDesc: { fontSize: 10, color: '#6C757D', marginTop: 2, textAlign: 'center' },

  // Reports buttons
  reportsRow: { flexDirection: 'row', gap: 12 },
  reportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 12, gap: 12, borderWidth: 1, borderColor: '#E9ECEF', position: 'relative' },
  reportBtnIcon: { fontSize: 24, color: '#6C757D' },
  reportBtnText: { fontSize: 14, fontWeight: '600', color: '#212529' },
  reportBtnSubtext: { fontSize: 11, color: '#6C757D' },
  reportBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  reportBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  pendingReportsText: { fontSize: 12, color: '#DC2626', textAlign: 'center', marginTop: 8 },

  // Urgent Order Card – very subtle yellow, almost white
  urgentOrderCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0E6D2',
  },
  urgentOrderTitle: { fontSize: 13, fontWeight: '600', color: '#8B6B3D', marginBottom: 8 },
  urgentOrderNumber: { fontSize: 15, fontWeight: '600', color: '#212529', marginBottom: 4 },
  urgentOrderStatus: { fontSize: 12, color: '#6C757D', marginBottom: 12 },
  progressBarContainer: { height: 3, backgroundColor: '#F0E6D2', borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  progressBar: { height: '100%', backgroundColor: '#DC2626', borderRadius: 2 },
  updateStatusBtn: { backgroundColor: '#212529', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  updateStatusBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Add Product button
  addButton: { marginHorizontal: 16, marginBottom: 16, marginTop: 8, borderRadius: 12, overflow: 'hidden', backgroundColor: '#212529' },
  addGradient: { paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  // Low stock items
  lowStockItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  lowStockItemName: { fontSize: 13, color: '#212529', flex: 1 },
  lowStockItemQty: { fontSize: 13, color: '#E65100', fontWeight: '500', marginRight: 8 },
  restockBtn: { backgroundColor: '#F1F3F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  restockBtnText: { fontSize: 11, color: '#495057', fontWeight: '500' },

  // Chat styles
  chatItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  chatAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F1F3F5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  chatAvatarText: { fontSize: 20, fontWeight: '600', color: '#495057' },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 15, fontWeight: '600', color: '#212529' },
  chatTime: { fontSize: 11, color: '#ADB5BD' },
  chatMessage: { fontSize: 13, color: '#6C757D' },
  chatMessageUnread: { fontWeight: '600', color: '#212529' },
  chatBadge: { backgroundColor: '#DC2626', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  chatBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  chatLoader: { padding: 20 },

  // Empty state (unchanged)
  emptyStateCard: { alignItems: 'center', padding: 40 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 12, opacity: 0.3 },
  emptyStateTitle: { fontSize: 16, fontWeight: '600', color: '#212529', marginBottom: 4 },
  emptyStateText: { fontSize: 13, color: '#6C757D', textAlign: 'center' },

  // Profile
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  profileAvatarGradient: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F3F5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 40, color: '#6C757D' },
  profileName: { fontSize: 20, fontWeight: '600', color: '#212529' },
  profileEmail: { fontSize: 14, color: '#6C757D', marginTop: 4 },
  roleBadge: { backgroundColor: '#F1F3F5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  roleText: { fontSize: 12, color: '#495057', fontWeight: '500' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  infoLabel: { fontSize: 14, color: '#6C757D' },
  infoValue: { fontSize: 14, color: '#212529', fontWeight: '500' },

  logoutButton: { marginTop: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F1F3F5' },
  logoutGradient: { paddingVertical: 12, alignItems: 'center' },
  logoutButtonText: { color: '#495057', fontSize: 16, fontWeight: '600' },

  // Bottom Navigation – minimal
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 25 : 8,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, position: 'relative' },
  navItemActive: { backgroundColor: '#F1F3F5', borderRadius: 8, marginHorizontal: 2 },
  navIcon: { fontSize: 22, marginBottom: 3, color: '#6C757D' },
  navIconActive: { color: '#212529', transform: [{ scale: 1.05 }] },
  navText: { fontSize: 11, color: '#6C757D', fontWeight: '500' },
  navTextActive: { color: '#212529', fontWeight: '600' },
  navBadge: { position: 'absolute', top: 0, right: '25%', backgroundColor: '#DC2626', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  navBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  navActiveIndicator: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#212529', marginTop: 2 },
});