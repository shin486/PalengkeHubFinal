// src/screens/vendor/VendorDashboardScreen.js

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import { WovenBackground } from '../../components/WovenBackground';
import StallLocationCapture from '../../components/vendor/StallLocationCapture';
import { fetchCurrentStallLocation } from '../../services/stallLocationService';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useVendorOrders } from '../../hooks/useVendorOrders';
import { SPACING, RADIUS, TEXT_STYLES } from '../../theme/tokens';

// ============================================================
// COLORS - Theme-aware (from ThemeContext)
// ============================================================

// ============================================================
// SUKI BUYER CARD COMPONENT - WITH IMAGES (FIXED BLINKING)
// ============================================================
// Must live at module scope, not inside VendorDashboardScreen. A component
// defined inside another component's function body gets a brand-new
// function identity every time the parent re-renders, which means the
// memo() wrapper below was previously wrapping a *different* component on
// every render — React treated each render's cards as a totally different
// component type and remounted them (and their <Image>s) from scratch,
// which is what actually caused the blink. Hoisting it here lets memo()
// do its job: the same consumer prop now really does skip re-rendering.
const SukiBuyerCard = memo(({ consumer, styles, COLORS, onChatPress }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

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

  // Use a stable image key to prevent reloading
  const imageKey = consumer.id;

  return (
    <View style={styles.sukiCard}>
      <View style={styles.sukiLeft}>
        <View style={styles.sukiAvatarContainer}>
          {consumer.avatar_url && !imageError ? (
            <Image
              key={imageKey}
              source={{ uri: consumer.avatar_url }}
              style={styles.sukiAvatar}
              onError={() => setImageError(true)}
              onLoad={() => setImageLoaded(true)}
              progressiveRenderingEnabled={true}
              fadeDuration={0}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.sukiAvatarFallback}>
              <Text style={styles.sukiAvatarText}>{getInitials(consumer.full_name)}</Text>
            </View>
          )}
          <View style={styles.sukiRankBadge}>
            <Text style={styles.sukiRankText}>{consumer.orderCount}</Text>
          </View>
        </View>
        <View style={styles.sukiInfo}>
          <Text style={styles.sukiName} numberOfLines={1}>{consumer.full_name}</Text>
          <Text style={styles.sukiOrders}>{consumer.orderCount} orders</Text>
          <Text style={styles.sukiLastOrder}>Last order • {formatDate(consumer.lastOrderDate)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.sukiChatButton}
        onPress={() => onChatPress(consumer)}
        activeOpacity={0.7}
      >
        <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
        <Text style={styles.sukiChatText}>Chat</Text>
      </TouchableOpacity>
    </View>
  );
});

export default function VendorDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();
  const { colors: COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [stall, setStall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [chats, setChats] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [sukiBuyers, setSukiBuyers] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [sukiLoading, setSukiLoading] = useState(false);
  const [stallLocation, setStallLocation] = useState(null);
  const [showLocationCapture, setShowLocationCapture] = useState(false);
  const dataFetchedRef = useRef(false);

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
      if (data) {
        setIsPaused(data.is_temporarily_closed || false);
        try {
          setStallLocation(await fetchCurrentStallLocation(data.id));
        } catch (locError) {
          console.warn('Error fetching stall location:', locError.message);
        }
      }
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

  // ============================================================
  // SUKI BUYERS - Fetch frequent customers (with cache check)
  // ============================================================
  const fetchSukiBuyers = useCallback(async () => {
    if (!stall?.id) return;
    
    // Skip if already fetched and not refreshing
    if (dataFetchedRef.current && !refreshing) {
      console.log('⏭ Suki buyers already loaded, skipping...');
      return;
    }
    
    if (sukiLoading) return;

    try {
      setSukiLoading(true);
      console.log(' Fetching suki buyers...');

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          consumer_id,
          total_amount,
          created_at,
          status
        `)
        .eq('stall_id', stall.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      if (!ordersData || ordersData.length === 0) {
        setSukiBuyers([]);
        dataFetchedRef.current = true;
        setSukiLoading(false);
        return;
      }

      const consumerIds = [...new Set(ordersData.map(order => order.consumer_id).filter(id => id))];
      
      if (consumerIds.length === 0) {
        setSukiBuyers([]);
        dataFetchedRef.current = true;
        setSukiLoading(false);
        return;
      }

      const { data: consumersData, error: consumersError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .in('id', consumerIds);

      if (consumersError) throw consumersError;

      const consumerMap = {};
      consumersData?.forEach(consumer => {
        consumerMap[consumer.id] = {
          id: consumer.id,
          full_name: consumer.full_name || 'Customer',
          avatar_url: consumer.avatar_url,
          email: consumer.email,
          orderCount: 0,
          totalSpent: 0,
          lastOrderDate: null,
          firstOrderDate: null,
        };
      });

      ordersData.forEach(order => {
        const consumerId = order.consumer_id;
        if (!consumerId || !consumerMap[consumerId]) return;
        const consumer = consumerMap[consumerId];
        consumer.orderCount += 1;
        consumer.totalSpent += order.total_amount || 0;
        if (!consumer.lastOrderDate || new Date(order.created_at) > new Date(consumer.lastOrderDate)) {
          consumer.lastOrderDate = order.created_at;
        }
        if (!consumer.firstOrderDate || new Date(order.created_at) < new Date(consumer.firstOrderDate)) {
          consumer.firstOrderDate = order.created_at;
        }
      });

      const sortedBuyers = Object.values(consumerMap)
        .filter(c => c.orderCount > 0)
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 10);

      // Only update if data changed
      setSukiBuyers(prev => {
        if (prev.length === sortedBuyers.length && 
            prev.every((p, i) => p.id === sortedBuyers[i]?.id)) {
          return prev; // No change
        }
        return sortedBuyers;
      });
      
      dataFetchedRef.current = true;

    } catch (error) {
      console.error('Error fetching suki buyers:', error);
      setSukiBuyers([]);
    } finally {
      setSukiLoading(false);
    }
  }, [stall, sukiLoading, refreshing]);

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

      // Fetch Suki Buyers
      await fetchSukiBuyers();

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }, [stall, user, orderStats, fetchSukiBuyers]);

  useEffect(() => {
    fetchStall();
  }, [fetchStall]);

  useFocusEffect(
    useCallback(() => {
      if (stall?.id) {
        fetchDashboardData();
      }
    }, [stall, fetchDashboardData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    dataFetchedRef.current = false; // Allow re-fetch on refresh
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

  // Navigate to chat with consumer
  const handleChatPress = async (consumer) => {
    try {
      const { data: existingConv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('stall_id', stall.id)
        .eq('customer_id', consumer.id)
        .single();

      if (convError && convError.code !== 'PGRST116') throw convError;

      let conversationId = existingConv?.id;

      if (!conversationId) {
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            stall_id: stall.id,
            customer_id: consumer.id,
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

      navigation.navigate('VendorChatDetail', {
        conversationId: conversationId,
        customer: {
          id: consumer.id,
          full_name: consumer.full_name,
          avatar_url: consumer.avatar_url,
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

  const unreadNotifCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <View style={styles.container}>
        <WovenBackground isDark={isDark} />
        <Header
          title="Dashboard"
          subtitle="Loading..."
          showNotifications
          notificationCount={unreadNotifCount}
          onNotificationPress={() => navigation.navigate('VendorNotifications')}
        />
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
        <WovenBackground isDark={isDark} />
        <Header
          title="Dashboard"
          subtitle="No stall assigned"
          showNotifications
          notificationCount={unreadNotifCount}
          onNotificationPress={() => navigation.navigate('VendorNotifications')}
        />
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
      <WovenBackground isDark={isDark} />
      <Header
        title="Dashboard"
        subtitle={stall.stall_name || 'Manage your stall'}
        showNotifications
        notificationCount={unreadNotifCount}
        onNotificationPress={() => navigation.navigate('VendorNotifications')}
      />

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
                  color={COLORS.text.inverse}
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

        {!stallLocation && (
          <TouchableOpacity
            style={styles.locationNudge}
            onPress={() => setShowLocationCapture(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate-outline" size={18} color={COLORS.primary} />
            <View style={styles.locationNudgeTextWrap}>
              <Text style={styles.locationNudgeTitle}>Set your stall location</Text>
              <Text style={styles.locationNudgeSubtitle}>
                Stand at your stall and tap here — takes about 10 seconds
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* ============================================================
            STATS GRID
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
            iconBg={COLORS.warningLight}
            onPress={() => navigation.navigate('VendorOrders')}
          />
          <StatCard
            title="Awaiting Verify"
            value={stats.awaitingVerification}
            icon="card-outline"
            iconBg={COLORS.infoLight}
            onPress={() => navigation.navigate('VendorOrders')}
          />
          <StatCard
            title="Completed Today"
            value={stats.completedToday}
            icon="checkmark-done-outline"
            iconBg={COLORS.successLight}
          />
        </View>

        {/* ============================================================
            STORE TOOLS - Only Reports and Notifications
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Store Tools</Text>
            <Ionicons name="construct-outline" size={18} color={COLORS.text.lighter} />
          </View>
          <View style={styles.quickActionsGrid}>
            {/* Alerts tile removed — it duplicated the bell icon already in
                the header above, both opening the same VendorNotifications
                screen. */}
            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionFull]}
              onPress={() => navigation.navigate('VendorReports')}
              activeOpacity={0.7}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: COLORS.infoLight }]}>
                <Ionicons name="bar-chart-outline" size={24} color={COLORS.info} />
              </View>
              <Text style={styles.quickActionLabel}>Reports</Text>
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

          {sukiLoading && sukiBuyers.length === 0 ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
          ) : sukiBuyers.length === 0 ? (
            <View style={styles.emptySukiContainer}>
              <Ionicons name="people-outline" size={40} color={COLORS.text.lighter} />
              <Text style={styles.emptySukiTitle}>No loyal customers yet</Text>
              <Text style={styles.emptySukiText}>
                Customers who frequently order from you will appear here
              </Text>
            </View>
          ) : (
            sukiBuyers.map((consumer) => (
              <SukiBuyerCard key={consumer.id} consumer={consumer} styles={styles} COLORS={COLORS} onChatPress={handleChatPress} />
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

      <StallLocationCapture
        visible={showLocationCapture}
        stallId={stall?.id}
        capturedBy="vendor"
        reason={stallLocation?.reregister_reason || null}
        onClose={() => setShowLocationCapture(false)}
        onSaved={(saved) => setStallLocation(saved)}
      />
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

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
    ...TEXT_STYLES.h1,
    color: COLORS.text.dark,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.light,
    textAlign: 'center',
  },

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
    ...TEXT_STYLES.h1,
    color: COLORS.text.inverse,
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
    color: COLORS.text.inverse,
  },

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

  locationNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primarySurface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  locationNudgeTextWrap: {
    flex: 1,
  },
  locationNudgeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  locationNudgeSubtitle: {
    fontSize: 11,
    color: COLORS.text.light,
    marginTop: 1,
  },

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
    ...TEXT_STYLES.h1,
    color: COLORS.text.dark,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.light,
    marginTop: 2,
  },

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
    ...TEXT_STYLES.h3,
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
    color: COLORS.text.inverse,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionFull: {
    width: '100%',
  },
  quickAction: {
    width: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
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
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.dark,
    textAlign: 'center',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.text.inverse,
  },

  // Suki Buyers
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
    backgroundColor: COLORS.surfaceSecondary,
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
    color: COLORS.text.inverse,
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
    color: COLORS.text.inverse,
  },
  sukiInfo: {
    flex: 1,
  },
  sukiName: {
    ...TEXT_STYLES.bodySmall,
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

  // Recent Orders
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
    backgroundColor: COLORS.warningLight,
  },
  orderStatusCompleted: {
    backgroundColor: COLORS.successLight,
  },
  orderStatusCancelled: {
    backgroundColor: COLORS.errorLight,
  },
  orderStatusPending: {
    backgroundColor: COLORS.warningLight,
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
    fontFamily: 'Baloo2_800ExtraBold',
    fontWeight: '800',
    color: COLORS.primary,
  },
  orderTime: {
    fontSize: 11,
    color: COLORS.text.light,
  },
  loader: {
    paddingVertical: 20,
  },

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

  // Best Sellers
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
    ...TEXT_STYLES.bodySmall,
    color: COLORS.text.dark,
  },
  productMeta: {
    fontSize: 11,
    color: COLORS.text.light,
    marginTop: 1,
  },

  // Profile
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
    color: COLORS.text.inverse,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...TEXT_STYLES.bodySmall,
    color: COLORS.text.dark,
  },
  profileSub: {
    fontSize: 12,
    color: COLORS.text.light,
    marginTop: 1,
  },

  bottomSpacer: {
    height: 30,
  },
});