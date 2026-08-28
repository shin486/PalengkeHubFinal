// Pickup Pass — the customer shows this to the vendor when picking up an
// order. Restyled as a paper ticket/receipt (design-system.html's Code
// Block + Description List + Badge patterns) instead of a solid-color
// card, while keeping the large order code and stall name for readability.
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

const STATUS_TONE = {
  pending: 'warning',
  confirmed: 'info',
  preparing: 'info',
  ready: 'success',
  completed: 'success',
  cancelled: 'error',
};

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
  const statusTone = STATUS_TONE[status] || 'warning';
  const isPaid = order?.payment_status === 'paid';
  const pickupTime = order?.pickup_time
    ? new Date(order.pickup_time).toLocaleString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
    : t('orders.pickup_asap', 'Ngayon');
  const paymentMethod = order?.payment_method === 'gcash' ? 'GCash' : 'Cash';

  const toneColor = {
    success: COLORS.success,
    warning: COLORS.warning,
    info: COLORS.info,
    error: COLORS.error,
  }[statusTone];
  const toneBg = {
    success: COLORS.successLight,
    warning: COLORS.warningLight,
    info: COLORS.infoLight,
    error: COLORS.errorLight,
  }[statusTone];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.primary} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('orders.pickup_pass')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Ticket card ── */}
        <View style={styles.ticketCard}>
          <View style={styles.ticketHead}>
            <View style={styles.ticketHeadLeft}>
              <View style={styles.ticketIconBadge}>
                <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.ticketTitle}>{t('orders.pickup_title')}</Text>
                <Text style={styles.ticketSubtitle}>{t('orders.show_to_vendor', 'Ipakita ito sa vendor')}</Text>
              </View>
            </View>
            <View style={[styles.paidBadge, { backgroundColor: isPaid ? COLORS.successLight : COLORS.warningLight }]}>
              <Text style={[styles.paidBadgeText, { color: isPaid ? COLORS.success : COLORS.warning }]}>
                {isPaid ? t('orders.paid', 'BAYAD NA') : t('orders.unpaid', 'HINDI PA BAYAD')}
              </Text>
            </View>
          </View>

          <View style={styles.codeStrip}>
            <Text style={styles.codeStripText}>PH-{orderNumber}</Text>
          </View>

          <View style={styles.descRow}>
            <Text style={styles.descLabel}>{t('orders.stall_number_label', 'Stall')}</Text>
            <Text style={styles.descValue} numberOfLines={1}>{stallName}, #{stallNumber}</Text>
          </View>
          <View style={styles.descRow}>
            <Text style={styles.descLabel}>{t('orders.pickup_time', 'Oras')}</Text>
            <Text style={styles.descValue}>{pickupTime}</Text>
          </View>
          <View style={styles.descRow}>
            <Text style={styles.descLabel}>{t('orders.payment', 'Bayad')}</Text>
            <Text style={styles.descValue}>{paymentMethod}, {isPaid ? t('orders.confirmed', 'confirmed') : t('orders.pending', 'pending')}</Text>
          </View>
          <View style={styles.descRow}>
            <Text style={styles.descLabel}>{t('orders.status_label', 'Status')}</Text>
            <View style={[styles.statusChip, { backgroundColor: toneBg }]}>
              <Text style={[styles.statusChipText, { color: toneColor }]}>{statusText}</Text>
            </View>
          </View>

          {items.length > 0 && (
            <>
              <View style={styles.dashedDivider} />
              {items.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name || 'Item'} {item.quantity && item.quantity > 1 ? `x${item.quantity}` : ''}
                  </Text>
                  <Text style={styles.itemPrice}>₱{parseFloat(item.price ?? 0).toFixed(0)}</Text>
                </View>
              ))}
              {order?.total_amount ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t('orders.total_label', 'Kabuuan')}</Text>
                  <Text style={styles.totalValue}>₱{parseFloat(order.total_amount).toFixed(0)}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

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

  // ── Ticket card ──
  ticketCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  ticketHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ticketHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  ticketIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  ticketSubtitle: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  paidBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  paidBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  codeStrip: {
    backgroundColor: COLORS.text.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeStripText: {
    color: COLORS.text.inverse,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 4,
  },
  descRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  descLabel: {
    fontSize: 14,
    color: COLORS.text.tertiary,
  },
  descValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
    flexShrink: 1,
    textAlign: 'right',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  dashedDivider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    marginVertical: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text.secondary,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  totalLabel: {
    fontSize: 16,
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
