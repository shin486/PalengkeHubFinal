import React, { useState } from 'react';
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

const QUICK_REASONS = [
  { id: 'unavailable', label: 'Product not available' },
  { id: 'price_changed', label: 'Price changed' },
  { id: 'quantity', label: 'Cannot fulfill quantity' },
  { id: 'delivery', label: 'Delivery time unavailable' },
  { id: 'other', label: 'Other (custom reason)' },
];

export const OrderCard = ({ order, onUpdateStatus, onRejectOrder, onRequestPayment, onProposeChange }) => {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [rejecting, setRejecting] = useState(false);

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

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '⏳ Pending';
      case 'confirmed': return '✅ Confirmed';
      case 'preparing': return '👨‍🍳 Preparing';
      case 'ready': return '🛎️ Ready for Pickup';
      case 'completed': return '📦 Completed';
      case 'cancelled': return '❌ Cancelled';
      default: return status;
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

  const nextStep = getNextStatus(order.status);
  const canUpdate = nextStep && order.status !== 'completed' && order.status !== 'cancelled';
  const canReject = order.status === 'pending';
  const canRequestPayment = order.status === 'confirmed';
  const canProposeChange = order.status === 'pending';

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

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
      console.error(error);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.orderNumber}>Order #{order.order_number?.slice(-8) || order.id.slice(-8)}</Text>
            <Text style={styles.orderTime}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
          </View>
        </View>

        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>👤 {order.profiles?.full_name || 'Customer'}</Text>
          {order.profiles?.phone && <Text style={styles.customerPhone}>📞 {order.profiles.phone}</Text>}
        </View>

        <View style={styles.itemsContainer}>
  {order.items?.map((item, idx) => (
    <View key={idx} style={styles.itemRow}>
      <Text style={styles.itemName}>
  {item.quantity}x {item.name} ({item.unit})
</Text>
      <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
    </View>
  ))}
</View>

        {order.special_instructions && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsLabel}>📝 Special Instructions:</Text>
            <Text style={styles.instructionsText}>{order.special_instructions}</Text>
          </View>
        )}

        <View style={styles.pickupContainer}>
          <Text style={styles.pickupLabel}>⏰ Pickup Time:</Text>
          <Text style={styles.pickupTime}>{formatTime(order.pickup_time)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₱{order.total_amount}</Text>
          </View>

          <View style={styles.actionButtons}>
            {/* Propose Change button - for pending orders */}
            {canProposeChange && onProposeChange && (
              <TouchableOpacity style={styles.proposeButton} onPress={() => onProposeChange(order)}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.proposeGradient}>
                  <Text style={styles.proposeButtonText}>✏️ Propose Change</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Request Payment button - for confirmed orders */}
            {canRequestPayment && onRequestPayment && (
              <TouchableOpacity style={styles.requestPaymentButton} onPress={() => onRequestPayment(order)}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.requestPaymentGradient}>
                  <Text style={styles.requestPaymentText}>💰 Request Payment</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {canReject && (
              <TouchableOpacity style={styles.rejectButton} onPress={() => setShowRejectModal(true)}>
                <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.rejectGradient}>
                  <Text style={styles.rejectButtonText}>Reject Order</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {canUpdate && (
              <TouchableOpacity style={styles.updateButton} onPress={() => onUpdateStatus(order.id, nextStep.status)}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.updateGradient}>
                  <Text style={styles.updateText}>{nextStep.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {order.status === 'cancelled' && (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledText}>Order Cancelled</Text>
            </View>
          )}
        </View>
      </View>

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
                <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.confirmGradient}>
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  orderTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  customerInfo: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  customerPhone: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  itemsContainer: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemName: {
    fontSize: 13,
    color: '#374151',
    flex: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF6B6B',
  },
  instructionsContainer: {
    backgroundColor: '#FEF3F2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  instructionsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 12,
    color: '#374151',
  },
  pickupContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  pickupLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  pickupTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  proposeButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  proposeGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  proposeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  requestPaymentButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  requestPaymentGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  requestPaymentText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  rejectButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  rejectGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  updateButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  updateGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  updateText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  cancelledBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  cancelledText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '85%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  reasonsList: {
    maxHeight: 300,
  },
  reasonOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  reasonOptionSelected: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  reasonText: {
    fontSize: 14,
    color: '#374151',
  },
  reasonTextSelected: {
    color: '#DC2626',
    fontWeight: '500',
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
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
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelModalText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  confirmModalButton: {
    flex: 1,
    borderRadius: 10,
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