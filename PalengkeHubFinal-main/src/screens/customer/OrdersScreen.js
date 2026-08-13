import { useColors } from '../../contexts/ThemeContext';
// src/screens/customer/OrdersScreen.js

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Vibration,
  Modal,
  Dimensions,
  Linking,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../hooks/useOrders';
import { useCart } from '../../hooks/useCart';
import { useI18n } from '../../contexts/i18nContext';
import StallMap from '../../components/StallMap';
import { EmptyState } from '../../components/EmptyState';
import { OrderTimeline } from '../../components/OrderTimeline';
import { supabase } from '../../../lib/supabase';

const { width, height } = Dimensions.get('window');

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

// Quick cancel reasons for the customer
const CANCEL_REASONS = [
  { id: 'changed_mind', label: 'Changed my mind' },
  { id: 'found_cheaper', label: 'Found a better price elsewhere' },
  { id: 'delivery_time', label: 'Pickup time doesn\'t work' },
  { id: 'ordered_wrong', label: 'Ordered wrong item' },
  { id: 'other', label: 'Other reason' },
];

export default function OrdersScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user, isGuest } = useAuth();
  const { orders, loading, newOrderAlert, refreshOrders } = useOrders();
  const { addToCart } = useCart();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('active');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStall, setSelectedStall] = useState(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Customer cancellation states
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelReasonId, setCancelReasonId] = useState(null);
  const [cancelCustomMessage, setCancelCustomMessage] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // GCash Pay Now states
  const [payNowModalVisible, setPayNowModalVisible] = useState(false);
  const [payNowOrder, setPayNowOrder] = useState(null);
  const [payNowReferenceNumber, setPayNowReferenceNumber] = useState('');
  const [payNowReceiptUri, setPayNowReceiptUri] = useState(null);
  const [payNowSubmitting, setPayNowSubmitting] = useState(false);
  const [payNowReceiptUploading, setPayNowReceiptUploading] = useState(false);
  const [payNowCountdown, setPayNowCountdown] = useState(600);
  const payNowTimerRef = useRef(null);

  // Stall location mapping
  const getStallCoordinates = (section, stallNumber) => {
    const baseLat = 13.9417;
    const baseLng = 121.1642;
    
    const sectionOffsets = {
      'Meat Section': { lat: 0.0008, lng: -0.0012 },
      'Vegetable Section': { lat: 0.0002, lng: -0.0008 },
      'Fish Section': { lat: -0.0003, lng: 0.0005 },
      'Fruit Section': { lat: 0.0005, lng: 0.0002 },
      'Dry Goods': { lat: -0.0001, lng: -0.0015 },
      'Poultry Section': { lat: 0.0010, lng: -0.0005 },
    };
    
    const offset = sectionOffsets[section] || { lat: 0, lng: 0 };
    const stallOffset = (parseInt(stallNumber) || 0) * 0.00002;
    
    return {
      latitude: baseLat + offset.lat + stallOffset,
      longitude: baseLng + offset.lng + stallOffset,
    };
  };

  const openMapsDirections = (stall) => {
    if (!stall || !stall.section) {
      Alert.alert('Error', 'Stall location not available');
      return;
    }
    const coords = getStallCoordinates(stall.section, stall.stall_number);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}&travelmode=walking`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps');
    });
  };

  const showStallMap = (stall) => {
    if (!stall) return;
    setSelectedStall(stall);
    setMapModalVisible(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  React.useEffect(() => {
    if (newOrderAlert) {
      Vibration.vibrate(200);
    }
  }, [newOrderAlert]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (payNowTimerRef.current) {
        clearInterval(payNowTimerRef.current);
      }
    };
  }, []);

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handle Pay Now - Only for unpaid orders
  const handlePayNow = (order) => {
    // Check if order is already paid
    if (order.payment_status === 'paid') {
      Alert.alert('Already Paid', 'This order has already been paid.');
      return;
    }
    
    // Check if order is expired
    if (order.payment_status === 'expired' || order.status === 'cancelled') {
      Alert.alert('Order Expired', 'This order is no longer available for payment.');
      return;
    }
    
    setPayNowOrder(order);
    setPayNowReferenceNumber('');
    setPayNowReceiptUri(null);
    setPayNowCountdown(600);
    setPayNowSubmitting(false);
    setPayNowModalVisible(true);
    
    // Start timer
    if (payNowTimerRef.current) clearInterval(payNowTimerRef.current);
    payNowTimerRef.current = setInterval(() => {
      setPayNowCountdown(prev => {
        if (prev <= 1) {
          clearInterval(payNowTimerRef.current);
          handlePayNowTimeout(order);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Handle Pay Now timeout
  const handlePayNowTimeout = async (order) => {
    if (!order) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled', payment_status: 'expired' })
        .eq('id', order.id);
      
      if (error) console.error('Error cancelling order:', error);
      
      setPayNowModalVisible(false);
      Alert.alert(
        '⏰ Payment Time Expired',
        'Your payment window of 10 minutes has expired. This order has been cancelled.',
        [{ text: 'OK', onPress: () => refreshOrders() }]
      );
    } catch (error) {
      console.error('Pay Now timeout error:', error);
    }
  };

  // Pick GCash receipt for Pay Now
  const pickPayNowReceipt = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow photo library access to upload your GCash receipt.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setPayNowReceiptUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking receipt:', error);
      Alert.alert('Error', 'Failed to select receipt image.');
    }
  };

  // Upload receipt for Pay Now
  const uploadPayNowReceipt = async (uri) => {
    if (!uri) return null;
    setPayNowReceiptUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileName = `receipt_${Date.now()}_${payNowOrder.id}.jpg`;
      const folder = `gcash_receipts/${user.id}/${payNowOrder.stall_id}`;
      const { data, error } = await supabase.storage
        .from('vendor_documents')
        .upload(`${folder}/${fileName}`, blob, {
          cacheControl: '3600',
          contentType: 'image/jpeg',
        });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from('vendor_documents')
        .getPublicUrl(data.path);
      return urlData?.publicUrl || null;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      Alert.alert('Upload Error', 'Failed to upload receipt. Please try again.');
      return null;
    } finally {
      setPayNowReceiptUploading(false);
    }
  };

  // Submit Pay Now payment
  const handlePayNowSubmit = async () => {
    if (!payNowReferenceNumber || payNowReferenceNumber.trim().length < 6) {
      Alert.alert('Missing Reference Number', 'Please enter the GCash reference number from your payment.');
      return;
    }
    if (!payNowReceiptUri) {
      Alert.alert('Missing Receipt', 'Please upload a screenshot of your GCash receipt.');
      return;
    }
    
    setPayNowSubmitting(true);
    try {
      const receiptUrl = await uploadPayNowReceipt(payNowReceiptUri);
      if (!receiptUrl) {
        setPayNowSubmitting(false);
        return;
      }
      
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          payment_reference: payNowReferenceNumber.trim(),
          payment_receipt_url: receiptUrl,
          paid_at: new Date().toISOString(),
        })
        .eq('id', payNowOrder.id);
      
      if (error) throw error;
      
      // Stop timer
      if (payNowTimerRef.current) clearInterval(payNowTimerRef.current);
      
      setPayNowModalVisible(false);
      Alert.alert(
        '✅ Payment Submitted! 🎉',
        'Your GCash payment has been submitted successfully. The vendor will verify your payment and confirm your order.',
        [
          { text: 'View Orders', onPress: () => refreshOrders() }
        ]
      );
      await refreshOrders();
      
    } catch (error) {
      console.error('Error submitting payment:', error);
      Alert.alert('Error', 'Failed to submit payment. Please try again.');
    } finally {
      setPayNowSubmitting(false);
    }
  };

  // ORDER AGAIN
  const handleOrderAgain = async (order) => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to add items to cart');
      return;
    }

    try {
      const stall = order.stall;
      const items = order.items || [];

      for (const item of items) {
        const productData = {
          id: item.id,
          name: item.name,
          price: item.price,
          unit: item.unit,
        };
        
        await addToCart(productData, stall?.id, stall, item.quantity);
      }

      Alert.alert(
        'Order Again',
        `${items.length} item(s) have been added to your cart.`,
        [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => navigation.navigate('Cart') }
        ]
      );
    } catch (error) {
      console.error('Error adding items to cart:', error);
      Alert.alert('Error', 'Failed to add items to cart. Please try again.');
    }
  };

  // RATE VENDOR
  const handleRateVendor = (order) => {
    setSelectedOrder(order);
    setSelectedRating(0);
    setRatingComment('');
    setRatingModalVisible(true);
  };

  const submitRating = async () => {
    if (selectedRating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    setSubmittingRating(true);
    try {
      const stall = selectedOrder.stall;
      
      const { error } = await supabase
        .from('ratings')
        .insert({
          consumer_id: user.id,
          stall_id: stall?.id,
          order_id: selectedOrder.id,
          rating: selectedRating,
          review: ratingComment || null,
        });

      if (error) throw error;

      Alert.alert('Thank You!', 'Your rating has been submitted successfully.');
      setRatingModalVisible(false);
      setSelectedOrder(null);
      setSelectedRating(0);
      setRatingComment('');
      
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  };

  // DELETE SINGLE ORDER FROM HISTORY
  const deleteOrderFromHistory = async (orderId) => {
    Alert.alert(
      'Remove Order',
      'Do you want to permanently remove this order from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId)
                .eq('consumer_id', user.id);

              if (error) throw error;
              await refreshOrders();
              Alert.alert('Removed', 'Order has been removed from your history');
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Could not remove order');
            }
          }
        }
      ]
    );
  };

  // CLEAR ALL HISTORY
  const clearAllHistory = async () => {
    const completedOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status));
    if (completedOrders.length === 0) return;
    Alert.alert(
      'Clear All History',
      'Are you sure you want to remove ALL completed/cancelled orders? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const idsToDelete = completedOrders.map(o => o.id);
              const { error } = await supabase
                .from('orders')
                .delete()
                .in('id', idsToDelete)
                .eq('consumer_id', user.id);

              if (error) throw error;
              await refreshOrders();
              Alert.alert('Cleared', 'All history orders have been removed');
            } catch (error) {
              console.error('Clear all error:', error);
              Alert.alert('Error', 'Could not clear history');
            }
          }
        }
      ]
    );
  };

  // CUSTOMER CANCELLATION (with chat notification)
  const handleCancelOrder = async () => {
    if (!cancelReasonId) return;
    const reasonObj = CANCEL_REASONS.find(r => r.id === cancelReasonId);
    let finalMessage = reasonObj.label;
    if (cancelReasonId === 'other' && cancelCustomMessage.trim()) {
      finalMessage = cancelCustomMessage.trim();
    }

    setCancelling(true);
    try {
      // Update order status to cancelled
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'cancelled',
          // If payment was awaiting, also update payment status
          payment_status: orderToCancel.payment_status === 'awaiting_payment' ? 'cancelled' : undefined
        })
        .eq('id', orderToCancel.id)
        .eq('consumer_id', user.id);
      if (updateError) throw updateError;

      let { data: conversation } = await supabase
        .from('conversations')
        .select('id, customer_unread_count')
        .eq('customer_id', user.id)
        .eq('stall_id', orderToCancel.stall_id)
        .maybeSingle();

      let conversationId;
      if (conversation) {
        conversationId = conversation.id;
        await supabase
          .from('conversations')
          .update({
            last_message: `❌ Customer cancelled order: ${finalMessage}`,
            last_message_time: new Date(),
            customer_unread_count: (conversation.customer_unread_count || 0) + 1,
          })
          .eq('id', conversationId);
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            customer_id: user.id,
            stall_id: orderToCancel.stall_id,
            last_message: `❌ Customer cancelled order: ${finalMessage}`,
            last_message_time: new Date(),
            customer_unread_count: 1,
          })
          .select()
          .single();
        if (convError) throw convError;
        conversationId = newConv.id;
      }

      const messageText = `❌ Order #${orderToCancel.order_number?.slice(-8)} cancelled: ${finalMessage}`;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_role: 'customer',
        message: messageText,
        is_read: false,
      });

      await refreshOrders();
      Alert.alert('Order Cancelled', 'Your order has been cancelled. The vendor has been notified.');
      setCancelModalVisible(false);
      setOrderToCancel(null);
      setCancelReasonId(null);
      setCancelCustomMessage('');
    } catch (error) {
      console.error('Cancel error:', error);
      Alert.alert('Error', 'Could not cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  // ========== HANDLE PROPOSAL RESPONSES ==========
  const handleAcceptProposal = async (order, proposalData) => {
    try {
      const updatedItems = order.items.map(item => {
        if (item.id === proposalData.item_id) {
          return {
            ...item,
            quantity: proposalData.proposed_quantity,
            unit: proposalData.proposed_unit,
            price: proposalData.price_per_unit,
          };
        }
        return item;
      });
      
      const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const { error } = await supabase
        .from('orders')
        .update({
          items: updatedItems,
          total_amount: newTotal,
          proposed_changes: { ...proposalData, status: 'accepted' }
        })
        .eq('id', order.id);
      
      if (error) throw error;
      
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('customer_id', user.id)
        .eq('stall_id', order.stall_id)
        .maybeSingle();
      
      if (conversation) {
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          sender_role: 'customer',
          message: `✅ I accept the proposal. Order updated to ${proposalData.proposed_quantity} x ${proposalData.proposed_unit} of ${proposalData.item_name} (₱${(proposalData.proposed_quantity * proposalData.price_per_unit).toFixed(2)}).`,
          is_read: false,
        });
        
        await supabase
          .from('conversations')
          .update({
            last_message: `✅ Customer accepted proposal. Order updated to ${proposalData.proposed_quantity} x ${proposalData.proposed_unit} of ${proposalData.item_name} (₱${(proposalData.proposed_quantity * proposalData.price_per_unit).toFixed(2)}).`,
            last_message_time: new Date(),
            vendor_unread_count: 1,
          })
          .eq('id', conversation.id);
      }
      
      await refreshOrders();
      Alert.alert('Order Updated', `Order updated to ${proposalData.proposed_quantity} ${proposalData.proposed_unit} of ${proposalData.item_name}`);
      
    } catch (error) {
      console.error('Accept proposal error:', error);
      Alert.alert('Error', 'Failed to accept proposal');
    }
  };

  const handleRejectProposal = async (order, proposalData) => {
    try {
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('customer_id', user.id)
        .eq('stall_id', order.stall_id)
        .maybeSingle();
      
      if (conversation) {
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          sender_role: 'customer',
          message: `❌ I do not accept the proposal. Please fulfill the original order or cancel.`,
          is_read: false,
        });
        
        await supabase
          .from('conversations')
          .update({
            last_message: `❌ Customer rejected the proposal. Please fulfill original order.`,
            last_message_time: new Date(),
            vendor_unread_count: 1,
          })
          .eq('id', conversation.id);
      }
      
      await supabase
        .from('orders')
        .update({ proposed_changes: { ...proposalData, status: 'rejected' } })
        .eq('id', order);
      
      await refreshOrders();
      Alert.alert('Proposal Rejected', 'The vendor has been notified of your decision');
      
    } catch (error) {
      console.error('Reject proposal error:', error);
      Alert.alert('Error', 'Failed to reject proposal');
    }
  };

  // UI helpers
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
    const icons = {
      pending: '⏳',
      confirmed: '✅',
      preparing: '👨‍🍳',
      ready: '🛎️',
      completed: '📦',
      cancelled: '❌',
    };
    const text = t(`orders.status.${status}`, status);
    return `${icons[status] || ''} ${text}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Pending';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatPickupTime = (dateString) => {
    if (!dateString) return 'Pending';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status));
  const displayOrders = activeTab === 'active' ? activeOrders : completedOrders;

  // Render order card
  const renderOrderCard = (order) => {
    const stall = order.stall || {
      stall_number: 'N/A',
      stall_name: 'Market Stall',
      section: 'Unknown',
      id: null
    };
    
    const hasValidStall = stall && stall.stall_number !== 'N/A' && stall.id;
    const stallCoords = hasValidStall 
      ? getStallCoordinates(stall.section, stall.stall_number)
      : { latitude: 13.9417, longitude: 121.1642 };
    
    const isCompleted = order.status === 'completed';
    const isCancelled = order.status === 'cancelled';
    const isPending = order.status === 'pending';
    const isConfirmed = order.status === 'confirmed';
    
    // Check if order is awaiting payment (unpaid)
    const isAwaitingPayment = order.payment_status === 'awaiting_payment' && order.status === 'pending';
    
    // Check for pending proposal
    const hasPendingProposal = order.proposed_changes && order.proposed_changes.status === 'pending';
    const proposalData = order.proposed_changes;
    
    return (
      <View key={order.id} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>
              Order #{order.order_number?.slice(-8) || order.id?.toString().slice(-8) || 'N/A'}
            </Text>
            <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
              <Text style={styles.statusText}>{order.status?.toUpperCase() || 'PENDING'}</Text>
            </View>
            {isCompleted && (
              <TouchableOpacity
                onPress={() => deleteOrderFromHistory(order.id)}
                style={styles.cardDeleteIcon}
              >
                <Text style={styles.cardDeleteIconText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Order Status Timeline */}
        <OrderTimeline status={order.status} colors={{ primary: COLORS.primary }} />

        {/* PAY NOW BUTTON - Only for unpaid orders (awaiting_payment) */}
        {isAwaitingPayment && (
          <View style={styles.payNowContainer}>
            <View style={styles.payNowHeader}>
              <Ionicons name="alert-circle" size={18} color={COLORS.warning} />
              <Text style={styles.payNowHeaderText}>Payment Pending</Text>
            </View>
            <TouchableOpacity 
              style={styles.payNowButton}
              onPress={() => handlePayNow(order)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payNowGradient}
              >
                <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
                <Text style={styles.payNowText}>Pay Now</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.payNowHint}>
              Complete your GCash payment within 10 minutes
            </Text>
          </View>
        )}

        {/* PROPOSAL BANNER */}
        {hasPendingProposal && proposalData && (
          <View style={styles.proposalContainer}>
            <View style={styles.proposalBanner}>
              <Text style={styles.proposalTitle}>📝 Vendor Proposed a Change</Text>
              <Text style={styles.proposalText}>
                {proposalData.item_name}:
              </Text>
              <Text style={styles.proposalText}>
                Original: {proposalData.original_quantity} {proposalData.original_unit}
              </Text>
              <Text style={styles.proposalText}>
                Proposed: {proposalData.proposed_quantity} {proposalData.proposed_unit}
              </Text>
              <Text style={styles.proposalPrice}>
                New total: ₱{proposalData.proposed_price.toFixed(2)} 
                (was ₱{proposalData.original_price.toFixed(2)})
              </Text>
            </View>
            <View style={styles.proposalButtons}>
              <TouchableOpacity 
                style={styles.rejectProposalBtn}
                onPress={() => handleRejectProposal(order, proposalData)}
              >
                <Text style={styles.rejectProposalBtnText}>❌ Reject</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.acceptProposalBtn}
                onPress={() => handleAcceptProposal(order, proposalData)}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.acceptProposalGradient}
                >
                  <Text style={styles.acceptProposalBtnText}>✅ Accept</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.stallInfo}>
          <Text style={styles.stallName}>
            🏪 {stall.stall_name || 'Market Stall'} {stall.stall_number !== 'N/A' ? `(#${stall.stall_number})` : ''}
          </Text>
          <Text style={styles.stallSection}>{stall.section || 'Unknown Section'}</Text>
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

        <View style={styles.pickupContainer}>
          <Text style={styles.pickupLabel}>⏰ Pickup Time:</Text>
          <Text style={styles.pickupTime}>{formatPickupTime(order.pickup_time)}</Text>
        </View>

        {order.special_instructions && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsLabel}>📝 Instructions:</Text>
            <Text style={styles.instructionsText}>{order.special_instructions}</Text>
          </View>
        )}

        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₱{order.total_amount}</Text>
        </View>

        {/* ✅ CANCEL ORDER BUTTON - Shows for ALL pending orders */}
        {isPending && (
          <TouchableOpacity
            style={styles.cancelOrderButton}
            onPress={() => {
              setOrderToCancel(order);
              setCancelModalVisible(true);
            }}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.cancelGradient}
            >
              <Text style={styles.cancelButtonText}>Cancel Order</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {isCompleted && (
          <View style={styles.completedActionsRow}>
            <TouchableOpacity 
              style={styles.orderAgainButton}
              onPress={() => handleOrderAgain(order)}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.actionButtonGradient}
              >
                <Text style={styles.actionButtonText}>🔄 Order Again</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.rateButton}
              onPress={() => handleRateVendor(order)}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.actionButtonGradient}
              >
                <Text style={styles.actionButtonText}>⭐ Rate Vendor</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {!['completed', 'cancelled'].includes(order.status) && hasValidStall && (
          <>
            <View style={styles.mapButtonsRow}>
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={() => showStallMap(stall)}
              >
                <LinearGradient
                  colors={['#4CAF50', '#45A049']}
                  style={styles.mapGradient}
                >
                  <Text style={styles.mapButtonText}>🗺️ View Map</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.directionsButton}
                onPress={() => openMapsDirections(stall)}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E8E']}
                  style={styles.mapGradient}
                >
                  <Text style={styles.mapButtonText}>📍 Get Directions</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.miniMapPreview}
              onPress={() => showStallMap(stall)}
              activeOpacity={0.8}
            >
              <StallMap
                latitude={stallCoords.latitude}
                longitude={stallCoords.longitude}
                stallName={stall.stall_name}
                stallNumber={stall.stall_number}
                section={stall.section}
                height={120}
                interactive={false}
              />
            </TouchableOpacity>
          </>
        )}

        {['ready', 'confirmed', 'preparing'].includes(order.status) && (
          <TouchableOpacity 
            style={styles.pickupButton}
            onPress={() => navigation.navigate('PickupPass', { order, stall })}
          >
            <LinearGradient
              colors={order.status === 'ready' ? ['#10B981', '#059669'] : [COLORS.primary, COLORS.primaryLight]}
              style={styles.pickupGradient}
            >
              <Text style={styles.pickupButtonText}>
                {order.status === 'ready' ? `📦 ${t('orders.ready_for_pickup')}` : `📋 ${t('orders.pickup_pass')}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Star rating helper
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setSelectedRating(i)}
          style={styles.starButton}
        >
          <Text style={[styles.starIcon, selectedRating >= i && styles.starIconSelected]}>
            {selectedRating >= i ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      );
    }
    return stars;
  };

  if (isGuest) {
    return (
      <View style={styles.guestContainer}>
        <Text style={styles.guestIcon}>📋</Text>
        <Text style={styles.guestTitle}>Sign in to view orders</Text>
        <Text style={styles.guestText}>
          Create an account to track your orders and order history
        </Text>
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => navigation.navigate('Login')}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E8E']}
            style={styles.signInGradient}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {newOrderAlert && activeTab === 'active' && (
        <View style={styles.newOrderAlert}>
          <Text style={styles.newOrderAlertText}>🎉 New order placed! Check your order status below.</Text>
        </View>
      )}

      <View style={styles.tabContainer}>
        <View style={styles.tabsRow}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'active' && styles.activeTab]}
            onPress={() => setActiveTab('active')}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
              {t('orders.active')} ({activeOrders.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
            onPress={() => setActiveTab('completed')}
          >
            <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
              {t('orders.history')} ({completedOrders.length})
            </Text>
          </TouchableOpacity>
        </View>
        
        {activeTab === 'completed' && completedOrders.length > 0 && (
          <TouchableOpacity onPress={clearAllHistory} style={styles.clearAllButton}>
            <Text style={styles.clearAllButtonText}>{t('orders.clear_history')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B6B']} />
        }
      >
        {displayOrders.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title={activeTab === 'active' ? t('orders.no_active') : t('orders.no_history')}
            subtitle={activeTab === 'active' ? t('orders.place_order_prompt') : t('orders.history_prompt')}
            actionLabel={t('home.start_shopping')}
            onAction={() => navigation.navigate('Home')}
            colors={{
              icon: COLORS.text.tertiary || '#9CA3AF',
              title: COLORS.text.secondary || '#6B7280',
              subtitle: COLORS.text.tertiary || '#9CA3AF',
              background: COLORS.background || '#FFFFFF',
              iconBg: COLORS.surfaceSecondary || '#F3F4F6',
            }}
          />
        ) : (
          displayOrders.map(renderOrderCard)
        )}
      </ScrollView>

      {/* Map Modal */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedStall?.stall_name || 'Stall Location'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Stall #{selectedStall?.stall_number} - {selectedStall?.section}
            </Text>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setMapModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          
          {selectedStall && selectedStall.stall_number !== 'N/A' && (
            <StallMap
              latitude={getStallCoordinates(selectedStall.section, selectedStall.stall_number).latitude}
              longitude={getStallCoordinates(selectedStall.section, selectedStall.stall_number).longitude}
              stallName={selectedStall.stall_name}
              stallNumber={selectedStall.stall_number}
              section={selectedStall.section}
              height={height - 200}
              interactive={true}
            />
          )}
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.modalDirectionsButton}
              onPress={() => {
                setMapModalVisible(false);
                if (selectedStall) openMapsDirections(selectedStall);
              }}
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF8E8E']}
                style={styles.modalDirectionsGradient}
              >
                <Text style={styles.modalDirectionsText}>📍 Get Directions</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={ratingModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModalContainer}>
            <Text style={styles.ratingModalTitle}>Rate Your Experience</Text>
            <Text style={styles.ratingModalSubtitle}>
              {selectedOrder?.stall?.stall_name || 'Vendor'}
            </Text>
            
            <View style={styles.starsContainer}>
              {renderStars()}
            </View>
            
            <TextInput
              style={styles.ratingCommentInput}
              placeholder="Share your experience (optional)"
              placeholderTextColor="#9CA3AF"
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.ratingModalButtons}>
              <TouchableOpacity 
                style={styles.ratingModalCancel}
                onPress={() => setRatingModalVisible(false)}
              >
                <Text style={styles.ratingModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.ratingModalSubmit}
                onPress={submitRating}
                disabled={submittingRating}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E8E']}
                  style={styles.ratingModalSubmitGradient}
                >
                  <Text style={styles.ratingModalSubmitText}>
                    {submittingRating ? 'Submitting...' : 'Submit Rating'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Customer Cancellation Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ratingModalContainer}>
            <Text style={styles.ratingModalTitle}>Cancel Order</Text>
            <Text style={styles.ratingModalSubtitle}>
              Why are you cancelling this order?
            </Text>

            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {CANCEL_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonOption,
                    cancelReasonId === reason.id && styles.reasonOptionSelected,
                  ]}
                  onPress={() => setCancelReasonId(reason.id)}
                >
                  <Text style={[
                    styles.reasonText,
                    cancelReasonId === reason.id && styles.reasonTextSelected,
                  ]}>
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
              {cancelReasonId === 'other' && (
                <TextInput
                  style={styles.customInput}
                  placeholder="Type your reason..."
                  placeholderTextColor="#9CA3AF"
                  value={cancelCustomMessage}
                  onChangeText={setCancelCustomMessage}
                  multiline
                  numberOfLines={3}
                />
              )}
            </ScrollView>

            <View style={styles.ratingModalButtons}>
              <TouchableOpacity
                style={styles.ratingModalCancel}
                onPress={() => {
                  setCancelModalVisible(false);
                  setOrderToCancel(null);
                  setCancelReasonId(null);
                  setCancelCustomMessage('');
                }}
              >
                <Text style={styles.ratingModalCancelText}>Go Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ratingModalSubmit, (!cancelReasonId || cancelling) && { opacity: 0.5 }]}
                onPress={handleCancelOrder}
                disabled={!cancelReasonId || cancelling}
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  style={styles.ratingModalSubmitGradient}
                >
                  <Text style={styles.ratingModalSubmitText}>
                    {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PAY NOW GCASH MODAL */}
      <Modal
        visible={payNowModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.gcashModalOverlay}>
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.gcashModalCloseButton} 
            onPress={() => {
              Alert.alert(
                'Payment Pending',
                'You can continue paying or close this window. Your order will remain pending.',
                [
                  { text: 'Continue Paying', style: 'cancel' },
                  { 
                    text: 'Close', 
                    onPress: () => {
                      if (payNowTimerRef.current) clearInterval(payNowTimerRef.current);
                      setPayNowModalVisible(false);
                    }
                  }
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <ScrollView 
            style={styles.gcashModalScroll} 
            contentContainerStyle={styles.gcashModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.gcashModalContent}>
              {/* Header */}
              <View style={styles.gcashModalHeader}>
                <View style={styles.gcashModalHeaderIcon}>
                  <Ionicons name="wallet" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.gcashModalTitle}>GCash Payment</Text>
                <Text style={styles.gcashModalSubtitle}>
                  Pay for Order #{payNowOrder?.order_number?.slice(-8)}
                </Text>
              </View>

              {/* Timer */}
              <View style={[
                styles.gcashTimerSection, 
                payNowCountdown <= 60 && styles.gcashTimerUrgentBg
              ]}>
                <Ionicons 
                  name={payNowCountdown <= 60 ? "time" : "hourglass-outline"} 
                  size={22} 
                  color={payNowCountdown <= 60 ? '#EF4444' : COLORS.primary} 
                />
                <Text style={styles.gcashTimerLabel}>Time Remaining</Text>
                <Text style={[
                  styles.gcashTimerValue,
                  payNowCountdown <= 60 && styles.gcashTimerValueUrgent
                ]}>
                  {formatCountdown(payNowCountdown)}
                </Text>
              </View>

              {/* Order Summary */}
              {payNowOrder && (
                <View style={styles.payNowOrderSummary}>
                  <Text style={styles.payNowOrderVendor}>
                    {payNowOrder.stall?.stall_name || 'Market Stall'}
                  </Text>
                  <Text style={styles.payNowOrderAmount}>
                    Amount: ₱{payNowOrder.total_amount?.toFixed(2)}
                  </Text>
                  <View style={styles.payNowOrderItems}>
                    {payNowOrder.items?.map((item, idx) => (
                      <Text key={idx} style={styles.payNowOrderItem}>
                        {item.quantity}x {item.name} ({item.unit})
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* QR Code - Vendor's GCash QR */}
              <View style={styles.gcashQRContainer}>
                <Text style={styles.gcashQRTitle}>Scan to Pay</Text>
                <View style={styles.gcashQRBox}>
                  {payNowOrder?.stall?.gcash_qr_url ? (
                    <Image 
                      source={{ uri: payNowOrder.stall.gcash_qr_url }} 
                      style={styles.gcashQRImage} 
                      resizeMode="contain" 
                    />
                  ) : (
                    <View style={styles.gcashQRPlaceholder}>
                      <Ionicons name="qr-code-outline" size={72} color={COLORS.gcash} />
                      <Text style={styles.gcashQRPlaceholderText}>Vendor QR Code</Text>
                      <Text style={styles.gcashQRPlaceholderSubtext}>
                        GCash: {payNowOrder?.stall?.gcash_number || '0917 123 4567'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.gcashQRVendor}>
                  {payNowOrder?.stall?.stall_name || 'Market Stall'}
                </Text>
                <Text style={styles.gcashQRPrice}>
                  Amount: ₱{payNowOrder?.total_amount?.toFixed(2)}
                </Text>
                <Text style={styles.gcashQRHint}>
                  Open GCash, scan QR, send exact amount
                </Text>
              </View>

              {/* Reference Number Input */}
              <View style={styles.gcashInputSection}>
                <Text style={styles.gcashInputLabel}>
                  <Ionicons name="document-text-outline" size={16} color={COLORS.text.dark} /> Reference Number
                </Text>
                <TextInput
                  style={styles.gcashInput}
                  placeholder="Enter GCash reference number"
                  placeholderTextColor={COLORS.text.lighter}
                  value={payNowReferenceNumber}
                  onChangeText={setPayNowReferenceNumber}
                  keyboardType="numeric"
                  maxLength={20}
                />
              </View>

              {/* Receipt Upload */}
              <View style={styles.gcashReceiptSection}>
                <Text style={styles.gcashInputLabel}>
                  <Ionicons name="camera-outline" size={16} color={COLORS.text.dark} /> Payment Receipt
                </Text>
                <TouchableOpacity 
                  style={styles.gcashReceiptButton} 
                  onPress={pickPayNowReceipt} 
                  disabled={payNowReceiptUploading} 
                  activeOpacity={0.7}
                >
                  {payNowReceiptUri ? (
                    <View style={styles.gcashReceiptPreviewContainer}>
                      <Image source={{ uri: payNowReceiptUri }} style={styles.gcashReceiptPreview} />
                      <Text style={styles.gcashReceiptChangeText}>
                        <Ionicons name="refresh-outline" size={14} /> Tap to change
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.gcashReceiptPlaceholder}>
                      <Ionicons name="cloud-upload-outline" size={36} color={COLORS.gcash} />
                      <Text style={styles.gcashReceiptText}>
                        {payNowReceiptUploading ? 'Uploading...' : 'Upload Receipt'}
                      </Text>
                      <Text style={styles.gcashReceiptHint}>Tap to select from gallery</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.gcashSubmitButton,
                  payNowSubmitting && styles.gcashSubmitButtonDisabled
                ]}
                onPress={handlePayNowSubmit}
                disabled={payNowSubmitting}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={[COLORS.gcash, '#005BB5']} 
                  start={{ x: 0, y: 0 }} 
                  end={{ x: 1, y: 0 }} 
                  style={styles.gcashSubmitGradient}
                >
                  {payNowSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.gcashSubmitText}>Confirm Payment</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  // ... (styles remain the same as before)
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guestContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  guestIcon: { fontSize: 56 },
  guestTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text.dark, marginBottom: 12, textAlign: 'center' },
  guestText: { fontSize: 15, color: COLORS.text.medium, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  signInButton: { borderRadius: 16, overflow: 'hidden', shadowColor: COLORS.shadowDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  signInGradient: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16 },
  signInButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  newOrderAlert: { backgroundColor: COLORS.accentSoft, padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: COLORS.accentLight },
  newOrderAlertText: { fontSize: 14, color: COLORS.primary, textAlign: 'center', fontWeight: '600' },
  
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabsRow: { flexDirection: 'row', gap: 16 },
  tab: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  activeTab: { backgroundColor: COLORS.accentSoft },
  tabText: { fontSize: 14, color: COLORS.text.medium, fontWeight: '600' },
  activeTabText: { color: COLORS.primary, fontWeight: '700' },
  clearAllButton: { backgroundColor: COLORS.accentLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  clearAllButtonText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 30 },
  orderCard: { backgroundColor: COLORS.surface, borderRadius: 20, marginBottom: 16, padding: 16, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: COLORS.borderLight },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderNumber: { fontSize: 16, fontWeight: '700', color: COLORS.text.dark },
  orderDate: { fontSize: 12, color: COLORS.text.light, marginTop: 3 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, shadowColor: COLORS.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 3, elevation: 2 },
  statusText: { fontSize: 10, fontWeight: '700', color: 'white', letterSpacing: 0.5 },
  cardDeleteIcon: { marginLeft: 6, padding: 6 },
  cardDeleteIconText: { fontSize: 18, fontWeight: '700', color: COLORS.error },
  
  // PAY NOW STYLES
  payNowContainer: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  payNowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  payNowHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  payNowButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 6,
  },
  payNowGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  payNowText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  payNowHint: {
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
  },

  stallInfo: { backgroundColor: COLORS.background, padding: 12, borderRadius: 12, marginBottom: 12 },
  stallName: { fontSize: 15, fontWeight: '700', color: COLORS.text.dark, marginBottom: 2 },
  stallSection: { fontSize: 13, color: COLORS.text.medium },
  itemsContainer: { marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  itemName: { fontSize: 14, color: COLORS.text.medium, flex: 2 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  pickupContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  pickupLabel: { fontSize: 13, color: COLORS.text.medium },
  pickupTime: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  instructionsContainer: { backgroundColor: COLORS.accentSoft, padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.accentLight },
  instructionsLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  instructionsText: { fontSize: 13, color: COLORS.text.medium, lineHeight: 18 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, marginBottom: 12 },
  totalLabel: { fontSize: 15, color: COLORS.text.medium },
  totalAmount: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  cancelOrderButton: { marginTop: 8, marginBottom: 8, borderRadius: 10, overflow: 'hidden' },
  cancelGradient: { paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },

  completedActionsRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 12 },
  orderAgainButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  rateButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  actionButtonGradient: { paddingVertical: 12, alignItems: 'center' },
  actionButtonText: { color: 'white', fontSize: 13, fontWeight: '600' },

  mapButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 12 },
  mapButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  directionsButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  mapGradient: { paddingVertical: 12, alignItems: 'center' },
  mapButtonText: { fontSize: 13, fontWeight: '600', color: 'white' },
  miniMapPreview: { marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  pickupButton: { marginTop: 8, borderRadius: 10, overflow: 'hidden' },
  pickupGradient: { paddingVertical: 14, alignItems: 'center' },
  pickupButtonText: { fontSize: 14, fontWeight: '600', color: 'white' },

  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text.dark, marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 15, color: COLORS.text.medium, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  shopButton: { borderRadius: 16, overflow: 'hidden', shadowColor: COLORS.shadowDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8, elevation: 4 },
  shopGradient: { paddingHorizontal: 36, paddingVertical: 14, borderRadius: 16 },
  shopButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#FF6B6B' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  modalSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  modalCloseButton: { position: 'absolute', top: 50, right: 16, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  modalCloseText: { color: 'white', fontSize: 14, fontWeight: '600' },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  modalDirectionsButton: { borderRadius: 12, overflow: 'hidden' },
  modalDirectionsGradient: { paddingVertical: 14, alignItems: 'center' },
  modalDirectionsText: { color: 'white', fontSize: 16, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  ratingModalContainer: { width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 20, alignItems: 'center' },
  ratingModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  ratingModalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  starsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  starButton: { paddingHorizontal: 8 },
  starIcon: { fontSize: 40, color: '#D1D5DB' },
  starIconSelected: { color: '#F59E0B' },
  ratingCommentInput: { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: '#111827', textAlignVertical: 'top', minHeight: 80, marginBottom: 20 },
  ratingModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  ratingModalCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  ratingModalCancelText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
  ratingModalSubmit: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  ratingModalSubmitGradient: { paddingVertical: 12, alignItems: 'center' },
  ratingModalSubmitText: { color: 'white', fontSize: 14, fontWeight: '600' },

  reasonOption: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8, backgroundColor: '#F3F4F6' },
  reasonOptionSelected: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#EF4444' },
  reasonText: { fontSize: 14, color: '#374151' },
  reasonTextSelected: { color: '#DC2626', fontWeight: '500' },
  customInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 14, color: '#111827', textAlignVertical: 'top', marginTop: 8, marginBottom: 12 },

  // Proposal styles
  proposalContainer: {
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  proposalBanner: {
    marginBottom: 12,
  },
  proposalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 6,
  },
  proposalText: {
    fontSize: 13,
    color: '#78350F',
    marginBottom: 4,
  },
  proposalPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
    marginBottom: 4,
  },
  proposalNotes: {
    fontSize: 12,
    color: '#92400E',
    fontStyle: 'italic',
    marginTop: 4,
  },
  proposalUnitNote: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 4,
  },
  proposalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectProposalBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rejectProposalBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  acceptProposalBtn: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  acceptProposalGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptProposalBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },

  // GCash Modal Styles
  gcashModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
  },
  gcashModalCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  gcashModalScroll: {
    width: '100%',
    maxHeight: '95%',
  },
  gcashModalScrollContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  gcashModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    padding: 20,
    marginTop: Platform.OS === 'ios' ? 30 : 10,
  },
  gcashModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  gcashModalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.gcash,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gcashModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  gcashModalSubtitle: {
    fontSize: 13,
    color: COLORS.text.light,
    marginTop: 2,
    textAlign: 'center',
  },
  gcashTimerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.gcashLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  gcashTimerUrgentBg: {
    backgroundColor: '#FEE2E2',
  },
  gcashTimerLabel: {
    fontSize: 12,
    color: COLORS.text.light,
    marginLeft: 4,
  },
  gcashTimerValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gcash,
    marginLeft: 'auto',
  },
  gcashTimerValueUrgent: {
    color: '#EF4444',
  },
  gcashQRContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  gcashQRTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 8,
  },
  gcashQRBox: {
    width: 160,
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gcashQRImage: {
    width: '100%',
    height: '100%',
  },
  gcashQRPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gcashQRPlaceholderText: {
    fontSize: 11,
    color: COLORS.text.light,
    marginTop: 4,
  },
  gcashQRPlaceholderSubtext: {
    fontSize: 10,
    color: COLORS.text.lighter,
  },
  gcashQRVendor: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginTop: 8,
  },
  gcashQRPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  gcashQRHint: {
    fontSize: 11,
    color: COLORS.text.light,
    marginTop: 2,
    textAlign: 'center',
  },
  gcashInputSection: {
    marginBottom: 16,
  },
  gcashInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 8,
  },
  gcashInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.text.dark,
    backgroundColor: COLORS.background,
  },
  gcashReceiptSection: {
    marginBottom: 16,
  },
  gcashReceiptButton: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
  },
  gcashReceiptPlaceholder: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gcashReceiptText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gcash,
    marginTop: 8,
  },
  gcashReceiptHint: {
    fontSize: 11,
    color: COLORS.text.light,
    marginTop: 2,
  },
  gcashReceiptPreviewContainer: {
    alignItems: 'center',
    padding: 8,
  },
  gcashReceiptPreview: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  gcashReceiptChangeText: {
    fontSize: 11,
    color: COLORS.gcash,
    marginTop: 8,
    fontWeight: '500',
  },
  gcashSubmitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  gcashSubmitButtonDisabled: {
    opacity: 0.6,
  },
  gcashSubmitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  gcashSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  payNowOrderSummary: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  payNowOrderVendor: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 4,
  },
  payNowOrderAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  payNowOrderItems: {
    marginTop: 4,
  },
  payNowOrderItem: {
    fontSize: 12,
    color: COLORS.text.medium,
    marginBottom: 2,
  },
});