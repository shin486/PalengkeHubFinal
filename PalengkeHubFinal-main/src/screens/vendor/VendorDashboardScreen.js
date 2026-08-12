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
  Image,
  Alert,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorOrders } from '../../hooks/useVendorOrders';

// ============================================================
// COLORS - Matches Customer Side Exactly
// ============================================================
const COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  primarySurface: '#FEF2F2',
  background: '#F8F9FA',
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

export default function VendorDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [stall, setStall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salesData, setSalesData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [chats, setChats] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [sukiBuyers, setSukiBuyers] = useState([]);
  const [isPaused, setIsPaused] = useState(false);

  const [stats, setStats] = useState({
    revenueToday: 0,
    ordersToday: 0,
    pendingOrders: 0,
    awaitingVerification: 0,
    completedToday: 0,
    cancelledToday: 0,
  });

  const fetchStall = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .eq('vendor_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setStall(data);
      if (data) setIsPaused(data.is_temporarily_closed || false);
    } catch (error) {
      console.error('Error fetching stall:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const {
    orders,
    loading: ordersLoading,
    orderStats,
    refreshOrders,
  } = useVendorOrders(stall?.id);

  const fetchDashboardData = useCallback(async () => {
    if (!stall?.id) return;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [ordersRes, notifRes, chatRes, productsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('stall_id', stall.id)
          .gte('created_at', todayStart.toISOString()),
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('conversations')
          .select('*')
          .eq('stall_id', stall.id)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('products')
          .select('*')
          .eq('stall_id', stall.id)
          .order('stock_quantity', { ascending: true })
          .limit(10),
      ]);

      const todayOrders = ordersRes.data || [];
      const completedToday = todayOrders.filter(o => o.status === 'completed');
      const cancelledToday = todayOrders.filter(o => o.status === 'cancelled');
      const awaitingVerification = todayOrders.filter(o => o.payment_status === 'awaiting_verification');

      setStats({
        revenueToday: completedToday.reduce((sum, o) => sum + (o.total_amount || 0), 0),
        ordersToday: todayOrders.length,
        pendingOrders: (orderStats.pending || []).length,
        awaitingVerification: awaitingVerification.length,
        completedToday: completedToday.length,
        cancelledToday: cancelledToday.length,
      });

      // Best Sellers
      const allCompletedOrders = todayOrders.filter(o => o.status === 'completed');
      const productMap = {};
      allCompletedOrders.forEach(order => {
        (order.items || []).forEach(item => {
          if (!productMap[item.id]) {
            productMap[item.id] = { id: item.id, name: item.name, quantity: 0, revenue: 0 };
          }
          productMap[item.id].quantity += item.quantity;
          productMap[item.id].revenue += item.price * item.quantity;
        });
      });
      setBestSellers(
        Object.values(productMap)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5)
      );

      setNotifications(notifRes.data || []);
      setChats(chatRes.data || []);

      // ============================================================
      // SUKI BUYERS - Frequent Customers
      // ============================================================
      await fetchSukiBuyers();

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }, [stall, user, orderStats]);

  // ============================================================
  // SUKI BUYERS - Fetch frequent customers
  // ============================================================
  const fetchSukiBuyers = useCallback(async () => {
    if (!stall?.id) return;

    try {
      // Get all completed orders with customer info
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          total_amount,
          created_at,
          status,
          customer:customer_id (
            id,
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('stall_id', stall.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setSukiBuyers([]);
        return;
      }

      // Group by customer and count orders
      const customerMap = {};
      ordersData.forEach(order => {
        const customer = order.customer;
        if (!customer) return;

        if (!customerMap[customer.id]) {
          customerMap[customer.id] = {
            id: customer.id,
            full_name: customer.full_name || 'Customer',
            avatar_url: customer.avatar_url,
            email: customer.email,
            orderCount: 0,
            totalSpent: 0,
            lastOrderDate: order.created_at,
            firstOrderDate: order.created_at,
          };
        }

        customerMap[customer.id].orderCount += 1;
        customerMap[customer.id].totalSpent += order.total_amount || 0;
        
        // Update last order date if this order is more recent
        if (new Date(order.created_at) > new Date(customerMap[customer.id].lastOrderDate)) {
          customerMap[customer.id].lastOrderDate = order.created_at;
        }
        if (new Date(order.created_at) < new Date(customerMap[customer.id].firstOrderDate)) {
          customerMap[customer.id].firstOrderDate = order.created_at;
        }
      });

      // Convert to array and sort by order count (most frequent first)
      const sortedBuyers = Object.values(customerMap)
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 10); // Top 10 suki buyers

      setSukiBuyers(sortedBuyers);

    } catch (error) {
      console.error('Error fetching suki buyers:', error);
      setSukiBuyers([]);
    }
  }, [stall]);

  useEffect(() => {
    fetchStall();
  }, [fetchStall]);

  useFocusEffect(
    useCallback(() => {
      if (stall?.id) fetchDashboardData();
    }, [stall, fetchDashboardData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStall(), refreshOrders(), fetchDashboardData()]);
    setRefreshing(false);
  };

  const togglePause = async () => {
    if (!stall) return;
    Alert.alert(
      isPaused ? 'Open Store' : 'Close Store',
      isPaused ? 'Your store will be open for new orders.' : 'Customers will not be able to place new orders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isPaused ? 'Open' : 'Close',
          style: isPaused ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('stalls')
                .update({ is_temporarily_closed: !isPaused })
                .eq('id', stall.id);
              if (error) throw error;
              setIsPaused(!isPaused);
            } catch (error) {
              console.error('Error toggling pause:', error);
              Alert.alert('Error', 'Failed to update store status');
            }
          }
        }
      ]
    );
  };

  // ✅ Navigate to chat with customer
  const handleChatPress = async (customer) => {
    try {
      // Check if conversation exists
      const { data: existingConv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('stall_id', stall.id)
        .eq('customer_id', customer.id)
        .single();

      if (convError && convError.code !== 'PGRST116') throw convError;

      let conversationId = existingConv?.id;

      // If no conversation exists, create one
      if (!conversationId) {
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            stall_id: stall.id,
            customer_id: customer.id,
            vendor_unread_count: 0,
            customer_unread_count: 0,
            last_message: 'Start a conversation',
            last_message_time: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (createError) throw createError;
        conversationId = newConv.id;
      }

      // Navigate to chat detail
      navigation.navigate('VendorChatDetail', {
        conversationId: conversationId,
        customer: {
          id: customer.id,
          full_name: customer.full_name,
          avatar_url: customer.avatar_url,
        },
        stall: stall,
      });

    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', 'Could not open chat. Please try again.');
    }
  };

  // ============================================================
  // STAT CARD COMPONENT
  // ============================================================
  const StatCard = ({ title, value, icon, iconBg, onPress, isCurrency = false }) => {
    const displayValue = isCurrency ? `₱${value.toFixed(2)}` : value;
    
    return (
      <TouchableOpacity 
        style={styles.statCard} 
        onPress={onPress} 
        activeOpacity={0.7}
        disabled={!onPress}
      >
        <View style={[styles.statIconContainer, { backgroundColor: iconBg || COLORS.primarySurface }]}>
          <Ionicons name={icon} size={22} color={COLORS.primary} />
        </View>
        <Text style={styles.statValue}>{displayValue}</Text>
        <Text style={styles.statLabel}>{title}</Text>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // SUKI BUYER CARD COMPONENT
  // ============================================================
  const SukiBuyerCard = ({ customer }) => {
    const getInitials = (name) => {
      if (!name) return '?';
      return name.charAt(0).toUpperCase();
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
      <View style={styles.sukiCard}>
        <View style={styles.sukiLeft}>
          <View style={styles.sukiAvatarContainer}>
            {customer.avatar_url ? (
              <Image source={{ uri: customer.avatar_url }} style={styles.sukiAvatar} />
            ) : (
              <View style={styles.sukiAvatarFallback}>
                <Text style={styles.sukiAvatarText}>{getInitials(customer.full_name)}</Text>
              </View>
            )}
            <View style={styles.sukiRankBadge}>
              <Text style={styles.sukiRankText}>{customer.orderCount}</Text>
            </View>
          </View>
          <View style={styles.sukiInfo}>
            <Text style={styles.sukiName} numberOfLines={1}>{customer.full_name}</Text>
            <Text style={styles.sukiOrders}>{customer.orderCount} orders</Text>
            <Text style={styles.sukiLastOrder}>Last order • {formatDate(customer.lastOrderDate)}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.sukiChatButton}
          onPress={() => handleChatPress(customer)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
          <Text style={styles.sukiChatText}>Chat</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Dashboard" subtitle="Loading..." />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </View>
    );
  }

  if (!stall) {
    return (
      <View style={styles.container}>
        <Header title="Dashboard" subtitle="No stall assigned" />
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="storefront-outline" size={56} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Stall Assigned</Text>
          <Text style={styles.emptyText}>Contact the administrator to get your stall registered</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Dashboard" subtitle={stall.stall_name || 'Manage your stall'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* ============================================================
            STORE STATUS BANNER
        ============================================================ */}
        <View style={styles.storeBanner}>
          <LinearGradient
            colors={isPaused ? [COLORS.primary, COLORS.primaryDark] : [COLORS.primary, COLORS.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.storeBannerGradient}
          >
            <View style={styles.storeBannerContent}>
              <View style={styles.storeBannerLeft}>
                <View style={styles.storeStatusContainer}>
                  <View style={[styles.statusDot, isPaused ? styles.statusDotClosed : styles.statusDotOpen]} />
                  <Text style={styles.storeStatusLabel}>
                    {isPaused ? 'Closed' : 'Open'}
                  </Text>
                </View>
                <Text style={styles.storeName}>
                  {stall.stall_name || 'Your Stall'}
                </Text>
                <Text style={styles.storeSubtitle}>
                  Stall #{stall.stall_number} · {stall.section || 'No Section'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.storeToggleBtn, isPaused && styles.storeToggleBtnClosed]} 
                onPress={togglePause}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={isPaused ? 'play-outline' : 'pause-outline'} 
                  size={16} 
                  color="#FFFFFF" 
                />
                <Text style={styles.storeToggleText}>
                  {isPaused ? 'Open Store' : 'Close Store'}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {isPaused && (
          <View style={styles.closedWarning}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.closedWarningText}>
              Store is closed. Customers cannot place orders.
            </Text>
          </View>
        )}

        {/* ============================================================
            STATS GRID - 4 Cards
        ============================================================ */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Today's Revenue"
            value={stats.revenueToday}
            icon="cash-outline"
            iconBg={COLORS.primarySurface}
            isCurrency
          />
          <StatCard
            title="Pending Orders"
            value={stats.pendingOrders}
            icon="time-outline"
            iconBg="#FEF3C7"
            onPress={() => navigation.navigate('VendorOrders')}
          />
          <StatCard
            title="Awaiting Verify"
            value={stats.awaitingVerification}
            icon="card-outline"
            iconBg="#DBEAFE"
            onPress={() => navigation.navigate('VendorOrders')}
          />
          <StatCard
            title="Completed Today"
            value={stats.completedToday}
            icon="checkmark-done-outline"
            iconBg="#D1FAE5"
          />
        </View>

        {/* ============================================================
            QUICK ACTIONS - 2x3 Grid
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={() => navigation.navigate('VendorOrders')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: COLORS.primarySurface }]}>
                <Ionicons name="receipt-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={() => navigation.navigate('VendorProducts')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="cube-outline" size={24} color={COLORS.success} />
              </View>
              <Text style={styles.quickActionLabel}>Products</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={() => navigation.navigate('VendorReports')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="bar-chart-outline" size={24} color={COLORS.purple} />
              </View>
              <Text style={styles.quickActionLabel}>Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={() => navigation.navigate('VendorNotifications')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="notifications-outline" size={24} color={COLORS.warning} />
              </View>
              <Text style={styles.quickActionLabel}>Alerts</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={() => navigation.navigate('VendorProfile')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FCE4EC' }]}>
                <Ionicons name="person-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickAction} 
              onPress={() => navigation.navigate('VendorChats')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="chatbubbles-outline" size={24} color={COLORS.info} />
              </View>
              <Text style={styles.quickActionLabel}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================
            SUKI BUYERS - REPLACES LOW STOCK
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Suki Buyers</Text>
            <Ionicons name="heart-outline" size={18} color={COLORS.primary} />
          </View>

          {sukiBuyers.length === 0 ? (
            <View style={styles.emptySukiContainer}>
              <Ionicons name="people-outline" size={40} color={COLORS.text.lighter} />
              <Text style={styles.emptySukiTitle}>No loyal customers yet</Text>
              <Text style={styles.emptySukiText}>
                Customers who frequently order from you will appear here
              </Text>
            </View>
          ) : (
            sukiBuyers.map((customer, index) => (
              <SukiBuyerCard key={customer.id || index} customer={customer} />
            ))
          )}
        </View>

        {/* ============================================================
            RECENT ORDERS
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            {orderStats.pending?.length > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{orderStats.pending.length}</Text>
              </View>
            )}
            <TouchableOpacity 
              onPress={() => navigation.navigate('VendorOrders')}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>See All →</Text>
            </TouchableOpacity>
          </View>

          {ordersLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
          ) : (orderStats.active || []).length === 0 ? (
            <View style={styles.emptyOrdersContainer}>
              <Ionicons name="inbox-outline" size={40} color={COLORS.text.lighter} />
              <Text style={styles.emptyOrdersTitle}>No active orders</Text>
              <Text style={styles.emptyOrdersText}>New orders will appear here in real-time</Text>
            </View>
          ) : (
            (orderStats.active || []).slice(0, 3).map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => navigation.navigate('VendorOrderDetail', { orderId: order.id })}
                activeOpacity={0.7}
              >
                <View style={styles.orderCardHeader}>
                  <Text style={styles.orderNumber}>Order #{order.order_number?.slice(-8) || order.id?.slice(-8)}</Text>
                  <View style={[
                    styles.orderStatusBadge,
                    order.status === 'completed' && styles.orderStatusCompleted,
                    order.status === 'cancelled' && styles.orderStatusCancelled,
                    order.status === 'pending' && styles.orderStatusPending,
                  ]}>
                    <Text style={styles.orderStatusText}>{order.status?.toUpperCase() || 'PENDING'}</Text>
                  </View>
                </View>
                <Text style={styles.orderItems} numberOfLines={1}>
                  {order.items?.map(item => item.name).join(', ') || 'No items'}
                </Text>
                <View style={styles.orderCardFooter}>
                  <Text style={styles.orderTotal}>₱{order.total_amount?.toFixed(2)}</Text>
                  <Text style={styles.orderTime}>
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ============================================================
            BEST SELLERS
        ============================================================ */}
        {bestSellers.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Best Sellers</Text>
              <Ionicons name="flame-outline" size={18} color={COLORS.primary} />
            </View>
            {bestSellers.map((product, idx) => (
              <View key={idx} style={styles.productRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{idx + 1}</Text>
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>
                    {product.quantity} sold · ₱{product.revenue.toFixed(2)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.text.lighter} />
              </View>
            ))}
          </View>
        )}

        {/* ============================================================
            ACCOUNT SECTION
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileCard} 
            onPress={() => navigation.navigate('VendorProfile')}
            activeOpacity={0.7}
          >
            <View style={styles.profileAvatar}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatarImg} />
              ) : (
                <Text style={styles.profileAvatarText}>
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'V'}
                </Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.full_name || 'Vendor'}</Text>
              <Text style={styles.profileSub}>View and manage your profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text.lighter} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.text.light,
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
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.dark,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.light,
    textAlign: 'center',
  },

  // ── Store Banner ──
  storeBanner: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  storeBannerGradient: {
    padding: SPACING.xl,
  },
  storeBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeBannerLeft: {
    flex: 1,
  },
  storeStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOpen: {
    backgroundColor: COLORS.success,
  },
  statusDotClosed: {
    backgroundColor: COLORS.error,
  },
  storeStatusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  storeSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  storeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  storeToggleBtnClosed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  storeToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Closed Warning ──
  closedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySurface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    padding: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  closedWarningText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },

  // ── Stats Grid ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text.dark,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.light,
    marginTop: 2,
  },

  // ── Section Cards ──
  sectionCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.dark,
    flex: 1,
  },
  pendingBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // ── Quick Actions ──
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAction: {
    width: '30%',
    alignItems: 'center',
    padding: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.text.light,
    textAlign: 'center',
  },

  // ── Order Cards ──
  orderCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    backgroundColor: '#FEF3C7',
  },
  orderStatusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  orderStatusCancelled: {
    backgroundColor: '#FEE2E2',
  },
  orderStatusPending: {
    backgroundColor: '#FEF3C7',
  },
  orderStatusText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  orderItems: {
    fontSize: 13,
    color: COLORS.text.medium,
    marginBottom: 4,
  },
  orderCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  orderTime: {
    fontSize: 11,
    color: COLORS.text.light,
  },
  loader: {
    paddingVertical: 20,
  },

  // ── Empty Orders ──
  emptyOrdersContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyOrdersTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginTop: 8,
  },
  emptyOrdersText: {
    fontSize: 13,
    color: COLORS.text.light,
    marginTop: 2,
  },

  // ── Products ──
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.dark,
  },
  productMeta: {
    fontSize: 11,
    color: COLORS.text.light,
    marginTop: 1,
  },

  // ── Suki Buyers ──
  sukiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sukiLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sukiAvatarContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  sukiAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  sukiAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sukiAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sukiRankBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
    paddingHorizontal: 4,
  },
  sukiRankText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sukiInfo: {
    flex: 1,
  },
  sukiName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  sukiOrders: {
    fontSize: 12,
    color: COLORS.text.light,
    marginTop: 1,
  },
  sukiLastOrder: {
    fontSize: 11,
    color: COLORS.text.lighter,
    marginTop: 1,
  },
  sukiChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySurface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  sukiChatText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // ── Empty Suki ──
  emptySukiContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptySukiTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginTop: 8,
  },
  emptySukiText: {
    fontSize: 13,
    color: COLORS.text.light,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Profile ──
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  profileAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  profileSub: {
    fontSize: 12,
    color: COLORS.text.light,
    marginTop: 1,
  },

  // ── Spacer ──
  bottomSpacer: {
    height: 30,
  },
});