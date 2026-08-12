// src/screens/vendor/VendorOrderDetailScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import {
  vendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
} from '../../theme/vendorTheme';
import { VendorStatusBadge, VendorPaymentStatusBadge } from '../../components/vendor/VendorStatusBadge';
import { VendorSkeletonCard, VendorSkeletonList } from '../../components/vendor/VendorLoadingState';
import { VendorSectionHeader } from '../../components/vendor/VendorSectionHeader';

const formatDate = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
};

const formatTime = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
};

const getTimeline = (status) => {
  const steps = [
    { key: 'pending', label: 'Order Placed', icon: 'document-text-outline' },
    { key: 'confirmed', label: 'Order Confirmed', icon: 'checkmark-circle-outline' },
    { key: 'preparing', label: 'Preparing', icon: 'restaurant-outline' },
    { key: 'ready', label: 'Ready for Pickup', icon: 'flag-outline' },
    { key: 'completed', label: 'Completed', icon: 'checkmark-done-outline' },
  ];
  const idx = steps.findIndex(s => s.key === status);
  return { steps, currentIdx: idx === -1 ? -1 : idx };
};

export default function VendorOrderDetailScreen({ navigation, route }) {
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setError(null);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:consumer_id (
            full_name,
            phone,
            email,
            avatar_url
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrder();
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!order) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      // Notify customer
      const statusMessages = {
        confirmed: 'Your order has been confirmed by the vendor!',
        preparing: 'Your order is now being prepared.',
        ready: 'Your order is ready for pickup!',
        completed: 'Your order has been completed. Thank you!',
      };

      if (statusMessages[newStatus]) {
        await supabase.from('notifications').insert({
          user_id: order.consumer_id,
          title: 'Order Update',
          message: statusMessages[newStatus],
          type: 'order',
          data: { order_id: order.id, type: 'status_update' },
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }

      await fetchOrder();
      Alert.alert('Success', 'Order status updated');
    } catch (err) {
      console.error('Error updating order:', err);
      Alert.alert('Error', 'Failed to update order');
    } finally {
      setUpdating(false);
    }
  };

  const handleApprovePayment = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'verified',
          status: 'preparing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: order.consumer_id,
        title: 'Payment Verified',
        message: `Your payment for order #${order.order_number?.slice(-8)} has been verified. Your order is now being prepared!`,
        type: 'payment',
        data: { order_id: order.id, type: 'payment_verified' },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      await fetchOrder();
      Alert.alert('Payment Approved', 'Payment verified and order is now preparing');
    } catch (err) {
      console.error('Error approving payment:', err);
      Alert.alert('Error', 'Failed to approve payment');
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectPayment = () => {
    setShowPaymentModal(true);
  };

  const confirmRejectPayment = async () => {
    if (!order || !rejectReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'rejected',
          payment_rejection_reason: rejectReason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: order.consumer_id,
        title: 'Payment Rejected',
        message: `Your payment for order #${order.order_number?.slice(-8)} was rejected. Reason: ${rejectReason}`,
        type: 'payment',
        data: { order_id: order.id, type: 'payment_rejected' },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      await fetchOrder();
      setShowPaymentModal(false);
      setRejectReason('');
      Alert.alert('Payment Rejected', 'Customer has been notified');
    } catch (err) {
      console.error('Error rejecting payment:', err);
      Alert.alert('Error', 'Failed to reject payment');
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!order || !rejectReason.trim()) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }
    setRejecting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancel_reason: rejectReason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: order.consumer_id,
        title: 'Order Cancelled',
        message: `Your order #${order.order_number?.slice(-8)} was cancelled. Reason: ${rejectReason}`,
        type: 'order',
        data: { order_id: order.id, type: 'cancellation' },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      await fetchOrder();
      setShowRejectModal(false);
      setRejectReason('');
      Alert.alert('Order Rejected', 'The order has been cancelled');
    } catch (err) {
      console.error('Error rejecting order:', err);
      Alert.alert('Error', 'Failed to reject order');
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Order Details" subtitle="Loading order..." showBack onBackPress={() => navigation.goBack()} />
        <VendorSkeletonList count={4} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.container}>
        <Header title="Order Details" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={vendorColors.danger} />
          </View>
          <Text style={styles.errorTitle}>Unable to load order</Text>
          <Text style={styles.errorText}>{error || 'Order not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchOrder(); }}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { steps, currentIdx } = getTimeline(order.status);

  return (
    <View style={styles.container}>
      <Header
        title={`Order #${order.order_number?.slice(-8) || order.id.slice(-8)}`}
        subtitle="Order Details"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[vendorColors.primary]} />}
      >
        {/* Status Overview */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusLabel}>Current Status</Text>
              <VendorStatusBadge status={order.status} size="md" />
            </View>
            {order.payment_status && (
              <View style={styles.paymentStatusCol}>
                <Text style={styles.statusLabel}>Payment</Text>
                <VendorPaymentStatusBadge status={order.payment_status} size="md" />
              </View>
            )}
          </View>

          {/* Timeline */}
          <View style={styles.timeline}>
            {steps.map((step, idx) => (
              <React.Fragment key={step.key}>
                <View style={styles.timelineItem}>
                  <View style={[
                    styles.timelineDot,
                    idx <= currentIdx && styles.timelineDotActive,
                    idx === currentIdx && styles.timelineDotCurrent,
                  ]}>
                    <Ionicons name={step.icon} size={14} color={idx <= currentIdx ? vendorColors.primary : vendorColors.text.tertiary} />
                  </View>
                  <Text style={[
                    styles.timelineLabel,
                    idx <= currentIdx && styles.timelineLabelActive,
                  ]}>
                    {step.label}
                  </Text>
                </View>
                {idx < steps.length - 1 && (
                  <View style={[
                    styles.timelineLine,
                    idx < currentIdx && styles.timelineLineActive,
                  ]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Customer Section */}
        <View style={styles.section}>
          <VendorSectionHeader title="Customer" />
          <View style={styles.customerInfoCard}>
            <View style={styles.customerAvatar}>
              {order.profiles?.avatar_url ? (
                <Image source={{ uri: order.profiles.avatar_url }} style={styles.customerAvatarImg} />
              ) : (
                <Text style={styles.customerAvatarText}>
                  {order.profiles?.full_name?.charAt(0)?.toUpperCase() || 'C'}
                </Text>
              )}
            </View>
            <View style={styles.customerDetails}>
              <Text style={styles.customerName}>{order.profiles?.full_name || 'Customer'}</Text>
              {order.profiles?.phone && <Text style={styles.customerSub}>{order.profiles.phone}</Text>}
              {order.profiles?.email && <Text style={styles.customerSub}>{order.profiles.email}</Text>}
            </View>
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <VendorSectionHeader title="Items" subtitle={`${(order.items || []).length} items`} />
          {(order.items || []).map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity}x {item.unit} × ₱{item.price}/{item.unit}
                </Text>
              </View>
              <Text style={styles.itemTotal}>₱{(item.price * item.quantity).toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>₱{order.total_amount}</Text>
          </View>
        </View>

        {/* Pickup Section */}
        <View style={styles.section}>
          <VendorSectionHeader title="Pickup" />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Scheduled Pickup</Text>
            <Text style={styles.infoValue}>{formatTime(order.pickup_time)}</Text>
          </View>
          {order.placed_for_12pm && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Pickup Window</Text>
              <Text style={styles.infoValue}>12:00 PM</Text>
            </View>
          )}
        </View>

        {/* Payment Section */}
        {order.payment_status && (
          <View style={styles.section}>
            <VendorSectionHeader title="Payment" />
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amount</Text>
              <Text style={[styles.infoValue, styles.amountValue]}>₱{order.total_amount}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <VendorPaymentStatusBadge status={order.payment_status} size="sm" />
            </View>

            {order.payment_method && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Method</Text>
                <Text style={styles.infoValue}>{order.payment_method}</Text>
              </View>
            )}

            {order.payment_reference && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reference #</Text>
                <Text style={styles.infoValue}>{order.payment_reference}</Text>
              </View>
            )}

            {order.payment_receipt_url && (
              <TouchableOpacity
                style={styles.receiptButton}
                onPress={() => setShowReceipt(true)}
              >
                <Text style={styles.receiptButtonText}>View Payment Receipt</Text>
              </TouchableOpacity>
            )}

            {order.payment_status === 'rejected' && order.payment_rejection_reason && (
              <View style={styles.rejectionBanner}>
                <Text style={styles.rejectionTitle}>Rejection Reason</Text>
                <Text style={styles.rejectionText}>{order.payment_rejection_reason}</Text>
              </View>
            )}

            {order.payment_status === 'awaiting_verification' && (
              <View style={styles.verifyActions}>
                <TouchableOpacity
                  style={[styles.verifyBtn, styles.approveBtn]}
                  onPress={handleApprovePayment}
                  disabled={updating}
                >
                  <Text style={styles.verifyBtnText}>
                    {updating ? 'Processing...' : 'Approve Payment'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.verifyBtn, styles.rejectPaymentBtn]}
                  onPress={handleRejectPayment}
                  disabled={updating}
                >
                  <Text style={styles.verifyBtnText}>Reject Payment</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Special Instructions */}
        {order.special_instructions && (
          <View style={styles.section}>
            <VendorSectionHeader title="Special Instructions" />
            <View style={styles.instructionsBox}>
              <Text style={styles.instructionsText}>{order.special_instructions}</Text>
            </View>
          </View>
        )}

        {/* Order Actions */}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <View style={styles.actionsSection}>
            {order.status === 'pending' && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.mainActionBtn, styles.acceptBtn]}
                  onPress={() => handleUpdateStatus('confirmed')}
                  disabled={updating}
                >
                  <Text style={styles.mainActionText}>Accept Order</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mainActionBtn, styles.rejectBtn]}
                  onPress={() => setShowRejectModal(true)}
                  disabled={updating}
                >
                  <Text style={styles.mainActionText}>Reject Order</Text>
                </TouchableOpacity>
              </View>
            )}

            {order.status === 'confirmed' && (
              <TouchableOpacity
                style={[styles.fullActionBtn, styles.prepareBtn]}
                onPress={() => handleUpdateStatus('preparing')}
                disabled={updating}
              >
                <Text style={styles.fullActionText}>Mark as Preparing</Text>
              </TouchableOpacity>
            )}

            {order.status === 'preparing' && (
              <TouchableOpacity
                style={[styles.fullActionBtn, styles.readyBtn]}
                onPress={() => handleUpdateStatus('ready')}
                disabled={updating}
              >
                <Text style={styles.fullActionText}>Ready for Pickup</Text>
              </TouchableOpacity>
            )}

            {order.status === 'ready' && (
              <TouchableOpacity
                style={[styles.fullActionBtn, styles.completeBtn]}
                onPress={() => handleUpdateStatus('completed')}
                disabled={updating}
              >
                <Text style={styles.fullActionText}>Complete Order</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Reject Order Modal */}
      <Modal visible={showRejectModal} transparent animationType="fade" onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Order</Text>
            <Text style={styles.modalSubtitle}>Provide a reason for the customer</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for rejection..."
              placeholderTextColor="#9CA3AF"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRejectModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (!rejectReason.trim() || rejecting) && styles.modalBtnDisabled]}
                onPress={handleRejectOrder}
                disabled={!rejectReason.trim() || rejecting}
              >
                {rejecting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="fade" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Payment</Text>
            <Text style={styles.modalSubtitle}>Select or enter a reason</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for payment rejection..."
              placeholderTextColor="#9CA3AF"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => {
                setShowPaymentModal(false);
                setRejectReason('');
              }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (!rejectReason.trim() || updating) && styles.modalBtnDisabled]}
                onPress={confirmRejectPayment}
                disabled={!rejectReason.trim() || updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt View Modal */}
      <Modal visible={showReceipt} transparent animationType="fade" onRequestClose={() => setShowReceipt(false)}>
        <View style={styles.receiptOverlay}>
          <TouchableOpacity style={styles.receiptCloseBtn} onPress={() => setShowReceipt(false)}>
            <Text style={styles.receiptCloseText}>✕</Text>
          </TouchableOpacity>
          {order.payment_receipt_url && (
            <Image
              source={{ uri: order.payment_receipt_url }}
              style={styles.receiptImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: vendorColors.background,
  },
  statusCard: {
    backgroundColor: vendorColors.surface,
    marginHorizontal: vendorSpacing.lg,
    marginTop: vendorSpacing.lg,
    marginBottom: vendorSpacing.md,
    padding: vendorSpacing.lg,
    borderRadius: vendorBorderRadius.xl,
    ...vendorShadows.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vendorSpacing.lg,
  },
  statusLabel: {
    fontSize: 11,
    color: vendorColors.text.tertiary,
    marginBottom: 4,
    fontWeight: '600',
  },
  paymentStatusCol: {
    alignItems: 'flex-end',
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  timelineItem: {
    alignItems: 'center',
    width: 60,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: vendorColors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: vendorColors.border,
  },
  timelineDotActive: {
    backgroundColor: vendorColors.accent,
    borderColor: vendorColors.primary,
  },
  timelineDotCurrent: {
    shadowColor: vendorColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineIcon: {
    fontSize: 14,
  },
  timelineLabel: {
    fontSize: 8,
    color: vendorColors.text.tertiary,
    textAlign: 'center',
  },
  timelineLabelActive: {
    color: vendorColors.primary,
    fontWeight: '600',
  },
  timelineLine: {
    flex: 1,
    height: 3,
    backgroundColor: vendorColors.border,
    marginTop: 14,
    marginHorizontal: 4,
    borderRadius: 2,
  },
  timelineLineActive: {
    backgroundColor: vendorColors.primary,
  },
  section: {
    backgroundColor: vendorColors.surface,
    marginHorizontal: vendorSpacing.lg,
    marginBottom: vendorSpacing.md,
    padding: vendorSpacing.lg,
    borderRadius: vendorBorderRadius.xl,
    ...vendorShadows.md,
  },
  customerInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: vendorColors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: vendorSpacing.md,
  },
  customerAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  customerAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: vendorColors.primary,
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: vendorColors.text.primary,
  },
  customerSub: {
    fontSize: 12,
    color: vendorColors.text.secondary,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: vendorColors.divider,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: vendorColors.text.primary,
  },
  itemMeta: {
    fontSize: 11,
    color: vendorColors.text.secondary,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: vendorColors.primary,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  subtotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: vendorColors.text.primary,
  },
  subtotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: vendorColors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: vendorColors.divider,
  },
  infoLabel: {
    fontSize: 13,
    color: vendorColors.text.secondary,
  },
  infoValue: {
    fontSize: 14,
    color: vendorColors.text.primary,
    fontWeight: '500',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: vendorColors.primary,
  },
  instructionsBox: {
    backgroundColor: vendorColors.accentLight,
    padding: 12,
    borderRadius: vendorBorderRadius.md,
  },
  instructionsText: {
    fontSize: 13,
    color: vendorColors.text.primary,
    lineHeight: 20,
  },
  receiptButton: {
    backgroundColor: vendorColors.surfaceAlt,
    padding: 12,
    borderRadius: vendorBorderRadius.md,
    alignItems: 'center',
    marginTop: 8,
  },
  receiptButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: vendorColors.primary,
  },
  rejectionBanner: {
    backgroundColor: vendorColors.dangerLight,
    padding: 12,
    borderRadius: vendorBorderRadius.md,
    marginTop: 8,
  },
  rejectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: vendorColors.danger,
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 12,
    color: vendorColors.text.primary,
  },
  verifyActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  verifyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.md,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: vendorColors.success,
  },
  rejectPaymentBtn: {
    backgroundColor: vendorColors.danger,
  },
  verifyBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsSection: {
    paddingHorizontal: vendorSpacing.lg,
    paddingBottom: vendorSpacing.xxxl,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mainActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: vendorBorderRadius.md,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: vendorColors.success,
  },
  rejectBtn: {
    backgroundColor: vendorColors.danger,
  },
  mainActionText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  fullActionBtn: {
    paddingVertical: 14,
    borderRadius: vendorBorderRadius.md,
    alignItems: 'center',
  },
  prepareBtn: {
    backgroundColor: vendorColors.purple,
  },
  readyBtn: {
    backgroundColor: vendorColors.success,
  },
  completeBtn: {
    backgroundColor: vendorColors.primary,
  },
  fullActionText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Error/loading
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: vendorColors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: vendorColors.text.primary,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: vendorColors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: vendorColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.md,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modals
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
  modalInput: {
    borderWidth: 1,
    borderColor: vendorColors.border,
    borderRadius: vendorBorderRadius.md,
    padding: 12,
    fontSize: 14,
    color: vendorColors.text.primary,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: vendorColors.surfaceAlt,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: vendorColors.text.secondary,
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: vendorColors.primary,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  receiptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptCloseText: {
    fontSize: 20,
    color: vendorColors.primary,
    fontWeight: 'bold',
  },
  receiptImage: {
    width: '100%',
    height: '80%',
  },
});
