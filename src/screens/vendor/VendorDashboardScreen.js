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
  Modal,
  TextInput,
  FlatList,
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

// Helper to get order progress
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

  // --- Promotions state ---
  const [promotions, setPromotions] = useState([]);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [productsList, setProductsList] = useState([]);
  const [newPromo, setNewPromo] = useState({
    product_id: '',
    discount_type: 'percentage',
    discount_value: '',
    end_date: '',
  });

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

      const startOfDay = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const now = new Date();
      const todayStart = startOfDay(now);
      const weekAgoStart = startOfDay(new Date(now));
      weekAgoStart.setDate(weekAgoStart.getDate() - 6);
      const monthAgoStart = startOfDay(new Date(now));
      monthAgoStart.setMonth(monthAgoStart.getMonth() - 1);

      const todayOrders = orders.filter(o => startOfDay(new Date(o.created_at)).getTime() === todayStart.getTime());
      const weekOrders = orders.filter(o => startOfDay(new Date(o.created_at)) >= weekAgoStart);
      const monthOrders = orders.filter(o => startOfDay(new Date(o.created_at)) >= monthAgoStart);

      setSalesSummary({
        today: todayOrders.reduce((sum, o) => sum + o.total_amount, 0),
        week: weekOrders.reduce((sum, o) => sum + o.total_amount, 0),
        month: monthOrders.reduce((sum, o) => sum + o.total_amount, 0),
        total: orders.reduce((sum, o) => sum + o.total_amount, 0),
        ordersToday: todayOrders.length,
        ordersWeek: weekOrders.length,
        ordersMonth: monthOrders.length,
      });

      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = startOfDay(date);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const dayOrders = orders.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= dayStart && orderDate < dayEnd;
        });
        const dayTotal = dayOrders.reduce((sum, o) => sum + o.total_amount, 0);
        last7Days.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: dayTotal,
          orders: dayOrders.length,
        });
      }
      setSalesData(last7Days);
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
    updateOrderStatus: originalUpdateOrderStatus,
    refreshOrders,
  } = useVendorOrders(stall?.id);

  // Wrap updateOrderStatus to also refresh sales & low stock
  const handleUpdateOrderStatus = async (order, newStatus) => {
    await originalUpdateOrderStatus(order, newStatus);
    await fetchSalesData();
    await checkLowStock();
    await refreshOrders();
  };

  // --- Reject order (with chat) ---
  const handleRejectOrder = async (orderId, reasonId, finalMessage) => {
    try {
      await originalUpdateOrderStatus(orderId, 'cancelled');
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');

      let { data: conversation } = await supabase
        .from('conversations')
        .select('id, vendor_unread_count')
        .eq('customer_id', order.consumer_id)
        .eq('stall_id', order.stall_id)
        .maybeSingle();

      let conversationId;
      if (conversation) {
        conversationId = conversation.id;
        await supabase
          .from('conversations')
          .update({
            last_message: `❌ Order cancelled: ${finalMessage}`,
            last_message_time: new Date(),
            vendor_unread_count: (conversation.vendor_unread_count || 0) + 1,
          })
          .eq('id', conversationId);
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            customer_id: order.consumer_id,
            stall_id: order.stall_id,
            last_message: `❌ Order cancelled: ${finalMessage}`,
            last_message_time: new Date(),
            vendor_unread_count: 1,
          })
          .select()
          .single();
        if (convError) throw convError;
        conversationId = newConv.id;
      }

      const messageText = `❌ Order #${order.order_number?.slice(-8)} cancelled: ${finalMessage}`;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_role: 'vendor',
        message: messageText,
        is_read: false,
      });

      await refreshOrders();
      await fetchSalesData();
      await fetchChats();
      Alert.alert('Order Rejected', 'The order has been cancelled and the customer has been notified via chat.');
    } catch (error) {
      console.error('Rejection error:', error);
      Alert.alert('Error', error.message || 'Failed to reject order');
      throw error;
    }
  };

  // --- Promotions functions ---
  const fetchProductsForPromo = useCallback(async () => {
    if (!stall?.id) return;
    const { data } = await supabase
      .from('products')
      .select('id, name, price')
      .eq('stall_id', stall.id)
      .eq('is_available', true);
    setProductsList(data || []);
  }, [stall]);

  const fetchPromotions = useCallback(async () => {
    if (!stall?.id) return;
    const { data } = await supabase
      .from('promotions')
      .select(`*, product:product_id (id, name, price, unit)`)
      .eq('stall_id', stall.id)
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false });
    setPromotions(data || []);
  }, [stall]);

const handleCreatePromotion = async () => {
  console.log('Creating promotion with data:', newPromo);
  
  if (!newPromo.product_id) {
    Alert.alert('Error', 'Please select a product');
    return;
  }
  if (!newPromo.discount_value || parseFloat(newPromo.discount_value) <= 0) {
    Alert.alert('Error', 'Please enter a valid discount value');
    return;
  }
  if (!newPromo.end_date) {
    Alert.alert('Error', 'Please enter an expiry date (YYYY-MM-DD)');
    return;
  }

  const selectedProduct = productsList.find(p => p.id === newPromo.product_id);
  if (!selectedProduct) {
    Alert.alert('Error', 'Selected product not found');
    return;
  }

  const discountValue = parseFloat(newPromo.discount_value);
  const discountType = newPromo.discount_type;
  const originalPrice = selectedProduct.price;

  // Validate date format (YYYY-MM-DD) and ensure it's in the future
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(newPromo.end_date)) {
    Alert.alert('Error', 'Please use YYYY-MM-DD format (e.g., 2025-12-31)');
    return;
  }
  const endDateObj = new Date(newPromo.end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (endDateObj <= today) {
    Alert.alert('Error', 'End date must be in the future');
    return;
  }

  try {
    const { error } = await supabase.from('promotions').insert({
      stall_id: stall.id,
      product_id: newPromo.product_id,
      discount_type: discountType,
      discount_value: discountValue,
      original_price: originalPrice,
      end_date: endDateObj.toISOString(),
      is_active: true,
      start_date: new Date().toISOString(),
    });
    if (error) throw error;

    Alert.alert('Success', 'Promotion created successfully');
    setShowPromoModal(false);
    setNewPromo({ product_id: '', discount_type: 'percentage', discount_value: '', end_date: '' });
    await fetchPromotions(); // refresh list
  } catch (error) {
    console.error('Create promotion error:', error);
    Alert.alert('Error', error.message || 'Failed to create promotion');
  }
};

  const handleDeletePromotion = async (promoId) => {
    Alert.alert('Delete Promotion', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('promotions').delete().eq('id', promoId);
          if (error) Alert.alert('Error', error.message);
          else fetchPromotions();
        }
      }
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      if (stall?.id) {
        fetchSalesData();
        checkLowStock();
        fetchChats();
        fetchReportStats();
        fetchPromotions();
        fetchProductsForPromo();
      }
    }, [stall, fetchSalesData, checkLowStock, fetchChats, fetchReportStats, fetchPromotions, fetchProductsForPromo])
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
      fetchReportStats(),
      fetchPromotions(),
      fetchProductsForPromo(),
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

  // ----- Helper Components -----
  const WelcomeHeader = () => (
    <View style={styles.welcomeHeader}>
      <View>
        <Text style={styles.welcomeGreeting}>Good day,</Text>
        <Text style={styles.welcomeName}>{profile?.full_name || 'Vendor'}!</Text>
        <Text style={styles.welcomeSubtext}>Here's your store performance</Text>
      </View>
      <View style={styles.welcomeBadge}>
        <Text style={styles.welcomeBadgeText}>Stall #{stall.stall_number}</Text>
      </View>
    </View>
  );

  const StatCard = ({ title, value, icon, gradientColors, trend, trendValue, isCurrency = false }) => {
    let displayValue = value;
    if (typeof value === 'number') {
      displayValue = isCurrency ? `₱${value.toFixed(2)}` : value.toString();
    }
    return (
      <LinearGradient colors={gradientColors} style={styles.statCardModern}>
        <Text style={styles.statIconModern}>{icon}</Text>
        <Text style={styles.statValueModern}>{displayValue}</Text>
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
  };

  // ----- Overview Tab -----
  const renderOverview = () => {
    const urgentOrder = [...orderStats.active].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))[0];
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
          <StatCard title="Today's Sales" value={salesSummary.today} icon="💰" gradientColors={['#DC2626', '#EF4444']} trend={true} trendValue={salesTrend} isCurrency={true} />
          <StatCard title="Pending Orders" value={orderStats.pending.length} icon="📋" gradientColors={['#F59E0B', '#FBBF24']} trend={true} trendValue={pendingTrend} />
          <StatCard title="Total Products" value={products.length} icon="📦" gradientColors={['#10B981', '#34D399']} trend={false} />
          <StatCard title="Low Stock" value={lowStockItems.length} icon="⚠️" gradientColors={['#EF4444', '#F87171']} trend={true} trendValue={lowStockTrend} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setActiveTab('products')}>
              <LinearGradient colors={['#FEF2F2', '#FFF']} style={styles.quickActionGradient}>
                <View style={styles.quickActionIconCircle}><Text style={styles.quickActionIcon}>➕</Text></View>
                <Text style={styles.quickActionTitle}>Add Product</Text>
                <Text style={styles.quickActionDesc}>New item to your stall</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setActiveTab('orders')}>
              <LinearGradient colors={['#EFF6FF', '#FFF']} style={styles.quickActionGradient}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: '#3B82F6' }]}><Text style={styles.quickActionIcon}>📋</Text></View>
                <Text style={styles.quickActionTitle}>View Orders</Text>
                <Text style={styles.quickActionDesc}>Manage incoming orders</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setActiveTab('chats')}>
              <LinearGradient colors={['#FEF3C7', '#FFF']} style={styles.quickActionGradient}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: '#F59E0B' }]}><Text style={styles.quickActionIcon}>💬</Text></View>
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
              <View><Text style={styles.reportBtnText}>My Reports</Text>{reportStats.total > 0 && <Text style={styles.reportBtnSubtext}>{reportStats.total} total</Text>}</View>
              {reportStats.total > 0 && <View style={styles.reportBadge}><Text style={styles.reportBadgeText}>{reportStats.total}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('VendorReportIssue')}>
              <Text style={styles.reportBtnIcon}>🚩</Text>
              <View><Text style={styles.reportBtnText}>Report Customer</Text><Text style={styles.reportBtnSubtext}>Submit new report</Text></View>
            </TouchableOpacity>
          </View>
          {reportStats.pending > 0 && <Text style={styles.pendingReportsText}>{reportStats.pending} report(s) pending review</Text>}
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
              <View style={styles.progressBarContainer}><View style={[styles.progressBar, { width: `${getOrderProgress(urgentOrder.status)}%` }]} /></View>
              <TouchableOpacity style={styles.updateStatusBtn} onPress={() => handleUpdateOrderStatus(urgentOrder, 'ready')}>
                <Text style={styles.updateStatusBtnText}>Mark as Ready</Text>
              </TouchableOpacity>
            </View>
          )}
          {orderStats.active.slice(0, 3).map(order => (
            <OrderCard key={order.id} order={order} onUpdateStatus={handleUpdateOrderStatus} onRejectOrder={handleRejectOrder} />
          ))}
          {orderStats.active.length === 0 && (
            <View style={styles.emptyStateCard}><Text style={styles.emptyStateEmoji}>📦</Text><Text style={styles.emptyStateTitle}>No orders yet</Text><Text style={styles.emptyStateText}>When customers place orders, they'll appear here</Text></View>
          )}
        </View>

        {lowStockItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Low Stock Alert</Text>
            {lowStockItems.slice(0, 3).map(item => (
              <View key={item.id} style={styles.lowStockItem}>
                <Text style={styles.lowStockItemName}>{item.name}</Text>
                <Text style={styles.lowStockItemQty}>{item.stock_quantity === 0 ? 'Out of Stock' : `${item.stock_quantity} left`}</Text>
                <TouchableOpacity style={styles.restockBtn} onPress={() => { setEditingProduct(item); setShowAddModal(true); }}><Text style={styles.restockBtnText}>Restock</Text></TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  // ----- Products Tab -----
  const renderProducts = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}>
      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
        <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.addGradient}><Text style={styles.addButtonText}>+ Add New Product</Text></LinearGradient>
      </TouchableOpacity>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Products ({products.length})</Text>
        {productsLoading ? <ActivityIndicator size="small" color="#DC2626" /> : products.length === 0 ? (
          <View style={styles.emptyStateCard}><Text style={styles.emptyStateEmoji}>📦</Text><Text style={styles.emptyStateTitle}>No products yet</Text><Text style={styles.emptyStateText}>Tap "Add Product" to get started</Text></View>
        ) : (
          products.map(product => <ProductCard key={product.id} product={product} onToggleAvailability={toggleAvailability} onEdit={setEditingProduct} onDelete={deleteProduct} />)
        )}
      </View>
    </ScrollView>
  );

  // ----- Orders Tab -----
  const renderOrders = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Orders ({orderStats.active.length})</Text>
        {ordersLoading ? <ActivityIndicator size="small" color="#DC2626" /> : orderStats.active.length === 0 ? (
          <View style={styles.emptyStateCard}><Text style={styles.emptyStateEmoji}>📭</Text><Text style={styles.emptyStateTitle}>No active orders</Text><Text style={styles.emptyStateText}>New orders will appear here</Text></View>
        ) : (
          orderStats.active.map(order => <OrderCard key={order.id} order={order} onUpdateStatus={handleUpdateOrderStatus} onRejectOrder={handleRejectOrder} />)
        )}
      </View>
    </ScrollView>
  );

  // ----- Chats Tab -----
  const renderChats = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💬 Customer Conversations</Text>
        {loadingChats ? <ActivityIndicator size="small" color="#DC2626" style={styles.chatLoader} /> : chats.length === 0 ? (
          <View style={styles.emptyStateCard}><Text style={styles.emptyStateEmoji}>💬</Text><Text style={styles.emptyStateTitle}>No conversations yet</Text><Text style={styles.emptyStateText}>When customers message you, they'll appear here</Text></View>
        ) : (
          chats.map(chat => (
            <TouchableOpacity key={chat.id} style={styles.chatItem} onPress={() => openChat(chat)}>
              <View style={styles.chatAvatar}><Text style={styles.chatAvatarText}>{chat.customer_name?.charAt(0).toUpperCase() || '👤'}</Text></View>
              <View style={styles.chatContent}>
                <View style={styles.chatHeader}><Text style={styles.chatName}>{chat.customer_name}</Text><Text style={styles.chatTime}>{chat.last_message_time ? new Date(chat.last_message_time).toLocaleDateString() : ''}</Text></View>
                <Text style={[styles.chatMessage, chat.unread_count > 0 && styles.chatMessageUnread]} numberOfLines={1}>{chat.last_message}</Text>
              </View>
              {chat.unread_count > 0 && <View style={styles.chatBadge}><Text style={styles.chatBadgeText}>{chat.unread_count}</Text></View>}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  // ----- Promotions Tab -----
const renderPromotions = () => {
  const renderPromoItem = ({ item: promo }) => {
    const product = promo.product;
    const isPercentage = promo.discount_type === 'percentage';
    const discountText = isPercentage ? `${promo.discount_value}% OFF` : `₱${promo.discount_value} OFF`;
    const endDate = new Date(promo.end_date).toLocaleDateString();
    return (
      <View style={styles.promoCard}>
        <View style={styles.promoCardContent}>
          <View style={styles.promoInfo}>
            <Text style={styles.promoProductName}>{product?.name}</Text>
            <Text style={styles.promoDiscount}>{discountText}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.originalPrice}>₱{promo.original_price}</Text>
              <Text style={styles.discountedPrice}>₱{promo.discounted_price}</Text>
            </View>
            <Text style={styles.promoExpiry}>Expires: {endDate}</Text>
          </View>
          <TouchableOpacity onPress={() => handleDeletePromotion(promo.id)} style={styles.deletePromoBtn}>
            <Text style={styles.deletePromoBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateCard}>
      <Text style={styles.emptyStateEmoji}>🏷️</Text>
      <Text style={styles.emptyStateTitle}>No active promotions</Text>
      <Text style={styles.emptyStateText}>Tap "New Promo" to offer discounts</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Header with button – always visible */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏷️ Active Promotions</Text>
          <TouchableOpacity onPress={() => setShowPromoModal(true)}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.addPromoButton}>
              <Text style={styles.addPromoButtonText}>+ New Promo</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* List of promotions */}
      <FlatList
        data={promotions}
        renderItem={renderPromoItem}
        keyExtractor={item => item.id.toString()}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.promosListContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};
  // ----- Profile Tab -----
  const renderProfile = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}>
      <View style={styles.section}>
        <View style={styles.profileHeader}>
          <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.profileAvatarGradient}><Text style={styles.avatarText}>👤</Text></LinearGradient>
          <Text style={styles.profileName}>{profile?.full_name || 'Vendor'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleText}>🛍️ Vendor</Text></View>
        </View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Stall Number</Text><Text style={styles.infoValue}>{stall.stall_number}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Stall Name</Text><Text style={styles.infoValue}>{stall.stall_name || 'Your Stall'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Section</Text><Text style={styles.infoValue}>{stall.section}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Total Sales</Text><Text style={styles.infoValue}>₱{salesSummary.total.toFixed(2)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Total Orders</Text><Text style={styles.infoValue}>{salesSummary.ordersMonth}</Text></View>
        {Platform.OS === 'web' ? (
          <button onClick={async () => { if (window.confirm('Logout?')) { await supabase.auth.signOut(); window.location.href = '/'; } }} style={{ backgroundColor: '#DC2626', color: 'white', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', width: '100%', fontSize: 16, fontWeight: '600', marginTop: 20 }}>🚪 Logout</button>
        ) : (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.logoutGradient}><Text style={styles.logoutButtonText}>Logout</Text></LinearGradient>
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
      case 'promotions': return renderPromotions();
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
        {['overview', 'products', 'orders', 'promotions', 'chats', 'profile'].map(tab => (
          <TouchableOpacity key={tab} style={[styles.navItem, activeTab === tab && styles.navItemActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.navIcon, activeTab === tab && styles.navIconActive]}>
              {tab === 'overview' && '📊'}
              {tab === 'products' && '📦'}
              {tab === 'orders' && '📋'}
              {tab === 'promotions' && '🏷️'}
              {tab === 'chats' && '💬'}
              {tab === 'profile' && '👤'}
            </Text>
            <Text style={[styles.navText, activeTab === tab && styles.navTextActive]}>
              {tab === 'overview' && 'Overview'}
              {tab === 'products' && 'Products'}
              {tab === 'orders' && 'Orders'}
              {tab === 'promotions' && 'Promos'}
              {tab === 'chats' && 'Chats'}
              {tab === 'profile' && 'Profile'}
            </Text>
            {tab === 'orders' && orderStats.pending.length > 0 && <View style={styles.navBadge}><Text style={styles.navBadgeText}>{orderStats.pending.length}</Text></View>}
            {tab === 'chats' && unreadCount > 0 && <View style={styles.navBadge}><Text style={styles.navBadgeText}>{unreadCount}</Text></View>}
            {activeTab === tab && <View style={styles.navActiveIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <AddProductModal visible={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddProduct} />
      <AddProductModal visible={!!editingProduct} onClose={() => setEditingProduct(null)} onSubmit={handleUpdateProduct} editingProduct={editingProduct} />
        {/* Promotion Modal */}
{showPromoModal && (
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Create Promotion</Text>
      <Text style={styles.modalSubtitle}>Select product and discount</Text>

      <Text style={styles.label}>Product</Text>
      {productsList.length === 0 ? (
        <Text style={styles.noProductsText}>No products available. Add products first.</Text>
      ) : (
        <FlatList
          data={productsList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={[styles.pickerOption, newPromo.product_id === p.id && styles.pickerOptionSelected]}
              onPress={() => setNewPromo({...newPromo, product_id: p.id})}
            >
              <Text style={[styles.pickerOptionText, newPromo.product_id === p.id && styles.pickerOptionTextSelected]}>
                {p.name} (₱{p.price})
              </Text>
            </TouchableOpacity>
          )}
          style={styles.pickerFlatList}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        />
      )}

      <Text style={styles.label}>Discount Type</Text>
      <View style={styles.rowButtons}>
        <TouchableOpacity
          style={[styles.typeButton, newPromo.discount_type === 'percentage' && styles.typeButtonActive]}
          onPress={() => setNewPromo({...newPromo, discount_type: 'percentage'})}
        >
          <Text style={[styles.typeButtonText, newPromo.discount_type === 'percentage' && styles.typeButtonTextActive]}>Percentage (%)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, newPromo.discount_type === 'fixed' && styles.typeButtonActive]}
          onPress={() => setNewPromo({...newPromo, discount_type: 'fixed'})}
        >
          <Text style={[styles.typeButtonText, newPromo.discount_type === 'fixed' && styles.typeButtonTextActive]}>Fixed (₱)</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>{newPromo.discount_type === 'percentage' ? 'Discount %' : 'Discount Amount (₱)'}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="e.g., 20"
        value={newPromo.discount_value}
        onChangeText={(text) => setNewPromo({...newPromo, discount_value: text})}
      />

      <Text style={styles.label}>Expiry Date (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="2025-12-31"
        value={newPromo.end_date}
        onChangeText={(text) => setNewPromo({...newPromo, end_date: text})}
      />

      <View style={styles.modalButtons}>
        <TouchableOpacity style={styles.cancelModalButton} onPress={() => setShowPromoModal(false)}>
          <Text style={styles.cancelModalText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitModalButton} onPress={handleCreatePromotion}>
          <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.submitGradient}>
            <Text style={styles.submitButtonText}>Create Promo</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  </View>
)}
    </SafeAreaView>
  );
}

// ---- Styles (keep existing and add new promo-related styles) ----
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  contentArea: { flex: 1 },
  loadingText: { marginTop: 12, color: '#6B7280' },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', padding: 20 },
  backButton: { marginTop: 20, backgroundColor: '#DC2626', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  backButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  promosListContainer: {
  paddingHorizontal: 16,
  paddingBottom: 20,
},
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  welcomeGreeting: { fontSize: 14, color: '#000000' },
  welcomeName: { fontSize: 24, fontWeight: '700', color: '#000000', marginTop: 4 },
  welcomeSubtext: { fontSize: 12, color: '#000000', marginTop: 4 },
  welcomeBadge: { backgroundColor: '#F1F3F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  welcomeBadgeText: { color: '#000000', fontWeight: '500', fontSize: 12 },

  statsGridModern: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  statCardModern: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statIconModern: { fontSize: 28, marginBottom: 8, color: '#FFF' },
  statValueModern: { fontSize: 24, fontWeight: 'bold', color: '#FFF', marginBottom: 4 },
  statLabelModern: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginBottom: 8 },
  statTrend: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  statTrendText: { fontSize: 10, color: '#FFF' },
  trendPositive: { backgroundColor: 'rgba(16,185,129,0.3)' },
  trendNegative: { backgroundColor: 'rgba(239,68,68,0.3)' },

  section: {
    backgroundColor: '#FFF',
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
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  quickActionsRow: { flexDirection: 'row', gap: 12 },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionGradient: { padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
  quickActionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionIcon: { fontSize: 24, color: '#FFF' },
  quickActionTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 4 },
  quickActionDesc: { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  reportsRow: { flexDirection: 'row', gap: 12 },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  reportBtnIcon: { fontSize: 24 },
  reportBtnText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reportBtnSubtext: { fontSize: 11, color: '#6B7280' },
  reportBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  pendingReportsText: { fontSize: 12, color: '#F59E0B', textAlign: 'center', marginTop: 8 },

  urgentOrderCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  urgentOrderTitle: { fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 8 },
  urgentOrderNumber: { fontSize: 16, fontWeight: 'bold', color: '#78350F', marginBottom: 4 },
  urgentOrderStatus: { fontSize: 12, color: '#B45309', marginBottom: 12 },
  progressBarContainer: { height: 6, backgroundColor: '#FDE68A', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressBar: { height: '100%', backgroundColor: '#DC2626', borderRadius: 3 },
  updateStatusBtn: { backgroundColor: '#DC2626', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  updateStatusBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  addButton: { marginHorizontal: 16, marginBottom: 16, marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  addGradient: { paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  lowStockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
  },
  lowStockItemName: { fontSize: 13, color: '#374151', flex: 1 },
  lowStockItemQty: { fontSize: 13, color: '#F59E0B', fontWeight: '500', marginRight: 8 },
  restockBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  restockBtnText: { fontSize: 11, color: '#FFF', fontWeight: '600' },

  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatAvatarText: { fontSize: 20, fontWeight: '600', color: '#DC2626' },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  chatTime: { fontSize: 11, color: '#9CA3AF' },
  chatMessage: { fontSize: 13, color: '#6B7280' },
  chatMessageUnread: { fontWeight: '600', color: '#111827' },
  chatBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  chatBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  chatLoader: { padding: 20 },

  emptyStateCard: { alignItems: 'center', padding: 40 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 12, opacity: 0.5 },
  emptyStateTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  emptyStateText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },

  profileHeader: { alignItems: 'center', marginBottom: 20 },
  profileAvatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 40 },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  profileEmail: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  roleBadge: { backgroundColor: '#FEF3F2', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  roleText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500' },

  logoutButton: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
  logoutGradient: { paddingVertical: 12, alignItems: 'center' },
  logoutButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 25 : 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 5,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, position: 'relative' },
  navItemActive: { backgroundColor: '#FEF3F2', borderRadius: 8, marginHorizontal: 2 },
  navIcon: { fontSize: 22, marginBottom: 3 },
  navIconActive: { transform: [{ scale: 1.1 }] },
  navText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  navTextActive: { color: '#DC2626', fontWeight: '600' },
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
  navBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  navActiveIndicator: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#DC2626', marginTop: 2 },

  // Promo card styles
  addPromoButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addPromoButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  promoCard: {
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  promoCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promoInfo: { flex: 1 },
  promoProductName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  promoDiscount: { fontSize: 13, color: '#DC2626', fontWeight: '600', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  originalPrice: { fontSize: 12, color: '#6B7280', textDecorationLine: 'line-through' },
  discountedPrice: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
  promoExpiry: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  deletePromoBtn: { padding: 8 },
  deletePromoBtnText: { fontSize: 18 },

  // Modal styles (web/mobile compatible)
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12 },
  pickerFlatList: {
    maxHeight: 200,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerOptionSelected: { backgroundColor: '#FEE2E2' },
  pickerOptionText: { fontSize: 14, color: '#374151' },
  pickerOptionTextSelected: { color: '#DC2626', fontWeight: '500' },
  noProductsText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: 20, marginBottom: 16 },
  rowButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonActive: { backgroundColor: '#DC2626' },
  typeButtonText: { fontSize: 14, color: '#374151' },
  typeButtonTextActive: { color: 'white' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelModalButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelModalText: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  submitModalButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  submitGradient: { paddingVertical: 12, alignItems: 'center' },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});