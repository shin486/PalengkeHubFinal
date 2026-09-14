// src/components/vendor/ModernOrderCard.js
import React, { useState, memo, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  useVendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
  getStatusColor,
  getStatusLabel,
} from '../../theme/vendorTheme';
import { useI18n } from '../../contexts/i18nContext';
import { VendorStatusBadge, VendorPaymentStatusBadge } from './VendorStatusBadge';

const formatOrderTime = (dateString) => {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
};

const formatPickupTime = (dateString) => {
  try {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
};

const getNextStatus = (status, t = (k, d) => d) => {
  const flow = {
    pending: { status: 'confirmed', label: t('vendor_orders.confirm_order', 'Confirm Order') },
    confirmed: { status: 'preparing', label: t('vendor_orders.start_preparing', 'Start Preparing') },
    preparing: { status: 'ready', label: t('vendor_orders.mark_ready', 'Mark Ready') },
    ready: { status: 'completed', label: t('vendor_orders.complete_order', 'Complete Order') },
  };
  return flow[status];
};

// Extracted inner card for memoization
const OrderCardInner = ({ order, onUpdateStatus, onRejectOrder, onRequestPayment, onProposeChange, onPaymentApprove, onPaymentReject, onViewDetails }) => {
  const vendorColors = useVendorColors();
  const styles = useMemo(() => createStyles(vendorColors), [vendorColors]);
  const navigation = useNavigation();
  const { t } = useI18n();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const quickReasons = useMemo(() => [
    { id: 'unavailable', label: t('vendor_orders.reason_unavailable', 'Product not available') },
    { id: 'price_changed', label: t('vendor_orders.reason_price_changed', 'Price changed') },
    { id: 'quantity', label: t('vendor_orders.reason_quantity', 'Cannot fulfill quantity') },
    { id: 'delivery', label: t('vendor_orders.reason_delivery', 'Delivery time unavailable') },
    { id: 'other', label: t('vendor_orders.reason_other', 'Other (custom reason)') },
  ], [t]);

  // A submitted-but-unverified payment makes Approve/Reject the only
  // sensible actions — handleApprovePayment jumps status straight to
  // 'preparing' (not 'confirmed'), so the separate order-level Reject and
  // "Confirm Order" buttons weren't just redundant, they raced the same
  // order against two different, sometimes-conflicting action paths at
  // once.
  const paymentNeedsVerification = order.payment_status === 'awaiting_verification';
  const nextStep = getNextStatus(order.status, t);
  const canUpdate = nextStep && order.status !== 'completed' && order.status !== 'cancelled' && !paymentNeedsVerification;
  const canReject = order.status === 'pending' && !paymentNeedsVerification;
  const canRequestPayment = order.status === 'confirmed' && !['verified', 'paid', 'awaiting_verification', 'rejected'].includes(order.payment_status);
  const canProposeChange = order.status === 'pending' && !paymentNeedsVerification;
  const isPaymentUnverified = !['verified', 'paid'].includes(order.payment_status);

  const handleUpdatePress = () => {
    if (nextStep.status === 'completed' && isPaymentUnverified) {
      // react-native-web does NOT implement Alert.alert — use window.confirm on web
      if (Platform.OS === 'web') {
        if (window.confirm("This order's payment hasn't been verified yet. Complete it anyway?")) {
          onUpdateStatus(order.id, nextStep.status);
        }
        return;
      }
      Alert.alert(
        'Payment not verified',
        "This order's payment hasn't been verified yet. Complete it anyway?",
        [
          { text: t('vendor_orders.cancel', 'Cancel'), style: 'cancel' },
          { text: 'Complete Anyway', onPress: () => onUpdateStatus(order.id, nextStep.status) },
        ]
      );
      return;
    }
    onUpdateStatus(order.id, nextStep.status);
  };

  const handleRejectConfirm = async () => {
    if (!selectedReasonId) return;
    const reasonObj = quickReasons.find(r => r.id === selectedReasonId);
    let finalMessage = reasonObj?.label || selectedReasonId;
    if (selectedReasonId === 'other' && customMessage.trim()) {
      finalMessage = customMessage.trim();
    }
    setRejecting(true);
    try {
      await onRejectOrder(order.id, selectedReasonId, finalMessage);
      setShowRejectModal(false);
      setSelectedReasonId(null);
      setCustomMessage('');
    } catch (error) {
      Alert.alert(t('common.error', 'Error'), 'Failed to reject order. Please try again.');
    } finally {
      setRejecting(false);
    }
  };

  const openDetails = () => {
    if (onViewDetails) {
      onViewDetails(order);
    } else {
      navigation.navigate('VendorOrderDetail', { orderId: order.id });
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={openDetails}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.orderNumber}>
              {t('vendor_orders.order_prefix', 'Order #')}{order.order_number?.slice(-8) || (order.id ? String(order.id).slice(-8) : '')}
            </Text>
            <Text style={styles.orderTime}>{formatOrderTime(order.created_at)}</Text>
          </View>
          <VendorStatusBadge status={order.status} />
        </View>

        {/* Customer */}
        <View style={styles.customerRow}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={18} color={vendorColors.primary} />
          </View>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{order.profiles?.full_name || t('vendor_orders.customer', 'Customer')}</Text>
            {order.profiles?.phone && <Text style={styles.customerPhone}>{order.profiles.phone}</Text>}
          </View>
        </View>

        {/* Items summary */}
        <View style={styles.itemsContainer}>
          {(order.items || []).slice(0, 3).map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.quantity}x {item.name} ({item.unit})
              </Text>
              <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}
          {(order.items || []).length > 3 && (
            <Text style={styles.moreItems}>
              +{ (order.items || []).length - 3 } {t('vendor_orders.more_items', 'more items')}
            </Text>
          )}
        </View>

        {/* Pickup time */}
        <View style={styles.pickupRow}>
          <View style={styles.metaIconWrap}>
            <Ionicons name="time-outline" size={14} color={vendorColors.text.secondary} />
          </View>
          <Text style={styles.pickupLabel}>{t('vendor_orders.pickup', 'Pickup:')}</Text>
          <Text style={styles.pickupTime}>{formatPickupTime(order.pickup_time)}</Text>
        </View>

        {/* Payment status */}
        {order.payment_status && (
          <View style={styles.paymentRow}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="card-outline" size={14} color={vendorColors.text.secondary} />
            </View>
            <Text style={styles.paymentLabel}>{t('vendor_orders.payment', 'Payment:')}</Text>
            <VendorPaymentStatusBadge status={order.payment_status} size="sm" />
          </View>
        )}

        {/* Special instructions */}
        {order.special_instructions && (
          <View style={styles.instructions}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="document-text-outline" size={14} color={vendorColors.primary} />
            </View>
            <View style={styles.instructionsContent}>
              <Text style={styles.instructionsLabel}>{t('vendor_orders.special_instructions', 'Special Instructions')}</Text>
              <Text style={styles.instructionsText} numberOfLines={2}>
                {order.special_instructions}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <View style={styles.totalInfo}>
              <Text style={styles.totalLabel}>{t('vendor_orders.total', 'Total')}</Text>
              <Text style={styles.totalAmount}>₱{Number(order.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
            </View>

            {/* View details */}
            <TouchableOpacity style={styles.detailsBtn} onPress={openDetails} activeOpacity={0.7}>
              <Ionicons name="eye-outline" size={15} color={vendorColors.text.secondary} />
              <Text style={styles.detailsBtnText}>{t('vendor_orders.view_details', 'View')}</Text>
            </TouchableOpacity>
          </View>

          {/* Action buttons */}
          {paymentNeedsVerification && onPaymentApprove && onPaymentReject ? (
            <View style={styles.paymentSection}>
              <View style={styles.paymentBanner}>
                <Ionicons name="alert-circle" size={16} color={vendorColors.isDark ? '#F59E0B' : '#D97706'} />
                <Text style={styles.paymentBannerText} numberOfLines={1}>
                  {order.payment_reference 
                    ? `${t('vendor_orders.payment_verification_notice', 'Payment proof submitted')} • Ref: ${order.payment_reference}`
                    : t('vendor_orders.payment_verification_notice', 'Payment proof submitted • Verify before preparing')}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => onPaymentReject(order)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>{t('vendor_orders.reject_payment', 'Reject Payment')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => onPaymentApprove(order)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>{t('vendor_orders.approve_payment', 'Approve Payment')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              {/* Propose change */}
              {canProposeChange && onProposeChange && (
                <TouchableOpacity style={[styles.actionBtn, styles.proposeBtn]} onPress={() => onProposeChange(order)} activeOpacity={0.7}>
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>{t('vendor_orders.negotiate', 'Negotiate')}</Text>
                </TouchableOpacity>
              )}

              {/* Request payment */}
              {canRequestPayment && onRequestPayment && (
                <TouchableOpacity style={[styles.actionBtn, styles.paymentBtn]} onPress={() => onRequestPayment(order)} activeOpacity={0.7}>
                  <Ionicons name="card-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>{t('vendor_orders.request_payment', 'Request Pay')}</Text>
                </TouchableOpacity>
              )}

              {/* Reject */}
              {canReject && (
                <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => setShowRejectModal(true)} activeOpacity={0.7}>
                  <Ionicons name="close" size={15} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>{t('vendor_orders.reject_order', 'Reject')}</Text>
                </TouchableOpacity>
              )}

              {/* Update status */}
              {canUpdate && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.updateBtn]}
                  onPress={handleUpdatePress}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      nextStep.status === 'confirmed' ? 'checkmark-circle-outline'
                      : nextStep.status === 'preparing' ? 'restaurant-outline'
                      : nextStep.status === 'ready' ? 'flag-outline'
                      : 'checkmark-done'
                    }
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionBtnText}>{nextStep.label}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} transparent animationType="fade" onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('vendor_orders.why_reject_title', 'Why reject this order?')}</Text>
            <Text style={styles.modalSubtitle}>{t('vendor_orders.why_reject_subtitle', 'The customer will be notified via chat')}</Text>

            <ScrollView style={styles.reasonsList}>
              {quickReasons.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[styles.reasonOption, selectedReasonId === reason.id && styles.reasonOptionSelected]}
                  onPress={() => setSelectedReasonId(reason.id)}
                >
                  <Text style={[styles.reasonText, selectedReasonId === reason.id && styles.reasonTextSelected]}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {selectedReasonId === 'other' && (
                <TextInput
                  style={styles.customInput}
                  placeholder={t('vendor_orders.type_reason_placeholder', 'Type your reason here...')}
                  placeholderTextColor={vendorColors.text.lighter}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  multiline
                  numberOfLines={3}
                />
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelModalButton} onPress={() => setShowRejectModal(false)}>
                <Text style={styles.cancelModalText}>{t('vendor_orders.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, (!selectedReasonId || rejecting) && styles.confirmModalDisabled]}
                onPress={handleRejectConfirm}
                disabled={!selectedReasonId || rejecting}
              >
                <LinearGradient colors={[vendorColors.danger, vendorColors.primaryDark]} style={styles.confirmGradient}>
                  {rejecting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.confirmModalText}>{t('vendor_orders.confirm_reject', 'Confirm Reject')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export const ModernOrderCard = memo(OrderCardInner);

// Was a plain module-level StyleSheet.create keyed off the static
// (light-mode-only) vendorColors import — see VendorOrderDetailScreen.js
// for the same fix and why. This is the card rendered per-order in the
// vendor's Orders list, so it's the most visible instance of the bug.
const createStyles = (vendorColors) => StyleSheet.create({
  card: {
    backgroundColor: vendorColors.surface,
    borderRadius: vendorBorderRadius.lg,
    marginBottom: vendorSpacing.md,
    padding: vendorSpacing.lg,
    borderWidth: 1,
    borderColor: vendorColors.border,
    ...vendorShadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vendorSpacing.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: vendorColors.text.primary,
  },
  orderTime: {
    fontSize: 12,
    color: vendorColors.text.secondary,
    marginTop: 2,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: vendorColors.surfaceAlt,
    padding: 10,
    borderRadius: vendorBorderRadius.md,
    marginBottom: vendorSpacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: vendorColors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: vendorColors.text.primary,
  },
  customerPhone: {
    fontSize: 11,
    color: vendorColors.text.secondary,
    marginTop: 1,
  },
  itemsContainer: {
    marginBottom: vendorSpacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemName: {
    fontSize: 13,
    color: vendorColors.text.secondary,
    flex: 1,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: vendorColors.primary,
  },
  moreItems: {
    fontSize: 11,
    color: vendorColors.text.tertiary,
    marginTop: 4,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: vendorColors.divider,
  },
  metaIconWrap: {
    marginRight: 6,
  },
  pickupLabel: {
    fontSize: 12,
    color: vendorColors.text.secondary,
    marginRight: 8,
  },
  pickupTime: {
    fontSize: 13,
    fontWeight: '600',
    color: vendorColors.primary,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingBottom: 8,
  },
  paymentLabel: {
    fontSize: 12,
    color: vendorColors.text.secondary,
    marginRight: 8,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: vendorColors.accentLight,
    padding: 10,
    borderRadius: vendorBorderRadius.sm,
    marginBottom: vendorSpacing.md,
  },
  instructionsContent: {
    flex: 1,
  },
  instructionsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: vendorColors.primary,
    marginBottom: 2,
  },
  instructionsText: {
    fontSize: 12,
    color: vendorColors.text.secondary,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: vendorColors.divider,
    paddingTop: vendorSpacing.md,
    marginTop: vendorSpacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vendorSpacing.md,
  },
  totalInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: vendorColors.text.secondary,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: vendorColors.primary,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: vendorBorderRadius.sm,
    backgroundColor: vendorColors.surfaceAlt,
    borderWidth: 1,
    borderColor: vendorColors.border,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: vendorColors.text.secondary,
  },
  paymentSection: {
    gap: 8,
  },
  paymentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: vendorColors.isDark ? '#2B1E0C' : '#FEF3C7',
    borderWidth: 1,
    borderColor: vendorColors.isDark ? '#78350F' : '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: vendorBorderRadius.sm,
    marginBottom: 4,
  },
  paymentBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: vendorColors.isDark ? '#FDE68A' : '#92400E',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  approveBtn: {
    backgroundColor: '#16A34A',
  },
  rejectPaymentBtn: {
    backgroundColor: '#DC2626',
  },
  proposeBtn: {
    backgroundColor: '#0284C7',
  },
  paymentBtn: {
    backgroundColor: '#D97706',
  },
  rejectBtn: {
    backgroundColor: '#DC2626',
  },
  updateBtn: {
    backgroundColor: '#16A34A',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: vendorColors.surface,
    borderRadius: vendorBorderRadius.xl,
    padding: 20,
    width: '85%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: vendorColors.text.primary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: vendorColors.text.secondary,
    marginBottom: 16,
  },
  reasonsList: {
    maxHeight: 300,
  },
  reasonOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: vendorBorderRadius.sm,
    marginBottom: 8,
    backgroundColor: vendorColors.surfaceAlt,
  },
  reasonOptionSelected: {
    backgroundColor: vendorColors.dangerLight,
    borderWidth: 1,
    borderColor: vendorColors.danger,
  },
  reasonText: {
    fontSize: 14,
    color: vendorColors.text.secondary,
  },
  reasonTextSelected: {
    color: vendorColors.primary,
    fontWeight: '500',
  },
  customInput: {
    borderWidth: 1,
    borderColor: vendorColors.border,
    borderRadius: vendorBorderRadius.sm,
    padding: 12,
    fontSize: 14,
    color: vendorColors.text.primary,
    textAlignVertical: 'top',
    marginTop: 8,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  cancelModalButton: {
    flex: 1,
    backgroundColor: vendorColors.surfaceAlt,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.sm,
    alignItems: 'center',
  },
  cancelModalText: {
    fontSize: 14,
    fontWeight: '500',
    color: vendorColors.text.secondary,
  },
  confirmModalButton: {
    flex: 1,
    borderRadius: vendorBorderRadius.sm,
    overflow: 'hidden',
  },
  confirmModalDisabled: {
    opacity: 0.5,
  },
  confirmGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmModalText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});