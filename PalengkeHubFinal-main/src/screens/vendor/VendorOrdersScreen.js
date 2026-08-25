// src/screens/vendor/VendorOrdersScreen.js

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { useVendorOrders } from '../../hooks/useVendorOrders';
import { ModernOrderCard } from '../../components/vendor/ModernOrderCard';
import PaymentApproveModal from '../../components/vendor/PaymentApproveModal';
import { VendorSkeletonList } from '../../components/vendor/VendorLoadingState';
import { VendorEmptyState } from '../../components/vendor/VendorEmptyState';

// ============================================================
// COLORS - Theme-aware (from ThemeContext)
// ============================================================

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

//  Status Tabs - No Emojis
const STATUS_TABS = [
  { key: 'pending', label: 'Pending', icon: 'time-outline' },
  { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline' },
  { key: 'preparing', label: 'Preparing', icon: 'restaurant-outline' },
  { key: 'ready', label: 'Ready', icon: 'flag-outline' },
  { key: 'completed', label: 'Completed', icon: 'checkmark-done-outline' },
  { key: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline' },
];

export default function VendorOrdersScreen({ navigation }) {
  const { user } = useAuth();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [stall, setStall] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [showRejectPaymentModal, setShowRejectPaymentModal] = useState(false);
  const [showApprovePaymentModal, setShowApprovePaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fetch stall
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

  useFocusEffect(
    useCallback(() => {
      fetchStall();
    }, [fetchStall])
  );

  const {
    orders,
    loading,
    orderStats,
    updateOrderStatus,
    refreshOrders,
  } = useVendorOrders(stall?.id);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshOrders(), fetchStall()]);
    setRefreshing(false);
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    const success = await updateOrderStatus(orderId, newStatus);
    if (success) {
      Alert.alert('Success', 'Order status updated');
    }
  };

  const handleRejectOrder = async (orderId, reasonId, finalMessage) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');

      await updateOrderStatus(orderId, 'cancelled');

      await supabase.from('notifications').insert({
        user_id: order.consumer_id,
        title: 'Order Cancelled',
        message: `Your order #${order.order_number?.slice(-8)} was cancelled. Reason: ${finalMessage}`,
        type: 'order',
        data: { order_id: order.id, type: 'cancellation' },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      Alert.alert('Order Rejected', 'The order has been cancelled and the customer has been notified.');
    } catch (error) {
      console.error('Rejection error:', error);
      Alert.alert('Error', 'Failed to reject order');
    }
  };

  const handleRequestPayment = async (order) => {
    try {
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('customer_id', order.consumer_id)
        .eq('stall_id', order.stall_id)
        .maybeSingle();

      let conversationId;
      if (conversation) {
        conversationId = conversation.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            customer_id: order.consumer_id,
            stall_id: order.stall_id,
            last_message: `Payment request for Order #${order.order_number?.slice(-8)}`,
            last_message_time: new Date(),
            vendor_unread_count: 1,
          })
          .select()
          .single();
        if (convError) throw convError;
        conversationId = newConv.id;
      }

      if (conversationId) {
        const paymentMessage = `PAYMENT REQUEST\n\nOrder #${order.order_number?.slice(-8)}\nTotal Amount: ₱${order.total_amount}\n\nPlease send payment to GCash and upload your receipt.`;

        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          sender_role: 'vendor',
          message: paymentMessage,
          is_read: false,
        });

        await supabase
          .from('conversations')
          .update({
            last_message: paymentMessage,
            last_message_time: new Date(),
            customer_unread_count: 1,
          })
          .eq('id', conversationId);
      }

      await updateOrderStatus(order.id, 'confirmed');
      Alert.alert('Success', 'Payment request sent to customer');
    } catch (error) {
      console.error('Request payment error:', error);
      Alert.alert('Error', 'Failed to send payment request');
    }
  };

  const handleApprovePayment = async (order) => {
    setProcessing(true);
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

      await refreshOrders();
      Alert.alert('Payment Approved', 'Payment verified and order is now preparing');
    } catch (error) {
      console.error('Error approving payment:', error);
      Alert.alert('Error', 'Failed to approve payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectPayment = (order) => {
    setSelectedOrder(order);
    setRejectReason('');
    setShowRejectPaymentModal(true);
  };

  const confirmRejectPayment = async () => {
    if (!selectedOrder || !rejectReason.trim()) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'rejected',
          payment_rejection_reason: rejectReason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selectedOrder.consumer_id,
        title: 'Payment Rejected',
        message: `Your payment for order #${selectedOrder.order_number?.slice(-8)} was rejected. Reason: ${rejectReason}`,
        type: 'payment',
        data: { order_id: selectedOrder.id, type: 'payment_rejected' },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      await refreshOrders();
      setShowRejectPaymentModal(false);
      setRejectReason('');
      Alert.alert('Payment Rejected', 'Customer has been notified');
    } catch (error) {
      console.error('Error rejecting payment:', error);
      Alert.alert('Error', 'Failed to reject payment');
    } finally {
      setProcessing(false);
    }
  };

  const currentOrders = useMemo(() => {
    return orderStats[activeTab] || [];
  }, [orderStats, activeTab]);

  const renderOrderItem = ({ item }) => (
    <ModernOrderCard
      order={item}
      onUpdateStatus={handleUpdateStatus}
      onRejectOrder={handleRejectOrder}
      onRequestPayment={handleRequestPayment}
      onPaymentApprove={(order) => {
        setSelectedOrder(order);
        setShowApprovePaymentModal(true);
      }}
      onPaymentReject={handleRejectPayment}
      onViewDetails={(order) => navigation.navigate('VendorOrderDetail', { orderId: order.id })}
    />
  );

  //  Get icon color for tab
  const getTabIconColor = (key, isActive) => {
    if (isActive) return '#FFFFFF';
    const colors = {
      'pending': COLORS.warning,
      'confirmed': COLORS.info,
      'preparing': COLORS.purple,
      'ready': COLORS.success,
      'completed': COLORS.success,
      'cancelled': COLORS.error,
    };
    return colors[key] || COLORS.text.medium;
  };

  return (
    <View style={styles.container}>
      <Header title="Orders" subtitle={stall?.stall_name || 'Manage your orders'} />

      {/* Status Tabs - No Emojis */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          {STATUS_TABS.map((tab) => {
            const count = (orderStats[tab.key] || []).length;
            const isActive = activeTab === tab.key;
            const iconColor = getTabIconColor(tab.key, isActive);
            
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={tab.icon} size={16} color={iconColor} />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders List */}
      {loading ? (
        <VendorSkeletonList count={4} />
      ) : currentOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons 
              name={activeTab === 'pending' ? 'inbox-outline' : 'checkmark-done-circle-outline'} 
              size={48} 
              color={COLORS.text.lighter} 
            />
          </View>
          <Text style={styles.emptyTitle}>No {activeTab} orders</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'pending'
              ? 'New orders will appear here in real-time'
              : `Orders will appear here when their status changes to ${activeTab}`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Reject Payment Modal */}
      <Modal visible={showRejectPaymentModal} transparent animationType="fade" onRequestClose={() => setShowRejectPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="close-circle-outline" size={24} color={COLORS.error} />
              </View>
              <Text style={styles.modalTitle}>Reject Payment</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              {selectedOrder ? `Order #${selectedOrder.order_number?.slice(-8)}` : ''}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for payment rejection..."
              placeholderTextColor={COLORS.text.lighter}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRejectPaymentModal(false)} activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (!rejectReason.trim() || processing) && styles.modalBtnDisabled]}
                onPress={confirmRejectPayment}
                disabled={!rejectReason.trim() || processing}
                activeOpacity={0.7}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Approve Gate - vendor must confirm receipt review + own GCash check */}
      <PaymentApproveModal
        visible={showApprovePaymentModal}
        order={selectedOrder}
        processing={processing}
        onClose={() => setShowApprovePaymentModal(false)}
        onConfirm={() => {
          setShowApprovePaymentModal(false);
          if (selectedOrder) handleApprovePayment(selectedOrder);
        }}
      />
    </View>
  );
}

// ============================================================
// STYLES - Matches Customer Side
// ============================================================
const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Tabs ──
  tabsWrapper: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingVertical: 8,
  },
  tabsContent: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text.medium,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    minWidth: 20,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  tabBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabBadgeTextActive: {
    color: COLORS.primary,
  },

  // ── List ──
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.dark,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.light,
    textAlign: 'center',
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 20,
    width: '85%',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.text.light,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 14,
    color: COLORS.text.dark,
    textAlignVertical: 'top',
    minHeight: 80,
    backgroundColor: COLORS.background,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.medium,
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
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
});