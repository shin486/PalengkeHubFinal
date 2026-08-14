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
import {
  vendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
} from '../../theme/vendorTheme';
import { VendorSkeletonList } from '../../components/vendor/VendorLoadingState';
import { VendorEmptyState } from '../../components/vendor/VendorEmptyState';

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

const getStatusColor = (status) => {
  const map = {
    pending: vendorColors.warning,
    confirmed: vendorColors.info,
    preparing: vendorColors.purple,
    ready: vendorColors.success,
    completed: vendorColors.text.tertiary,
    cancelled: vendorColors.danger,
  };
  return map[status] || vendorColors.text.secondary;
};

// Clean summary card - matches Customer module card style
const SummaryCard = ({ title, value, icon, color, bg, onPress, isCurrency = false }) => (
  <TouchableOpacity
    style={styles.summaryCard}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={!onPress}
  >
    <View style={[styles.summaryIcon, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.summaryValue}>{isCurrency ? `₱${value.toFixed(2)}` : value}</Text>
    <Text style={styles.summaryLabel}>{title}</Text>
  </TouchableOpacity>
);

export default function VendorReportsScreen({ navigation }) {
  const { user } = useAuth();
  const [stall, setStall] = useState(null);
  const [period, setPeriod] = useState('week');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

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
      setError('Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stall, period]);

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
        <Header title="Reports" subtitle="Business analytics" />
        <VendorSkeletonList count={5} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Reports" subtitle={stall?.stall_name || 'Business analytics'} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[vendorColors.primary]} />}
      >
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <VendorEmptyState
            variant="compact"
            icon="alert-circle-outline"
            title="Failed to load reports"
            message={error}
            actionLabel="Retry"
            onAction={fetchOrders}
          />
        ) : orders.length === 0 ? (
          <VendorEmptyState
            icon="bar-chart-outline"
            title="No data for this period"
            message="Orders will appear here once customers place orders"
          />
        ) : (
          <>
            {/* Revenue Overview */}
            <View style={styles.statsGrid}>
              <SummaryCard
                title="Total Sales"
                value={stats.totalRevenue}
                icon="cash-outline"
                color={vendorColors.primary}
                bg={vendorColors.accentSoft}
                isCurrency
                onPress={() => navigation.navigate('VendorOrders')}
              />
              <SummaryCard
                title="Orders"
                value={stats.totalOrders}
                icon="receipt-outline"
                color={vendorColors.info}
                bg={vendorColors.infoLight}
                onPress={() => navigation.navigate('VendorOrders')}
              />
              <SummaryCard
                title="Avg Order"
                value={stats.avgOrder}
                icon="calculator-outline"
                color={vendorColors.success}
                bg={vendorColors.successLight}
                isCurrency
              />
              <SummaryCard
                title="Payment Rate"
                value={`${stats.paymentRate}%`}
                icon="card-outline"
                color={vendorColors.purple}
                bg={vendorColors.purpleLight}
              />
            </View>

            {/* Order Summary */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="stats-chart-outline" size={18} color={vendorColors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Order Summary</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: vendorColors.success }]}>{stats.completedOrders}</Text>
                  <Text style={styles.summaryLabel}>Completed</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: vendorColors.warning }]}>{stats.pendingOrders}</Text>
                  <Text style={styles.summaryLabel}>Pending</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: vendorColors.danger }]}>{stats.cancelledOrders}</Text>
                  <Text style={styles.summaryLabel}>Cancelled</Text>
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
                  <Text style={styles.sectionTitle}>Top Products</Text>
                </View>
                {stats.topProducts.map((product, idx) => (
                  <View key={idx} style={styles.productRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{idx + 1}</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productMeta}>{product.quantity} sold</Text>
                    </View>
                    <Text style={styles.productRevenue}>₱{product.revenue.toFixed(2)}</Text>
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
                  <Text style={styles.sectionTitle}>Payment Summary</Text>
                </View>
                {Object.entries(stats.paymentMethods).map(([method, data]) => (
                  <View key={method} style={styles.paymentRow}>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentMethod}>{method}</Text>
                      <Text style={styles.paymentMeta}>{data.count} orders</Text>
                    </View>
                    <Text style={styles.paymentRevenue}>₱{data.revenue.toFixed(2)}</Text>
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
                <Text style={styles.sectionTitle}>Recent Orders</Text>
              </View>
              {orders.slice(0, 5).map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderRow}
                  onPress={() => navigation.navigate('VendorOrderDetail', { orderId: order.id })}
                >
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNumber}>#{order.order_number?.slice(-8)}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(order.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={[styles.orderStatus, { color: getStatusColor(order.status) }]}>
                      {order.status}
                    </Text>
                    <Text style={styles.orderTotal}>₱{order.total_amount}</Text>
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

const styles = StyleSheet.create({
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
    fontWeight: '500',
    color: vendorColors.text.secondary,
  },
  periodTextActive: {
    color: '#FFF',
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
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: vendorColors.text.primary,
  },
  summaryLabel: {
    fontSize: 12,
    color: vendorColors.text.secondary,
    marginTop: 2,
  },
  section: {
    backgroundColor: vendorColors.surface,
    marginHorizontal: vendorSpacing.lg,
    marginBottom: vendorSpacing.md,
    padding: vendorSpacing.lg,
    borderRadius: vendorBorderRadius.xl,
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
    color: vendorColors.text.primary,
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
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 11,
    color: vendorColors.text.secondary,
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
    color: vendorColors.primary,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: vendorColors.text.primary,
  },
  productMeta: {
    fontSize: 11,
    color: vendorColors.text.secondary,
    marginTop: 2,
  },
  productRevenue: {
    fontSize: 14,
    fontWeight: '600',
    color: vendorColors.primary,
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
    fontWeight: '500',
    color: vendorColors.text.primary,
    textTransform: 'capitalize',
  },
  paymentMeta: {
    fontSize: 11,
    color: vendorColors.text.secondary,
    marginTop: 2,
  },
  paymentRevenue: {
    fontSize: 14,
    fontWeight: '600',
    color: vendorColors.primary,
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
    color: vendorColors.text.primary,
  },
  orderDate: {
    fontSize: 11,
    color: vendorColors.text.secondary,
    marginTop: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderStatus: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: vendorColors.primary,
    marginTop: 2,
  },
});