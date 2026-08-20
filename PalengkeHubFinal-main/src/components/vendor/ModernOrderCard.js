// src/components/vendor/ModernOrderCard.js
import React, { useState, memo } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  vendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
  getStatusColor,
  getStatusLabel,
} from '../../theme/vendorTheme';
import { VendorStatusBadge, VendorPaymentStatusBadge } from './VendorStatusBadge';

const QUICK_REASONS = [
  { id: 'unavailable', label: 'Product not available' },
  { id: 'price_changed', label: 'Price changed' },
  { id: 'quantity', label: 'Cannot fulfill quantity' },
  { id: 'delivery', label: 'Delivery time unavailable' },
  { id: 'other', label: 'Other (custom reason)' },
];

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

const getNextStatus = (status) => {
  const flow = {
    pending: { status: 'confirmed', label: 'Confirm Order' },
    confirmed: { status: 'preparing', label: 'Start Preparing' },
    preparing: { status: 'ready', label: 'Mark Ready' },
    ready: { status: 'completed', label: 'Complete Order' },
  };
  return flow[status];
};

// Extracted inner card for memoization
const OrderCardInner = ({ order, onUpdateStatus, onRejectOrder, onRequestPayment, onProposeChange, onPaymentApprove, onPaymentReject, onViewDetails }) => {
  const navigation = useNavigation();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const nextStep = getNextStatus(order.status);
  const canUpdate = nextStep && order.status !== 'completed' && order.status !== 'cancelled';
  const canReject = order.status === 'pending';
  const canRequestPayment = order.status === 'confirmed' && !['verified', 'paid', 'awaiting_verification', 'rejected'].includes(order.payment_status);
  const canProposeChange = order.status === 'pending';
  const paymentNeedsVerification = order.payment_status === 'awaiting_verification';

  const handleRejectConfirm = async () => {
    if (!selectedReasonId) return;
    const reasonObj = QUICK_REASONS.find(r => r.id === selectedReasonId);
    let finalMessage = reasonObj.label;
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
      Alert.alert('Error', 'Failed to reject order. Please try again.');
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
              Order #{order.order_number?.slice(-8) || order.id.slice(-8)}
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
            <Text style={styles.customerName}>{order.profiles?.full_name || 'Customer'}</Text>
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
            <Text style={styles.moreItems}>+{(order.items || []).length - 3} more items</Text>
          )}
        </View>

        {/* Pickup time */}
        <View style={styles.pickupRow}>
          <View style={styles.metaIconWrap}>
            <Ionicons name="time-outline" size={14} color={vendorColors.text.secondary} />
          </View>
          <Text style={styles.pickupLabel}>Pickup:</Text>
          <Text style={styles.pickupTime}>{formatPickupTime(order.pickup_time)}</Text>
        </View>

        {/* Payment status */}
        {order.payment_status && (
          <View style={styles.paymentRow}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="card-outline" size={14} color={vendorColors.text.secondary} />
            </View>
            <Text style={styles.paymentLabel}>Payment:</Text>
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
              <Text style={styles.instructionsLabel}>Special Instructions</Text>
              <Text style={styles.instructionsText} numberOfLines={2}>
                {order.special_instructions}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₱{order.total_amount}</Text>
          </View>

          <View style={styles.actionRow}>
            {/* View details */}
            <TouchableOpacity style={styles.detailsBtn} onPress={openDetails}>
              <Ionicons name="eye-outline" size={14} color={vendorColors.text.secondary} />
              <Text style={styles.detailsBtnText}>View</Text>
            </TouchableOpacity>

            {/* Payment verification buttons */}
            {paymentNeedsVerification && onPaymentApprove && onPaymentReject && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => onPaymentApprove(order)}
                >
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                  <Text style={styles.actionBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectPaymentBtn]}
                  onPress={() => onPaymentReject(order)}
                >
                  <Ionicons name="close" size={14} color="#FFF" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Propose change */}
            {canProposeChange && onProposeChange && (
              <TouchableOpacity style={[styles.actionBtn, styles.proposeBtn]} onPress={() => onProposeChange(order)}>
                <Ionicons name="create-outline" size={14} color="#FFF" />
                <Text style={styles.actionBtnText}>Negotiate</Text>
              </TouchableOpacity>
            )}

            {/* Request payment */}
            {canRequestPayment && onRequestPayment && (
              <TouchableOpacity style={[styles.actionBtn, styles.paymentBtn]} onPress={() => onRequestPayment(order)}>
                <Ionicons name="card-outline" size={14} color="#FFF" />
                <Text style={styles.actionBtnText}>Request Pay</Text>
              </TouchableOpacity>
            )}

            {/* Reject */}
            {canReject && (
              <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => setShowRejectModal(true)}>
                <Ionicons name="close" size={14} color="#FFF" />
                <Text style={styles.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            )}

            {/* Update status */}
            {canUpdate && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.updateBtn]}
                onPress={() => onUpdateStatus(order.id, nextStep.status)}
              >
                <Ionicons name="checkmark-done" size={14} color="#FFF" />
                <Text style={styles.actionBtnText}>{nextStep.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} transparent animationType="fade" onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Why reject this order?</Text>
            <Text style={styles.modalSubtitle}>The customer will be notified via chat</Text>

            <ScrollView style={styles.reasonsList}>
              {QUICK_REASONS.map((reason) => (
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
                  placeholder="Type your reason here..."
                  placeholderTextColor="#9CA3AF"
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  multiline
                  numberOfLines={3}
                />
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelModalButton} onPress={() => setShowRejectModal(false)}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, (!selectedReasonId || rejecting) && styles.confirmModalDisabled]}
                onPress={handleRejectConfirm}
                disabled={!selectedReasonId || rejecting}
              >
                <LinearGradient colors={[vendorColors.danger, vendorColors.primaryDark]} style={styles.confirmGradient}>
                  {rejecting ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.confirmModalText}>Confirm Reject</Text>}
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

const styles = StyleSheet.create({
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
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: vendorSpacing.md,
  },
  totalLabel: {
    fontSize: 14,
    color: vendorColors.text.secondary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: vendorColors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: vendorBorderRadius.sm,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  approveBtn: {
    backgroundColor: vendorColors.success,
  },
  rejectPaymentBtn: {
    backgroundColor: vendorColors.danger,
  },
  proposeBtn: {
    backgroundColor: vendorColors.info,
  },
  paymentBtn: {
    backgroundColor: vendorColors.info,
  },
  rejectBtn: {
    backgroundColor: vendorColors.danger,
  },
  updateBtn: {
    backgroundColor: vendorColors.success,
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