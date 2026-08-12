// src/screens/customer/CheckoutScreen.js

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  Dimensions,
  Image,
  StatusBar,
  Platform,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../hooks/useCart';
import StallMap from '../../components/StallMap';

const { width, height } = Dimensions.get('window');

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
  shadow: 'rgba(0, 0, 0, 0.04)',
  shadowDark: 'rgba(0, 0, 0, 0.08)',
  gcash: '#007DFE',
  gcashLight: '#E8F4FF',
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

export default function CheckoutScreen({ navigation, route }) {
  const { user } = useAuth();
  const { cart: hookCart, cartTotal: hookTotal, clearCart } = useCart();
  
  const cart = route.params?.cart || hookCart;
  const cartTotal = route.params?.cartTotal || hookTotal;
  
  const [loading, setLoading] = useState(false);
  const [pickupTime, setPickupTime] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedStall, setSelectedStall] = useState(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  
  const [gcashModalVisible, setGcashModalVisible] = useState(false);
  const [gcashPayments, setGcashPayments] = useState([]);
  const [gcashOrderIds, setGcashOrderIds] = useState([]);
  const [gcashSubmitting, setGcashSubmitting] = useState(false);
  const [gcashReceiptUploading, setGcashReceiptUploading] = useState(false);
  const [gcashCountdown, setGcashCountdown] = useState(600);
  const [currentStallIndex, setCurrentStallIndex] = useState(0);
  const [allPaymentsCompleted, setAllPaymentsCompleted] = useState(false);
  const gcashTimerRef = useRef(null);

  // Check cart
  useEffect(() => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to checkout');
      navigation.goBack();
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart first');
      navigation.goBack();
      return;
    }
  }, [user, cart, navigation]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (gcashTimerRef.current) {
        clearInterval(gcashTimerRef.current);
      }
    };
  }, []);

  // Handle back navigation safely
  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Cart');
    }
  };

 // Handle GCash modal close - Stay on Checkout, order remains pending
const handleGcashModalClose = () => {
  Alert.alert(
    'Payment Pending',
    'Your order has been placed but payment is not yet complete. You can complete the payment now or view your order later in the Orders screen.',
    [
      { 
        text: 'Continue Payment', 
        style: 'cancel',
        onPress: () => {
          // Stay on checkout, keep modal open
          // Do nothing, just close the alert
        }
      },
      { 
        text: 'Leave Payment', 
        style: 'default',
        onPress: () => {
          if (gcashTimerRef.current) {
            clearInterval(gcashTimerRef.current);
          }
          setGcashModalVisible(false);
          // Stay on Checkout screen, don't navigate anywhere
          // The user can see the order summary and try again later
        }
      }
    ]
  );
};

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
    if (!stall) return;
    const coords = getStallCoordinates(stall.section, stall.stall_number);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}&travelmode=walking`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps');
    });
  };

  const showStallMap = (stall) => {
    setSelectedStall(stall);
    setMapModalVisible(true);
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

  const placeOrder = async () => {
    setLoading(true);
    try {
      const groupedOrders = groupByStall();
      const ordersPlaced = [];
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
        ordersPlaced.push(order);
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
        });
      }
      clearCart();
      setGcashOrderIds(ordersPlaced.map(o => o.id));
      setGcashPayments(payments);
      setCurrentStallIndex(0);
      setAllPaymentsCompleted(false);
      setGcashModalVisible(true);
      setGcashCountdown(600);
      if (gcashTimerRef.current) clearInterval(gcashTimerRef.current);
      gcashTimerRef.current = setInterval(() => {
        setGcashCountdown(prev => {
          if (prev <= 1) {
            clearInterval(gcashTimerRef.current);
            handleGcashTimeout(ordersPlaced.map(o => o.id));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGcashTimeout = async (orderIds) => {
    if (!orderIds || orderIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled', payment_status: 'expired' })
        .in('id', orderIds);
      if (error) console.error('Error cancelling expired orders:', error);
      setGcashModalVisible(false);
      Alert.alert(
        '⏰ Payment Time Expired',
        'Your payment window of 10 minutes has expired. Your order has been cancelled. Please place a new order if you still want to proceed.',
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
    } catch (error) {
      console.error('GCash timeout error:', error);
    }
  };

  const pickGcashReceipt = async (index) => {
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
        const updatedPayments = [...gcashPayments];
        updatedPayments[index].receiptUri = result.assets[0].uri;
        setGcashPayments(updatedPayments);
      }
    } catch (error) {
      console.error('Error picking receipt:', error);
      Alert.alert('Error', 'Failed to select receipt image.');
    }
  };

  const uploadGcashReceipt = async (uri, stallId) => {
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
  const updatedPayments = [...gcashPayments];
  updatedPayments[index].isProcessing = true;
  setGcashPayments(updatedPayments);
  try {
    const receiptUrl = await uploadGcashReceipt(payment.receiptUri, payment.stallId);
    if (!receiptUrl) {
      updatedPayments[index].isProcessing = false;
      setGcashPayments(updatedPayments);
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
    updatedPayments[index].isPaid = true;
    updatedPayments[index].isSubmitted = true;
    updatedPayments[index].isProcessing = false;
    updatedPayments[index].receiptUrl = receiptUrl;
    setGcashPayments(updatedPayments);
    
    const allPaid = updatedPayments.every(p => p.isPaid);
    if (allPaid) {
      setAllPaymentsCompleted(true);
      if (gcashTimerRef.current) clearInterval(gcashTimerRef.current);
      setTimeout(() => {
        setGcashModalVisible(false);
        Alert.alert(
          '✅ All Payments Submitted! 🎉',
          'Your GCash payments have been submitted successfully. The vendors will verify your payments and confirm your orders.',
          [
            { 
              text: 'View Orders', 
              onPress: () => navigation.navigate('Orders')
            },
            { 
              text: 'Continue Shopping', 
              onPress: () => navigation.navigate('Home')
            }
          ]
        );
      }, 1500);
    } else {
      const nextIndex = index + 1;
      setCurrentStallIndex(nextIndex);
      Alert.alert(
        '✅ Payment Submitted!',
        `Payment for ${payment.stallName} confirmed. Please proceed to pay the next vendor.`,
        [{ text: 'Continue' }]
      );
    }
  } catch (error) {
    console.error('Error submitting payment:', error);
    Alert.alert('Error', 'Failed to submit payment. Please try again.');
    updatedPayments[index].isProcessing = false;
    setGcashPayments(updatedPayments);
  }
};

  const skipToNextVendor = (index) => {
    const nextIndex = index + 1;
    if (nextIndex < gcashPayments.length) {
      setCurrentStallIndex(nextIndex);
    }
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

  const groupedOrders = groupByStall();
  const currentPayment = gcashPayments[currentStallIndex];
  const totalVendors = gcashPayments.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={28} color={COLORS.text.dark} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Text style={styles.headerSubtitle}>{cart.length} items • {Object.keys(groupedOrders).length} stall(s)</Text>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <Text style={styles.sectionCount}>{Object.keys(groupedOrders).length} stall(s)</Text>
          </View>
          
          {Object.entries(groupedOrders).length === 0 ? (
            <Text style={styles.emptyOrderText}>No items in order</Text>
          ) : (
            Object.entries(groupedOrders).map(([stallId, data]) => {
              return (
                <View key={stallId} style={styles.stallSection}>
                  <View style={styles.stallHeader}>
                    <View style={styles.stallHeaderLeft}>
                      <Ionicons name="storefront" size={18} color={COLORS.primary} />
                      <Text style={styles.stallName} numberOfLines={1}>{data.stall?.stall_name || 'Market Stall'}</Text>
                    </View>
                    <Text style={styles.stallNumber}>#{data.stall?.stall_number}</Text>
                  </View>
                  <Text style={styles.stallSectionText}>{data.stall?.section}</Text>
                  
                  <View style={styles.productsList}>
                    {data.items.map((item, index) => (
                      <View key={index} style={styles.orderItem}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.itemRight}>
                          <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                          <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  
                  <View style={styles.stallSubtotal}>
                    <Text style={styles.stallSubtotalLabel}>Stall Total</Text>
                    <Text style={styles.stallSubtotalAmount}>₱{data.total.toFixed(2)}</Text>
                  </View>
                  
                  <View style={styles.mapButtonsRow}>
                    <TouchableOpacity 
                      style={styles.mapButton} 
                      onPress={() => showStallMap(data.stall)} 
                      activeOpacity={0.7}
                    >
                      <Ionicons name="map-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.mapButtonText}>View Map</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.directionsButton} 
                      onPress={() => openMapsDirections(data.stall)} 
                      activeOpacity={0.7}
                    >
                      <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.mapButtonText}>Directions</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
          
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalSubtext}>all stalls combined</Text>
            </View>
            <Text style={styles.totalAmount}>₱{cartTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Pickup Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Time</Text>
          <Text style={styles.sectionSubtitle}>When will you pick up your order?</Text>
          
          <View style={styles.pickupRow}>
            <TouchableOpacity 
              style={styles.pickupCard} 
              onPress={() => setShowDatePicker(true)} 
              activeOpacity={0.7}
            >
              <View style={styles.pickupIconContainer}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.pickupInfo}>
                <Text style={styles.pickupLabel}>Date</Text>
                <Text style={styles.pickupDateTime}>{formatDate(pickupTime)}</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.pickupCard} 
              onPress={() => setShowTimePicker(true)} 
              activeOpacity={0.7}
            >
              <View style={styles.pickupIconContainer}>
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.pickupInfo}>
                <Text style={styles.pickupLabel}>Time</Text>
                <Text style={styles.pickupDateTime}>{formatTime(pickupTime)}</Text>
              </View>
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

        {/* Payment Method */}
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
          <Text style={styles.sectionSubtitle}>Any notes for the vendor?</Text>
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

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>
            After placing your order, you will have 10 minutes to complete your GCash payment{Object.keys(groupedOrders).length > 1 ? 's' : ''}. 
            {Object.keys(groupedOrders).length > 1 && ' Each vendor must be paid separately.'}
          </Text>
        </View>

        {/* Map Modal */}
        <Modal visible={mapModalVisible} animationType="slide" transparent={false} onRequestClose={() => setMapModalVisible(false)}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setMapModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedStall?.stall_name || 'Stall Location'}</Text>
              <Text style={styles.modalSubtitle}>Stall #{selectedStall?.stall_number} • {selectedStall?.section}</Text>
            </View>
            {selectedStall && (
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
                onPress={() => { setMapModalVisible(false); if (selectedStall) openMapsDirections(selectedStall); }} 
                activeOpacity={0.8}
              >
                <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.modalDirectionsGradient}>
                  <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.modalDirectionsText}>Get Directions</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>

        {/* GCash Payment Modal - WITH CLOSE BUTTON ONLY */}
        <Modal 
          visible={gcashModalVisible} 
          animationType="slide" 
          transparent={true} 
          onRequestClose={handleGcashModalClose}
        >
          <View style={styles.gcashModalOverlay}>
            {/* Close Button - X at top right */}
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
                {totalVendors > 1 && (
                  <View style={styles.gcashProgressContainer}>
                    <Text style={styles.gcashProgressText}>Vendor {currentStallIndex + 1} of {totalVendors}</Text>
                    <View style={styles.gcashProgressBar}>
                      <View style={[styles.gcashProgressFill, { width: `${((currentStallIndex + 1) / totalVendors) * 100}%` }]} />
                    </View>
                  </View>
                )}
                
                <View style={styles.gcashModalHeader}>
                  <View style={styles.gcashModalHeaderIcon}>
                    <Ionicons name="wallet" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={styles.gcashModalTitle}>GCash Payment</Text>
                  {totalVendors > 1 ? (
                    <Text style={styles.gcashModalSubtitle}>Pay {currentPayment?.stallName || 'Vendor'}</Text>
                  ) : (
                    <Text style={styles.gcashModalSubtitle}>Complete your payment within 10 minutes</Text>
                  )}
                </View>

                <View style={[styles.gcashTimerSection, gcashCountdown <= 60 && styles.gcashTimerUrgentBg]}>
                  <Ionicons name={gcashCountdown <= 60 ? "time" : "hourglass-outline"} size={22} color={gcashCountdown <= 60 ? '#EF4444' : COLORS.primary} />
                  <Text style={styles.gcashTimerLabel}>Time Remaining</Text>
                  <Text style={[styles.gcashTimerValue, gcashCountdown <= 60 && styles.gcashTimerValueUrgent]}>
                    {formatCountdown(gcashCountdown)}
                  </Text>
                </View>

                {currentPayment && (
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

                {currentPayment && (
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
                        const updatedPayments = [...gcashPayments];
                        updatedPayments[currentStallIndex].referenceNumber = text;
                        setGcashPayments(updatedPayments);
                      }}
                      keyboardType="numeric"
                      maxLength={20}
                    />
                  </View>
                )}

                {currentPayment && (
                  <View style={styles.gcashReceiptSection}>
                    <Text style={styles.gcashInputLabel}>
                      <Ionicons name="camera-outline" size={16} color={COLORS.text.dark} /> Payment Receipt
                    </Text>
                    <TouchableOpacity style={styles.gcashReceiptButton} onPress={() => pickGcashReceipt(currentStallIndex)} disabled={gcashReceiptUploading} activeOpacity={0.7}>
                      {currentPayment.receiptUri ? (
                        <View style={styles.gcashReceiptPreviewContainer}>
                          <Image source={{ uri: currentPayment.receiptUri }} style={styles.gcashReceiptPreview} />
                          <Text style={styles.gcashReceiptChangeText}><Ionicons name="refresh-outline" size={14} /> Tap to change</Text>
                        </View>
                      ) : (
                        <View style={styles.gcashReceiptPlaceholder}>
                          <Ionicons name="cloud-upload-outline" size={36} color={COLORS.gcash} />
                          <Text style={styles.gcashReceiptText}>{gcashReceiptUploading ? 'Uploading...' : 'Upload Receipt'}</Text>
                          <Text style={styles.gcashReceiptHint}>Tap to select from gallery</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {currentPayment && (
                  <TouchableOpacity
                    style={[styles.gcashSubmitButton, (currentPayment.isPaid || currentPayment.isProcessing) && styles.gcashSubmitButtonDisabled]}
                    onPress={() => handleSubmitPayment(currentStallIndex)}
                    disabled={currentPayment.isPaid || currentPayment.isProcessing}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={[COLORS.gcash, '#005BB5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gcashSubmitGradient}>
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

                {totalVendors > 1 && currentPayment && !currentPayment.isPaid && (
                  <TouchableOpacity style={styles.gcashSkipButton} onPress={() => skipToNextVendor(currentStallIndex)} activeOpacity={0.7}>
                    <Text style={styles.gcashSkipText}>Skip to next vendor →</Text>
                  </TouchableOpacity>
                )}

                {totalVendors > 1 && (
                  <View style={styles.gcashStatusSummary}>
                    <Text style={styles.gcashStatusSummaryTitle}>Payment Progress</Text>
                    {gcashPayments.map((p, idx) => (
                      <View key={idx} style={styles.gcashStatusItem}>
                        <View style={styles.gcashStatusItemLeft}>
                          <Ionicons name={p.isPaid ? "checkmark-circle" : "ellipse-outline"} size={16} color={p.isPaid ? COLORS.success : COLORS.text.light} />
                          <Text style={[styles.gcashStatusItemName, p.isPaid && styles.gcashStatusItemPaid]} numberOfLines={1}>{p.stallName}</Text>
                        </View>
                        <Text style={styles.gcashStatusItemAmount}>₱{p.total.toFixed(2)}{p.isPaid && ' ✅'}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  
  // Header
  header: {
    backgroundColor: COLORS.surface,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  backText: {
    fontSize: 16,
    color: COLORS.text.medium,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.text.light,
    marginTop: 2,
  },

  // Sections
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.text.light,
    marginBottom: SPACING.md,
  },
  sectionCount: {
    fontSize: 13,
    color: COLORS.text.light,
  },
  emptyOrderText: {
    textAlign: 'center',
    color: COLORS.text.light,
    paddingVertical: SPACING.xl,
  },

  // Stall Section
  stallSection: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  stallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  stallHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  stallName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.dark,
    flex: 1,
  },
  stallNumber: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  stallSectionText: {
    fontSize: 12,
    color: COLORS.text.light,
    marginBottom: SPACING.sm,
    marginLeft: 24,
  },

  // Products
  productsList: {
    marginBottom: SPACING.sm,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  itemName: {
    fontSize: 14,
    color: COLORS.text.dark,
    flex: 1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  itemQuantity: {
    fontSize: 13,
    color: COLORS.text.light,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    width: 70,
    textAlign: 'right',
  },

  // Stall Subtotal
  stallSubtotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  stallSubtotalLabel: {
    fontSize: 13,
    color: COLORS.text.light,
  },
  stallSubtotalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Map Buttons
  mapButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  mapButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySurface,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  directionsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySurface,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  mapButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  totalSubtext: {
    fontSize: 11,
    color: COLORS.text.light,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Pickup Time
  pickupRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  pickupCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  pickupIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  pickupInfo: {
    flex: 1,
  },
  pickupLabel: {
    fontSize: 11,
    color: COLORS.text.light,
    marginBottom: 1,
  },
  pickupDateTime: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  pickupNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    backgroundColor: COLORS.primarySurface,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  pickupNoteText: {
    fontSize: 12,
    color: COLORS.primary,
    flex: 1,
  },

  // GCash Payment Card
  gcashPaymentCard: {
    backgroundColor: COLORS.gcashLight,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.gcash,
    padding: SPACING.lg,
    marginTop: SPACING.xs,
  },
  gcashPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gcashPaymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
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
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
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
    gap: SPACING.sm,
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.primarySurface,
    borderRadius: RADIUS.sm,
  },
  vendorCountText: {
    fontSize: 12,
    color: COLORS.text.medium,
    flex: 1,
    lineHeight: 18,
  },

  // Instructions
  instructionsInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 14,
    color: COLORS.text.dark,
    minHeight: 70,
    backgroundColor: COLORS.background,
  },

  // Place Order Button
  placeOrderButton: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  placeOrderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
  },
  placeOrderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.primarySurface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.xxxl,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.text.medium,
    flex: 1,
    lineHeight: 18,
  },

  // Map Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  modalCloseButton: {
    alignSelf: 'flex-start',
    padding: SPACING.xs,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  modalFooter: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  modalDirectionsButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  modalDirectionsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
  },
  modalDirectionsText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // GCash Modal
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
  gcashStatusItemAmount: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.dark,
  },
});