// Pickup Pass — a big, simple screen the customer shows to the vendor when
// picking up an order. Designed for elderly users: huge text, no navigation.
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/i18nContext';

export default function PickupPassScreen({ route, navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { t } = useI18n();
  const { order, stall } = route.params || {};
  const orderNumber = order?.order_number?.slice(-8) || order?.id?.toString().slice(-8) || '—';
  const stallName = stall?.stall_name || order?.stalls?.stall_name || 'Market Stall';
  const stallNumber = stall?.stall_number || order?.stalls?.stall_number || '—';
  const items = Array.isArray(order?.items) ? order.items : [];
  const status = order?.status || 'pending';
  const statusText = t(`orders.status.${status}`, t('orders.status.pending'));
  const isReady = status === 'ready';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('orders.pickup_pass')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.passCard, isReady ? styles.passCardReady : null]}>
          <Text style={styles.passTitle}>{t('orders.pickup_title')}</Text>
          <Ionicons name="receipt-outline" size={52} color="#FFFFFF" style={{ marginVertical: 8 }} />

          <Text style={styles.orderLabel}>{t('orders.order_number')}</Text>
          <Text style={styles.orderNumber}>{orderNumber}</Text>

          <View style={styles.divider} />

          <Text style={styles.stallLabel}>{t('orders.stall_number_label', 'Stall')}</Text>
          <Text style={styles.stallName}>{stallName}</Text>
          <Text style={styles.stallNumber}>#{stallNumber}</Text>

          <View style={[styles.statusBanner, isReady ? styles.statusBannerReady : null]}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>

        {items.length > 0 && (
          <View style={styles.itemsCard}>
            <Text style={styles.itemsTitle}>{t('cart.items') || 'Items'}</Text>
            {items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name || 'Item'}
                </Text>
                <Text style={styles.itemQty}>
                  x{item.quantity ?? 1} — ₱{parseFloat(item.price ?? 0).toFixed(2)}
                </Text>
              </View>
            ))}
            {order?.total_amount ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('products.total')}:</Text>
                <Text style={styles.totalValue}>₱{parseFloat(order.total_amount).toFixed(2)}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.instructionCard}>
          <Text style={styles.instructionText}>{t('orders.show_phone_to_vendor')}</Text>
          <Text style={styles.instructionHint}>{t('orders.pickup_hint')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  passCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  passCardReady: {
    backgroundColor: '#16A34A',
  },
  passTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
  },
  orderLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 8,
  },
  orderNumber: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'stretch',
    marginVertical: 16,
  },
  stallLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
  },
  stallName: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 4,
  },
  stallNumber: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    marginTop: 2,
  },
  statusBanner: {
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusBannerReady: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  itemsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  itemsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text.primary,
  },
  itemQty: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.medium,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
  },
  instructionCard: {
    backgroundColor: COLORS.warningLight,
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    borderWidth: 2,
    borderColor: COLORS.warning,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.warning,
    textAlign: 'center',
  },
  instructionHint: {
    fontSize: 14,
    color: COLORS.warning,
    marginTop: 8,
    textAlign: 'center',
  },
});
