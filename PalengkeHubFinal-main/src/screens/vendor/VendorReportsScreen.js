// src/screens/vendor/VendorReportsScreen.js
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContext';
import {
  useVendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
} from '../../theme/vendorTheme';
import { VendorSkeletonList } from '../../components/vendor/VendorLoadingState';
import { VendorEmptyState } from '../../components/vendor/VendorEmptyState';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  } catch {
    return '';
  }
};

const getStatusColor = (status, vendorColors) => {
  const map = {
    pending: vendorColors.warning,
    confirmed: vendorColors.info,
    preparing: vendorColors.purple,
    ready: vendorColors.success,
    completed: vendorColors.success,
    cancelled: vendorColors.danger,
  };
  return map[status] || vendorColors.text.secondary;
};

const formatPaymentMethod = (method, t) => {
  if (!method || method === 'Unknown') return t('common.unknown', 'Unknown');
  const lower = method.toLowerCase();
  if (lower === 'gcash') return 'GCash';
  if (lower === 'cod' || lower === 'cash_on_delivery' || lower === 'cash') return t('vendor_reports.cash', 'Cash');
  return method.charAt(0).toUpperCase() + method.slice(1);
};

export default function VendorReportsScreen({ navigation }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const vendorColors = useVendorColors();
  const styles = useMemo(() => createStyles(vendorColors), [vendorColors]);

  const [stall, setStall] = useState(null);
  const [period, setPeriod] = useState('week');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const periods = useMemo(() => [
    { key: 'day', label: t('vendor_reports.period_day', 'Today') },
    { key: 'week', label: t('vendor_reports.period_week', 'Week') },
    { key: 'month', label: t('vendor_reports.period_month', 'Month') },
  ], [t]);

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

  const fetchOrders = useCallback(async () => {
    if (!stall?.id) return;
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      let startDate;
      if (period === 'day') {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === 'week') {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('stall_id', stall.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(t('vendor_reports.failed_load', 'Failed to load reports'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stall, period, t]);

  useFocusEffect(
    useCallback(() => {
      fetchStall();
    }, [fetchStall])
  );

  useFocusEffect(
    useCallback(() => {
      if (stall?.id) fetchOrders();
    }, [stall, period, fetchOrders])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchStall()]);
  };

  const stats = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed');
    const cancelled = orders.filter(o => o.status === 'cancelled');
    const pending = orders.filter(o => o.status === 'pending');
    const totalRevenue = completed.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const avgOrder = completed.length > 0 ? totalRevenue / completed.length : 0;
    const verifiedPayments = orders.filter(o => o.payment_status === 'verified' || o.payment_status === 'paid').length;
    const paymentRate = orders.length > 0 ? (verifiedPayments / orders.length) * 100 : 0;

    // Top products
    const productMap = {};
    completed.forEach(order => {
      (order.items || []).forEach(item => {
        if (!productMap[item.id]) {
          productMap[item.id] = { name: item.name, quantity: 0, revenue: 0 };
        }
        productMap[item.id].quantity += item.quantity;
        productMap[item.id].revenue += item.price * item.quantity;
      });
    });
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Payment method breakdown
    const paymentMethods = {};
    orders.forEach(order => {
      const method = order.payment_method || 'Unknown';
      if (!paymentMethods[method]) paymentMethods[method] = { count: 0, revenue: 0 };
      paymentMethods[method].count += 1;
      paymentMethods[method].revenue += order.total_amount || 0;
    });

    return {
      totalOrders: orders.length,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
      pendingOrders: pending.length,
      totalRevenue,
      avgOrder,
      paymentRate: Math.round(paymentRate),
      topProducts,
      paymentMethods,
    };
  }, [orders]);

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Header
          title={t('vendor_reports.title', 'Reports')}
          subtitle={stall?.stall_name || t('vendor_reports.subtitle', 'Business analytics')}
          showBack
          onBackPress={() => navigation.goBack()}
        />
        <VendorSkeletonList count={5} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title={t('vendor_reports.title', 'Reports')}
        subtitle={stall?.stall_name || t('vendor_reports.subtitle', 'Business analytics')}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[vendorColors.primary]}
            tintColor={vendorColors.primary}
          />
        }
      >
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {periods.map((p) => {
            const isActive = period === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodBtn, isActive && styles.periodBtnActive]}
                onPress={() => setPeriod(p.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.periodText,
                    isActive && styles.periodTextActive,
                    { color: isActive ? '#FFFFFF' : (vendorColors.isDark ? '#F7EDE1' : '#5B4436') },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? (
          <VendorEmptyState
            variant="compact"
            icon="alert-circle-outline"
            title={t('vendor_reports.failed_load', 'Failed to load reports')}
            message={error}
            actionLabel={t('common.try_again', 'Try Again')}
            onAction={fetchOrders}
          />
        ) : orders.length === 0 ? (
          <VendorEmptyState
            icon="bar-chart-outline"
            title={t('vendor_reports.no_data_title', 'No data for this period')}
            message={t('vendor_reports.no_data_message', 'Orders will appear here once customers place orders')}
          />
        ) : (
          <>
            {/* Revenue Overview */}
            <View style={styles.statsGrid}>
              <TouchableOpacity
                style={styles.summaryCard}
                onPress={() => navigation.navigate('VendorOrders')}
                activeOpacity={0.7}
              >
                <View style={[styles.summaryIcon, { backgroundColor: vendorColors.accentSoft }]}>
                  <Ionicons name="cash-outline" size={20} color={vendorColors.primary} />
                </View>
                <Text style={[styles.summaryCardValue, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                  ₱{Number(stats.totalRevenue || 0).toFixed(2)}
                </Text>
                <Text style={[styles.summaryCardLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                  {t('vendor_reports.total_sales', 'Total Sales')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.summaryCard}
                onPress={() => navigation.navigate('VendorOrders')}
                activeOpacity={0.7}
              >
                <View style={[styles.summaryIcon, { backgroundColor: vendorColors.infoLight }]}>
                  <Ionicons name="receipt-outline" size={20} color={vendorColors.info} />
                </View>
                <Text style={[styles.summaryCardValue, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                  {stats.totalOrders}
                </Text>
                <Text style={[styles.summaryCardLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                  {t('vendor_reports.orders', 'Orders')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.summaryCard}
                activeOpacity={0.7}
                disabled
              >
                <View style={[styles.summaryIcon, { backgroundColor: vendorColors.successLight }]}>
                  <Ionicons name="calculator-outline" size={20} color={vendorColors.success} />
                </View>
                <Text style={[styles.summaryCardValue, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                  ₱{Number(stats.avgOrder || 0).toFixed(2)}
                </Text>
                <Text style={[styles.summaryCardLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                  {t('vendor_reports.avg_order', 'Avg Order')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.summaryCard}
                activeOpacity={0.7}
                disabled
              >
                <View style={[styles.summaryIcon, { backgroundColor: vendorColors.purpleLight }]}>
                  <Ionicons name="card-outline" size={20} color={vendorColors.purple} />
                </View>
                <Text style={[styles.summaryCardValue, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                  {stats.paymentRate}%
                </Text>
                <Text style={[styles.summaryCardLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                  {t('vendor_reports.payment_rate', 'Payment Rate')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Order Summary */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="stats-chart-outline" size={18} color={vendorColors.primary} />
                </View>
                <Text style={[styles.sectionTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                  {t('vendor_reports.order_summary', 'Order Summary')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryRowValue, { color: vendorColors.success }]}>{stats.completedOrders}</Text>
                  <Text style={[styles.summaryRowLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                    {t('vendor_reports.completed', 'Completed')}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryRowValue, { color: vendorColors.warning }]}>{stats.pendingOrders}</Text>
                  <Text style={[styles.summaryRowLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                    {t('vendor_reports.pending', 'Pending')}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryRowValue, { color: vendorColors.danger }]}>{stats.cancelledOrders}</Text>
                  <Text style={[styles.summaryRowLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                    {t('vendor_reports.cancelled', 'Cancelled')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Top Products */}
            {stats.topProducts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Ionicons name="trending-up-outline" size={18} color={vendorColors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                    {t('vendor_reports.top_products', 'Top Products')}
                  </Text>
                </View>
                {stats.topProducts.map((product, idx) => (
                  <View key={idx} style={styles.productRow}>
                    <View style={styles.rankBadge}>
                      <Text style={[styles.rankText, { color: vendorColors.isDark ? '#F5B078' : vendorColors.primary }]}>
                        #{idx + 1}
                      </Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={[styles.productName, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                        {product.name}
                      </Text>
                      <Text style={[styles.productMeta, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                        {t('vendor_reports.sold_count', '%{count} sold', { count: product.quantity })}
                      </Text>
                    </View>
                    <Text style={[styles.productRevenue, { color: vendorColors.isDark ? '#F5B078' : vendorColors.primary }]}>
                      ₱{Number(product.revenue || 0).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Payment Summary */}
            {Object.keys(stats.paymentMethods).length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Ionicons name="card-outline" size={18} color={vendorColors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                    {t('vendor_reports.payment_summary', 'Payment Summary')}
                  </Text>
                </View>
                {Object.entries(stats.paymentMethods).map(([method, data]) => (
                  <View key={method} style={styles.paymentRow}>
                    <View style={styles.paymentInfo}>
                      <Text style={[styles.paymentMethod, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                        {formatPaymentMethod(method, t)}
                      </Text>
                      <Text style={[styles.paymentMeta, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                        {t('vendor_reports.orders_count', '%{count} orders', { count: data.count })}
                      </Text>
                    </View>
                    <Text style={[styles.paymentRevenue, { color: vendorColors.isDark ? '#F5B078' : vendorColors.primary }]}>
                      ₱{Number(data.revenue || 0).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent Orders */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="list-outline" size={18} color={vendorColors.primary} />
                </View>
                <Text style={[styles.sectionTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                  {t('vendor_reports.recent_orders', 'Recent Orders')}
                </Text>
              </View>
              {orders.slice(0, 5).map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderRow}
                  onPress={() => navigation.navigate('VendorOrderDetail', { orderId: order.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderInfo}>
                    <Text style={[styles.orderNumber, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                      #{order.order_number?.slice(-8)}
                    </Text>
                    <Text style={[styles.orderDate, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                      {formatDate(order.created_at)}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={[styles.orderStatus, { color: getStatusColor(order.status, vendorColors) }]}>
                      {t('order_status.' + order.status, order.status)}
                    </Text>
                    <Text style={[styles.orderTotal, { color: vendorColors.isDark ? '#F5B078' : vendorColors.primary }]}>
                      ₱{Number(order.total_amount || 0).toFixed(2)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (vendorColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: vendorColors.background,
    },
    periodSelector: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: vendorSpacing.lg,
      paddingVertical: vendorSpacing.md,
    },
    periodBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: vendorBorderRadius.full,
      backgroundColor: vendorColors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: vendorColors.border,
    },
    periodBtnActive: {
      backgroundColor: vendorColors.primary,
      borderColor: vendorColors.primary,
    },
    periodText: {
      fontSize: 13,
      fontWeight: '600',
      color: vendorColors.isDark ? '#F7EDE1' : vendorColors.text.secondary,
    },
    periodTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: vendorSpacing.lg,
      marginBottom: vendorSpacing.md,
    },
    summaryCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: vendorColors.surface,
      borderRadius: vendorBorderRadius.lg,
      padding: vendorSpacing.lg,
      borderWidth: 1,
      borderColor: vendorColors.border,
      ...vendorShadows.md,
    },
    summaryIcon: {
      width: 40,
      height: 40,
      borderRadius: vendorBorderRadius.sm,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: vendorSpacing.sm,
    },
    summaryCardValue: {
      fontSize: 20,
      fontWeight: '800',
      color: vendorColors.isDark ? '#FFFFFF' : vendorColors.text.primary,
    },
    summaryCardLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: vendorColors.isDark ? '#E2D3C4' : vendorColors.text.secondary,
      marginTop: 2,
    },
    section: {
      backgroundColor: vendorColors.surface,
      marginHorizontal: vendorSpacing.lg,
      marginBottom: vendorSpacing.md,
      padding: vendorSpacing.lg,
      borderRadius: vendorBorderRadius.xl,
      borderWidth: 1,
      borderColor: vendorColors.border,
      ...vendorShadows.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: vendorSpacing.md,
    },
    sectionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: vendorColors.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: vendorColors.isDark ? '#FFFFFF' : vendorColors.text.primary,
      flex: 1,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: vendorColors.surfaceAlt,
      borderRadius: vendorBorderRadius.md,
      padding: vendorSpacing.md,
    },
    summaryItem: {
      alignItems: 'center',
      flex: 1,
    },
    summaryRowValue: {
      fontSize: 22,
      fontWeight: '800',
      color: vendorColors.isDark ? '#FFFFFF' : vendorColors.text.primary,
    },
    summaryRowLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: vendorColors.isDark ? '#E2D3C4' : vendorColors.text.secondary,
      marginTop: 2,
    },
    summaryDivider: {
      width: 1,
      height: 30,
      backgroundColor: vendorColors.border,
    },
    productRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: vendorColors.divider,
    },
    rankBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: vendorColors.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: vendorSpacing.md,
    },
    rankText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: vendorColors.isDark ? '#F5B078' : vendorColors.primary,
    },
    productInfo: {
      flex: 1,
    },
    productName: {
      fontSize: 14,
      fontWeight: '600',
      color: vendorColors.isDark ? '#FFFFFF' : vendorColors.text.primary,
    },
    productMeta: {
      fontSize: 11,
      color: vendorColors.isDark ? '#E2D3C4' : vendorColors.text.secondary,
      marginTop: 2,
    },
    productRevenue: {
      fontSize: 14,
      fontWeight: '700',
      color: vendorColors.isDark ? '#F5B078' : vendorColors.primary,
    },
    paymentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: vendorColors.divider,
    },
    paymentInfo: {
      flex: 1,
    },
    paymentMethod: {
      fontSize: 14,
      fontWeight: '600',
      color: vendorColors.isDark ? '#FFFFFF' : vendorColors.text.primary,
    },
    paymentMeta: {
      fontSize: 11,
      color: vendorColors.isDark ? '#E2D3C4' : vendorColors.text.secondary,
      marginTop: 2,
    },
    paymentRevenue: {
      fontSize: 14,
      fontWeight: '700',
      color: vendorColors.isDark ? '#F5B078' : vendorColors.primary,
    },
    orderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: vendorColors.divider,
    },
    orderInfo: {
      flex: 1,
    },
    orderNumber: {
      fontSize: 14,
      fontWeight: '600',
      color: vendorColors.isDark ? '#FFFFFF' : vendorColors.text.primary,
    },
    orderDate: {
      fontSize: 11,
      color: vendorColors.isDark ? '#E2D3C4' : vendorColors.text.secondary,
      marginTop: 2,
    },
    orderRight: {
      alignItems: 'flex-end',
    },
    orderStatus: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    orderTotal: {
      fontSize: 14,
      fontWeight: '700',
      color: vendorColors.isDark ? '#F5B078' : vendorColors.primary,
      marginTop: 2,
    },
  });