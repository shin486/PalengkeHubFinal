// src/components/CheckoutContent.js

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../hooks/useCart';
import { supabase } from '../../lib/supabase';

const COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  primarySurface: '#FEF2F2',
  background: '#F8F9FB',
  surface: '#FFFFFF',
  text: {
    dark: '#1F2937',
    medium: '#374151',
    light: '#6B7280',
    lighter: '#9CA3AF',
    white: '#FFFFFF',
  },
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  warning: '#F59E0B',
  gcash: '#007DFE',
  gcashLight: '#E8F4FF',
  shadow: 'rgba(0, 0, 0, 0.04)',
  shadowDark: 'rgba(0, 0, 0, 0.08)',
};

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

export default function CheckoutContent({ cart, cartTotal, navigation, onBack }) {
  const { user } = useAuth();
  const { clearCart } = useCart();
  
  const [loading, setLoading] = useState(false);
  const [pickupTime, setPickupTime] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  // ✅ Per-vendor GCash payment states
  const [gcashModalVisible, setGcashModalVisible] = useState(false);
  const [gcashPayments, setGcashPayments] = useState([]);
  const [currentVendorIndex, setCurrentVendorIndex] = useState(0);
  const [allPaymentsCompleted, setAllPaymentsCompleted] = useState(false);
  const [gcashReceiptUploading, setGcashReceiptUploading] = useState(false);
  const [gcashSubmitting, setGcashSubmitting] = useState(false);
  
  // ✅ Each vendor has their own timer (stored in the payment object)
  const gcashTimerRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (gcashTimerRef.current) {
        clearInterval(gcashTimerRef.current);
      }
    };
  }, []);

  // ✅ Timer tick function - updates countdown for current vendor
  const startTimerForVendor = (index) => {
    if (gcashTimerRef.current) {
      clearInterval(gcashTimerRef.current);
    }
    
    gcashTimerRef.current = setInterval(() => {
      setGcashPayments(prev => {
        const updated = [...prev];
        if (updated[index] && updated[index].timeRemaining > 0) {
          updated[index].timeRemaining = updated[index].timeRemaining - 1;
          
          // Check if timer expired
          if (updated[index].timeRemaining <= 0 && !updated[index].isPaid) {
            clearInterval(gcashTimerRef.current);
            handleVendorTimeout(index);
          }
        }
        return updated;
      });
    }, 1000);
  };

  // ✅ Handle timeout for a specific vendor
  const handleVendorTimeout = async (index) => {
    const payment = gcashPayments[index];
    if (!payment || payment.isPaid) return;
    
    try {
      // Cancel only this vendor's order
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled', payment_status: 'expired' })
        .eq('id', payment.orderId);
      
      if (error) console.error('Error cancelling order:', error);
      
      // Mark as expired
      setGcashPayments(prev => {
        const updated = [...prev];
        updated[index].isExpired = true;
        updated[index].timeRemaining = 0;
        return updated;
      });
      
      Alert.alert(
        '⏰ Payment Time Expired',
        `Your 10-minute payment window for ${payment.stallName} has expired. This vendor's order has been cancelled.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Vendor timeout error:', error);
    }
  };

  // Handle GCash modal close
  const handleGcashModalClose = () => {
    // Check if any vendor is still unpaid
    const hasUnpaid = gcashPayments.some(p => !p.isPaid && !p.isExpired);
    
    if (hasUnpaid) {
      Alert.alert(
        'Payment Pending',
        'You have unpaid vendors. You can continue paying or view your orders later.',
        [
          { text: 'Continue Paying', style: 'cancel' },
          { 
            text: 'Go to Orders', 
            onPress: () => {
              if (gcashTimerRef.current) {
                clearInterval(gcashTimerRef.current);
              }
              setGcashModalVisible(false);
              navigation.navigate('Orders');
            }
          }
        ]
      );
    } else {
      setGcashModalVisible(false);
    }
  };

  // Pick GCash receipt image for a specific vendor
  const pickGcashReceipt = async (index) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow photo library access to upload your GCash receipt.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setGcashPayments(prev => {
          const updated = [...prev];
          updated[index].receiptUri = result.assets[0].uri;
          return updated;
        });
      }
    } catch (error) {
      console.error('Error picking receipt:', error);
      Alert.alert('Error', 'Failed to select receipt image.');
    }
  };

  // Upload GCash receipt to Supabase storage
  const uploadGcashReceipt = async (uri, stallId, vendorIndex) => {
    if (!uri) return null;
    setGcashReceiptUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileName = `receipt_${Date.now()}_${stallId}.jpg`;
      const folder = `gcash_receipts/${user.id}/${stallId}`;
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
      setGcashReceiptUploading(false);
    }
  };

  // ✅ Submit payment for current vendor
  const handleSubmitPayment = async (index) => {
    const payment = gcashPayments[index];
    
    if (!payment.referenceNumber || payment.referenceNumber.trim().length < 6) {
      Alert.alert('Missing Reference Number', 'Please enter the GCash reference number from your payment.');
      return;
    }
    if (!payment.receiptUri) {
      Alert.alert('Missing Receipt', 'Please upload a screenshot of your GCash receipt.');
      return;
    }
    
    setGcashPayments(prev => {
      const updated = [...prev];
      updated[index].isProcessing = true;
      return updated;
    });
    
    try {
      const receiptUrl = await uploadGcashReceipt(payment.receiptUri, payment.stallId, index);
      if (!receiptUrl) {
        setGcashPayments(prev => {
          const updated = [...prev];
          updated[index].isProcessing = false;
          return updated;
        });
        return;
      }
      
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          payment_reference: payment.referenceNumber.trim(),
          payment_receipt_url: receiptUrl,
          paid_at: new Date().toISOString(),
        })
        .eq('id', payment.orderId);
      
      if (error) throw error;
      
      // ✅ Mark this vendor as paid
      setGcashPayments(prev => {
        const updated = [...prev];
        updated[index].isPaid = true;
        updated[index].isSubmitted = true;
        updated[index].isProcessing = false;
        updated[index].receiptUrl = receiptUrl;
        return updated;
      });
      
      // ✅ Check if all vendors are paid
      const allPaid = gcashPayments.every(p => p.isPaid || p.isExpired);
      
      if (allPaid) {
        setAllPaymentsCompleted(true);
        if (gcashTimerRef.current) {
          clearInterval(gcashTimerRef.current);
        }
        setTimeout(() => {
          setGcashModalVisible(false);
          Alert.alert(
            '✅ All Payments Submitted! 🎉',
            'Your GCash payments have been submitted successfully. The vendors will verify your payments and confirm your orders.',
            [
              { text: 'View Orders', onPress: () => navigation.navigate('Orders') },
              { text: 'Continue Shopping', onPress: () => navigation.navigate('Home') }
            ]
          );
        }, 1500);
      } else {
        // ✅ Move to next unpaid vendor
        const nextIndex = gcashPayments.findIndex((p, idx) => idx > index && !p.isPaid && !p.isExpired);
        if (nextIndex !== -1) {
          setCurrentVendorIndex(nextIndex);
          // Start timer for next vendor
          startTimerForVendor(nextIndex);
          Alert.alert(
            '✅ Payment Submitted!',
            `Payment for ${payment.stallName} confirmed. Please proceed to pay the next vendor.`,
            [{ text: 'Continue' }]
          );
        }
      }
      
    } catch (error) {
      console.error('Error submitting payment:', error);
      Alert.alert('Error', 'Failed to submit payment. Please try again.');
      setGcashPayments(prev => {
        const updated = [...prev];
        updated[index].isProcessing = false;
        return updated;
      });
    }
  };

  // ✅ Skip to next unpaid vendor
  const skipToNextVendor = (currentIndex) => {
    const nextIndex = gcashPayments.findIndex((p, idx) => idx > currentIndex && !p.isPaid && !p.isExpired);
    if (nextIndex !== -1) {
      setCurrentVendorIndex(nextIndex);
      // Stop current timer and start new one for next vendor
      if (gcashTimerRef.current) {
        clearInterval(gcashTimerRef.current);
      }
      startTimerForVendor(nextIndex);
    }
  };

  const formatTime = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  };

  const formatDate = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const groupByStall = () => {
    const grouped = {};
    cart.forEach(item => {
      const stallId = item.stall_id;
      if (!grouped[stallId]) {
        grouped[stallId] = {
          stall: {
            stall_name: item.stall_name,
            stall_number: item.stall_number,
            section: item.section,
            stall_id: stallId,
            gcash_qr_url: item.gcash_qr_url || null,
            gcash_number: item.gcash_number || '0917 123 4567',
          },
          items: [],
          total: 0,
        };
      }
      grouped[stallId].items.push({
        id: item.product_id || item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        unit: item.unit,
      });
      grouped[stallId].total += (item.price * (item.quantity || 1));
    });
    return grouped;
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(pickupTime.getHours());
      newDate.setMinutes(pickupTime.getMinutes());
      setPickupTime(newDate);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newTime = new Date(pickupTime);
      newTime.setHours(selectedTime.getHours());
      newTime.setMinutes(selectedTime.getMinutes());
      setPickupTime(newTime);
    }
  };

  // ✅ FULL GCASH PAYMENT FLOW - Place order then open GCash modal
  const placeOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart first');
      return;
    }

    setLoading(true);
    try {
      const groupedOrders = groupByStall();
      const payments = [];

      for (const [stallId, data] of Object.entries(groupedOrders)) {
        const items = data.items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          unit: item.unit,
        }));

        const subtotal = data.total;
        const orderNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const orderData = {
          order_number: orderNumber,
          consumer_id: user.id,
          stall_id: parseInt(stallId),
          items: items,
          subtotal: subtotal,
          total_amount: subtotal,
          status: 'pending',
          pickup_time: pickupTime.toISOString(),
          special_instructions: specialInstructions || null,
          payment_method: 'gcash',
          payment_status: 'awaiting_payment',
        };

        const { data: order, error } = await supabase
          .from('orders')
          .insert([orderData])
          .select()
          .single();

        if (error) throw error;

        // ✅ Each vendor gets their own payment object with individual timer
        payments.push({
          stallId: parseInt(stallId),
          stallName: data.stall.stall_name,
          stallNumber: data.stall.stall_number,
          gcashQrUrl: data.stall.gcash_qr_url || null,
          gcashNumber: data.stall.gcash_number || '0917 123 4567',
          total: subtotal,
          orderId: order.id,
          referenceNumber: '',
          receiptUri: null,
          receiptUrl: null,
          isPaid: false,
          isSubmitted: false,
          isProcessing: false,
          isExpired: false,
          timeRemaining: 600, // ✅ 10 minutes per vendor
        });
      }

      clearCart();
      setGcashPayments(payments);
      setCurrentVendorIndex(0);
      setAllPaymentsCompleted(false);

      // ✅ Open GCash modal with first vendor
      setGcashModalVisible(true);
      
      // ✅ Start timer for first vendor
      startTimerForVendor(0);

    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const groupedOrders = groupByStall();
  const currentPayment = gcashPayments[currentVendorIndex];
  const totalVendors = gcashPayments.length;
  
  // ✅ Count remaining vendors to pay
  const remainingVendors = gcashPayments.filter(p => !p.isPaid && !p.isExpired).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text.dark} />
        <Text style={styles.backText}>Back to Cart</Text>
      </TouchableOpacity>

      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        {Object.entries(groupedOrders).length === 0 ? (
          <Text style={styles.emptyOrderText}>No items in order</Text>
        ) : (
          Object.entries(groupedOrders).map(([stallId, data]) => (
            <View key={stallId} style={styles.stallSection}>
              <View style={styles.stallHeader}>
                <Ionicons name="storefront" size={18} color={COLORS.primary} />
                <Text style={styles.stallName}>{data.stall?.stall_name || 'Market Stall'}</Text>
                <Text style={styles.stallNumber}>#{data.stall?.stall_number}</Text>
              </View>
              {data.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.quantity}x {item.name}</Text>
                  <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.stallTotal}>
                <Text style={styles.stallTotalLabel}>Stall Total</Text>
                <Text style={styles.stallTotalAmount}>₱{data.total.toFixed(2)}</Text>
              </View>
            </View>
          ))
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₱{cartTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* Pickup Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pickup Time</Text>
        <View style={styles.pickupRow}>
          <TouchableOpacity 
            style={styles.pickupButton} 
            onPress={() => setShowDatePicker(true)} 
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
            <Text style={styles.pickupText}>{formatDate(pickupTime)}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.pickupButton} 
            onPress={() => setShowTimePicker(true)} 
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            <Text style={styles.pickupText}>{formatTime(pickupTime)}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.pickupNote}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.pickupNoteText}>Please arrive within 15 minutes of your selected time</Text>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker value={pickupTime} mode="date" display="default" minimumDate={new Date()} onChange={onDateChange} />
      )}
      {showTimePicker && (
        <DateTimePicker value={pickupTime} mode="time" display="default" onChange={onTimeChange} />
      )}

      {/* Payment Method - GCash Only */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <Text style={styles.sectionSubtitle}>Pay securely using GCash</Text>
        
        <View style={styles.gcashPaymentCard}>
          <View style={styles.gcashPaymentRow}>
            <View style={styles.gcashPaymentLeft}>
              <View style={styles.gcashIconContainer}>
                <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.gcashPaymentInfo}>
                <Text style={styles.gcashPaymentName}>GCash</Text>
                <Text style={styles.gcashPaymentDesc}>Pay securely using GCash</Text>
              </View>
            </View>
            <View style={styles.gcashPaymentCheck}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
            </View>
          </View>
          <View style={styles.gcashPaymentFooter}>
            <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.text.light} />
            <Text style={styles.gcashPaymentFooterText}>Secured by GCash</Text>
          </View>
        </View>
        
        {Object.keys(groupedOrders).length > 1 && (
          <View style={styles.vendorCountInfo}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.text.light} />
            <Text style={styles.vendorCountText}>
              You are ordering from {Object.keys(groupedOrders).length} vendors. You will need to pay each vendor separately via GCash.
            </Text>
          </View>
        )}
      </View>

      {/* Special Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Special Instructions</Text>
        <TextInput
          style={styles.instructionsInput}
          placeholder="e.g., Please pack items carefully"
          placeholderTextColor={COLORS.text.lighter}
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Place Order Button */}
      <TouchableOpacity 
        style={styles.placeOrderButton} 
        onPress={placeOrder} 
        disabled={loading} 
        activeOpacity={0.8}
      >
        <LinearGradient 
          colors={[COLORS.primary, COLORS.primaryLight]} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 0 }} 
          style={styles.placeOrderGradient}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
              <Text style={styles.placeOrderText}>
                Place Order & Pay via GCash
                {Object.keys(groupedOrders).length > 1 && ` (${Object.keys(groupedOrders).length} vendors)`}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
        <Text style={styles.infoText}>
          After placing your order, you will have 10 minutes to complete your GCash payment{Object.keys(groupedOrders).length > 1 ? 's' : ''}. 
          {Object.keys(groupedOrders).length > 1 && ' Each vendor must be paid separately.'}
        </Text>
      </View>

      {/* ============================================================
          GCASH PAYMENT MODAL - Per Vendor with Individual Timers
      ============================================================ */}
      <Modal 
        visible={gcashModalVisible} 
        animationType="slide" 
        transparent={true} 
        onRequestClose={handleGcashModalClose}
      >
        <View style={styles.gcashModalOverlay}>
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.gcashModalCloseButton} 
            onPress={handleGcashModalClose}
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
              {/* Progress Indicator - Shows which vendor and remaining */}
              {totalVendors > 1 && (
                <View style={styles.gcashProgressContainer}>
                  <Text style={styles.gcashProgressText}>
                    Vendor {currentVendorIndex + 1} of {totalVendors}
                    {remainingVendors > 1 && ` • ${remainingVendors} remaining`}
                  </Text>
                  <View style={styles.gcashProgressBar}>
                    <View style={[styles.gcashProgressFill, { 
                      width: `${((currentVendorIndex + 1) / totalVendors) * 100}%` 
                    }]} />
                  </View>
                </View>
              )}
              
              <View style={styles.gcashModalHeader}>
                <View style={styles.gcashModalHeaderIcon}>
                  <Ionicons name="wallet" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.gcashModalTitle}>GCash Payment</Text>
                {totalVendors > 1 ? (
                  <Text style={styles.gcashModalSubtitle}>Pay {currentPayment?.stallName}</Text>
                ) : (
                  <Text style={styles.gcashModalSubtitle}>Complete your payment within 10 minutes</Text>
                )}
              </View>

              {/* ✅ Individual Timer for Current Vendor */}
              {currentPayment && (
                <View style={[
                  styles.gcashTimerSection, 
                  currentPayment.timeRemaining <= 60 && styles.gcashTimerUrgentBg
                ]}>
                  <Ionicons 
                    name={currentPayment.timeRemaining <= 60 ? "time" : "hourglass-outline"} 
                    size={22} 
                    color={currentPayment.timeRemaining <= 60 ? '#EF4444' : COLORS.primary} 
                  />
                  <Text style={styles.gcashTimerLabel}>Time Remaining</Text>
                  <Text style={[
                    styles.gcashTimerValue,
                    currentPayment.timeRemaining <= 60 && styles.gcashTimerValueUrgent
                  ]}>
                    {formatCountdown(currentPayment.timeRemaining || 0)}
                  </Text>
                </View>
              )}

              {/* Vendor QR Code */}
              {currentPayment && !currentPayment.isExpired && (
                <View style={styles.gcashQRContainer}>
                  <Text style={styles.gcashQRTitle}>Scan to Pay</Text>
                  <View style={styles.gcashQRBox}>
                    {currentPayment.gcashQrUrl ? (
                      <Image source={{ uri: currentPayment.gcashQrUrl }} style={styles.gcashQRImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.gcashQRPlaceholder}>
                        <Ionicons name="qr-code-outline" size={72} color={COLORS.gcash} />
                        <Text style={styles.gcashQRPlaceholderText}>Vendor QR Code</Text>
                        <Text style={styles.gcashQRPlaceholderSubtext}>GCash: {currentPayment.gcashNumber}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.gcashQRVendor}>{currentPayment.stallName}</Text>
                  <Text style={styles.gcashQRPrice}>Amount: ₱{currentPayment.total.toFixed(2)}</Text>
                  <Text style={styles.gcashQRHint}>Open GCash, scan QR, send exact amount</Text>
                </View>
              )}

              {/* Reference Number Input */}
              {currentPayment && !currentPayment.isPaid && !currentPayment.isExpired && (
                <View style={styles.gcashInputSection}>
                  <Text style={styles.gcashInputLabel}>
                    <Ionicons name="document-text-outline" size={16} color={COLORS.text.dark} /> Reference Number
                  </Text>
                  <TextInput
                    style={styles.gcashInput}
                    placeholder="Enter GCash reference number"
                    placeholderTextColor={COLORS.text.lighter}
                    value={currentPayment.referenceNumber || ''}
                    onChangeText={(text) => {
                      setGcashPayments(prev => {
                        const updated = [...prev];
                        updated[currentVendorIndex].referenceNumber = text;
                        return updated;
                      });
                    }}
                    keyboardType="numeric"
                    maxLength={20}
                  />
                </View>
              )}

              {/* Receipt Upload */}
              {currentPayment && !currentPayment.isPaid && !currentPayment.isExpired && (
                <View style={styles.gcashReceiptSection}>
                  <Text style={styles.gcashInputLabel}>
                    <Ionicons name="camera-outline" size={16} color={COLORS.text.dark} /> Payment Receipt
                  </Text>
                  <TouchableOpacity 
                    style={styles.gcashReceiptButton} 
                    onPress={() => pickGcashReceipt(currentVendorIndex)} 
                    disabled={gcashReceiptUploading} 
                    activeOpacity={0.7}
                  >
                    {currentPayment.receiptUri ? (
                      <View style={styles.gcashReceiptPreviewContainer}>
                        <Image source={{ uri: currentPayment.receiptUri }} style={styles.gcashReceiptPreview} />
                        <Text style={styles.gcashReceiptChangeText}>
                          <Ionicons name="refresh-outline" size={14} /> Tap to change
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.gcashReceiptPlaceholder}>
                        <Ionicons name="cloud-upload-outline" size={36} color={COLORS.gcash} />
                        <Text style={styles.gcashReceiptText}>
                          {gcashReceiptUploading ? 'Uploading...' : 'Upload Receipt'}
                        </Text>
                        <Text style={styles.gcashReceiptHint}>Tap to select from gallery</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Expired State */}
              {currentPayment && currentPayment.isExpired && (
                <View style={styles.gcashExpiredContainer}>
                  <Ionicons name="close-circle" size={48} color="#EF4444" />
                  <Text style={styles.gcashExpiredTitle}>Payment Expired</Text>
                  <Text style={styles.gcashExpiredText}>
                    Your payment window for {currentPayment.stallName} has expired.
                    This order has been cancelled.
                  </Text>
                </View>
              )}

              {/* Submit Button */}
              {currentPayment && !currentPayment.isPaid && !currentPayment.isExpired && (
                <TouchableOpacity
                  style={[
                    styles.gcashSubmitButton,
                    (currentPayment.isProcessing) && styles.gcashSubmitButtonDisabled
                  ]}
                  onPress={() => handleSubmitPayment(currentVendorIndex)}
                  disabled={currentPayment.isProcessing}
                  activeOpacity={0.8}
                >
                  <LinearGradient 
                    colors={[COLORS.gcash, '#005BB5']} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 0 }} 
                    style={styles.gcashSubmitGradient}
                  >
                    {currentPayment.isProcessing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : currentPayment.isPaid ? (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.gcashSubmitText}>Payment Completed</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.gcashSubmitText}>
                          {totalVendors > 1 ? `Pay ${currentPayment.stallName}` : 'Confirm Payment'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Vendor Completed State */}
              {currentPayment && currentPayment.isPaid && (
                <View style={styles.gcashCompletedContainer}>
                  <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                  <Text style={styles.gcashCompletedText}>✅ Payment Completed</Text>
                  <Text style={styles.gcashCompletedSubtext}>
                    {currentPayment.stallName} has been paid
                  </Text>
                </View>
              )}

              {/* Skip to next vendor */}
              {totalVendors > 1 && currentPayment && !currentPayment.isPaid && !currentPayment.isExpired && (
                <TouchableOpacity 
                  style={styles.gcashSkipButton} 
                  onPress={() => skipToNextVendor(currentVendorIndex)} 
                  activeOpacity={0.7}
                >
                  <Text style={styles.gcashSkipText}>Skip to next vendor →</Text>
                </TouchableOpacity>
              )}

              {/* Payment Progress Summary */}
              {totalVendors > 1 && (
                <View style={styles.gcashStatusSummary}>
                  <Text style={styles.gcashStatusSummaryTitle}>Payment Progress</Text>
                  {gcashPayments.map((p, idx) => (
                    <View key={idx} style={styles.gcashStatusItem}>
                      <View style={styles.gcashStatusItemLeft}>
                        <Ionicons 
                          name={
                            p.isPaid ? "checkmark-circle" : 
                            p.isExpired ? "close-circle" : 
                            "ellipse-outline"
                          } 
                          size={16} 
                          color={
                            p.isPaid ? COLORS.success : 
                            p.isExpired ? '#EF4444' : 
                            COLORS.text.light
                          } 
                        />
                        <Text style={[
                          styles.gcashStatusItemName,
                          p.isPaid && styles.gcashStatusItemPaid,
                          p.isExpired && styles.gcashStatusItemExpired
                        ]} numberOfLines={1}>
                          {p.stallName}
                        </Text>
                      </View>
                      <Text style={styles.gcashStatusItemAmount}>
                        ₱{p.total.toFixed(2)}
                        {p.isPaid && ' ✅'}
                        {p.isExpired && ' ❌'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.background,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: COLORS.text.medium,
    marginLeft: 8,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.dark,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.text.light,
    marginBottom: 12,
  },
  emptyOrderText: {
    textAlign: 'center',
    color: COLORS.text.light,
    paddingVertical: 20,
  },
  stallSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  stallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stallName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.dark,
    flex: 1,
    marginLeft: 6,
  },
  stallNumber: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemName: {
    fontSize: 14,
    color: COLORS.text.medium,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  stallTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  stallTotalLabel: {
    fontSize: 13,
    color: COLORS.text.light,
  },
  stallTotalAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  pickupRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 8,
  },
  pickupText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.dark,
  },
  pickupNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: COLORS.primarySurface,
    padding: 10,
    borderRadius: RADIUS.sm,
  },
  pickupNoteText: {
    fontSize: 12,
    color: COLORS.primary,
    flex: 1,
  },
  gcashPaymentCard: {
    backgroundColor: COLORS.gcashLight,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.gcash,
    padding: 16,
  },
  gcashPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gcashPaymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  gcashIconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gcash,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gcashPaymentInfo: {
    flex: 1,
  },
  gcashPaymentName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  gcashPaymentDesc: {
    fontSize: 12,
    color: COLORS.text.light,
  },
  gcashPaymentCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gcashPaymentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,125,254,0.15)',
  },
  gcashPaymentFooterText: {
    fontSize: 11,
    color: COLORS.text.light,
  },
  vendorCountInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.sm,
  },
  vendorCountText: {
    fontSize: 12,
    color: COLORS.text.medium,
    flex: 1,
    lineHeight: 18,
  },
  instructionsInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 14,
    color: COLORS.text.dark,
    minHeight: 70,
    backgroundColor: COLORS.background,
    textAlignVertical: 'top',
  },
  placeOrderButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  placeOrderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  placeOrderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.primarySurface,
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.text.medium,
    flex: 1,
    lineHeight: 18,
  },

  // GCash Modal Styles
  gcashModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
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
    paddingVertical: SPACING.sm,
  },
  gcashModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    width: '100%',
    maxWidth: 420,
    padding: SPACING.xl,
    marginTop: Platform.OS === 'ios' ? 30 : 10,
  },
  gcashProgressContainer: {
    marginBottom: SPACING.md,
  },
  gcashProgressText: {
    fontSize: 12,
    color: COLORS.text.light,
    textAlign: 'center',
    marginBottom: 4,
  },
  gcashProgressBar: {
    height: 4,
    backgroundColor: COLORS.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  gcashProgressFill: {
    height: '100%',
    backgroundColor: COLORS.gcash,
    borderRadius: 2,
  },
  gcashModalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  gcashModalHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.gcash,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
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
    gap: SPACING.sm,
    backgroundColor: COLORS.gcashLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
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
    marginBottom: SPACING.md,
  },
  gcashQRTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: SPACING.sm,
  },
  gcashQRBox: {
    width: 160,
    height: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
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
    marginTop: SPACING.sm,
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
    marginBottom: SPACING.md,
  },
  gcashInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: SPACING.sm,
  },
  gcashInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.text.dark,
    backgroundColor: COLORS.background,
  },
  gcashReceiptSection: {
    marginBottom: SPACING.md,
  },
  gcashReceiptButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.background,
  },
  gcashReceiptPlaceholder: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gcashReceiptText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gcash,
    marginTop: SPACING.sm,
  },
  gcashReceiptHint: {
    fontSize: 11,
    color: COLORS.text.light,
    marginTop: 2,
  },
  gcashReceiptPreviewContainer: {
    alignItems: 'center',
    padding: SPACING.sm,
  },
  gcashReceiptPreview: {
    width: '100%',
    height: 100,
    borderRadius: RADIUS.sm,
    resizeMode: 'cover',
  },
  gcashReceiptChangeText: {
    fontSize: 11,
    color: COLORS.gcash,
    marginTop: SPACING.sm,
    fontWeight: '500',
  },
  gcashSubmitButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  gcashSubmitButtonDisabled: {
    opacity: 0.6,
  },
  gcashSubmitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
  },
  gcashSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  gcashSkipButton: {
    marginTop: SPACING.md,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  gcashSkipText: {
    fontSize: 13,
    color: COLORS.text.light,
  },
  gcashStatusSummary: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  gcashStatusSummaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: SPACING.sm,
  },
  gcashStatusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  gcashStatusItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  gcashStatusItemName: {
    fontSize: 12,
    color: COLORS.text.medium,
    flex: 1,
  },
  gcashStatusItemPaid: {
    color: COLORS.success,
    fontWeight: '500',
  },
  gcashStatusItemExpired: {
    color: '#EF4444',
    fontWeight: '500',
  },
  gcashStatusItemAmount: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.dark,
  },
  gcashExpiredContainer: {
    alignItems: 'center',
    padding: 20,
    marginVertical: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: RADIUS.md,
  },
  gcashExpiredTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 8,
  },
  gcashExpiredText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  gcashCompletedContainer: {
    alignItems: 'center',
    padding: 20,
    marginVertical: 10,
    backgroundColor: '#D1FAE5',
    borderRadius: RADIUS.md,
  },
  gcashCompletedText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.success,
    marginTop: 8,
  },
  gcashCompletedSubtext: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
});