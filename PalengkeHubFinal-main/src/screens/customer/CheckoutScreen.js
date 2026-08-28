import { useColors, useTheme } from '../../contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import { hapticMedium, hapticSuccess } from '../../theme/motion';
// src/screens/customer/CheckoutScreen.js

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../hooks/useCart';
import { useI18n } from '../../contexts/i18nContext';
import StallMap from '../../components/StallMap';
import { normalizeReference, isValidGcashReference, scanReceipt, computeImageHash, validateReceiptScan } from '../../utils/receiptScanner';
import { SPACING, RADIUS } from '../../theme/tokens';

// Downscale an image (data URI or blob URI) to a compressed JPEG data URI using
// a canvas, so receipts stay small when stored directly on the order (fallback
// for when Supabase storage buckets are unavailable).
const imageToCompressedDataUri = (uri, maxDim = 900, quality = 0.6) => {
  try {
    if (typeof document === 'undefined') return Promise.resolve(uri);
    const img = document.createElement('img');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(uri);
    return new Promise((resolve) => {
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) {
            resolve(uri);
            return;
          }
          const scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.round(w * scale);
          h = Math.round(h * scale);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          resolve(uri);
        }
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    });
  } catch (e) {
    return Promise.resolve(uri);
  }
};

const { width, height } = Dimensions.get('window');

export default function CheckoutScreen({ navigation, route }) {
  const COLORS = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user } = useAuth();
  const { cart: hookCart, cartTotal: hookTotal, clearCart } = useCart();
  const { t } = useI18n();
  
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
  const [gcashReceiptUploading, setGcashReceiptUploading] = useState(false);
  const [gcashScanStatus, setGcashScanStatus] = useState(null);
  const [gcashScanError, setGcashScanError] = useState(null);
  const [gcashCountdown, setGcashCountdown] = useState(600);
  const [currentStallIndex, setCurrentStallIndex] = useState(0);
  const [allPaymentsCompleted, setAllPaymentsCompleted] = useState(false);
  const gcashTimerRef = useRef(null);

  // Guard against landing on Checkout with nothing to check out — checked
  // once, on arrival, not reactively. `cart` was in this effect's deps
  // before, so it re-fired the instant placeOrder()'s own clearCart()
  // emptied the cart on a SUCCESSFUL order: the customer got an "empty
  // cart" alert and got bounced straight back to Cart before ever seeing
  // the GCash payment modal, for every order — not just multi-vendor ones.
  useEffect(() => {
    if (!user) {
      Alert.alert(t('auth.login_required'), t('checkout.login_required_body'));
      navigation.goBack();
      return;
    }
    if (cart.length === 0) {
      Alert.alert(t('checkout.empty_cart_title'), t('checkout.empty_cart_body'));
      navigation.goBack();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    t('checkout.payment_pending_title'),
    t('checkout.payment_pending_body'),
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
      Alert.alert(t('common.error'), t('checkout.maps_error'));
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
    hapticMedium();
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
      Alert.alert(t('common.error'), t('checkout.place_order_error'));
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
        `⏰ ${t('checkout.payment_expired_title')}`,
        t('checkout.payment_expired_body'),
        [{ text: t('common.ok'), onPress: () => navigation.navigate('Home') }]
      );
    } catch (error) {
      console.error('GCash timeout error:', error);
    }
  };

  // Photograph the GCash receipt with the device camera (camera-first flow).
  const takeGcashReceiptFromCamera = async (index) => {
    try {
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          quality: 70,
          correctOrientation: true,
        });
        if (photo && photo.base64String) {
          const updatedPayments = [...gcashPayments];
          updatedPayments[index].receiptUri = `data:image/jpeg;base64,${photo.base64String}`;
          setGcashPayments(updatedPayments);
        }
        return;
      }
      // Web fallback: browser camera picker.
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('checkout.camera_permission_title'), t('checkout.camera_permission_body'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const updatedPayments = [...gcashPayments];
        updatedPayments[index].receiptUri = result.assets[0].uri;
        setGcashPayments(updatedPayments);
      }
    } catch (error) {
      console.error('Error taking receipt photo:', error);
      pickGcashReceipt(index);
    }
  };

  const pickGcashReceipt = async (index) => {
    try {
      // Native Android app (Capacitor): use the system gallery picker.
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Base64,
          source: CameraSource.Photos,
          quality: 70,
          correctOrientation: true,
        });
        if (photo && photo.base64String) {
          const updatedPayments = [...gcashPayments];
          updatedPayments[index].receiptUri = `data:image/jpeg;base64,${photo.base64String}`;
          setGcashPayments(updatedPayments);
        }
        return;
      }
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('checkout.gallery_permission_title'), t('checkout.gallery_permission_body'));
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
      Alert.alert(t('common.error'), t('checkout.receipt_select_error'));
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
      // Fallback: no storage buckets configured yet, so keep the compressed
      // receipt attached directly to the order.
      console.warn('Storage upload failed (bucket missing?), embedding receipt on the order instead:', error?.message || error);
      try {
        return await imageToCompressedDataUri(uri);
      } catch (e) {
        console.error('Error compressing receipt:', e);
        Alert.alert(t('checkout.upload_error_title'), t('checkout.upload_error_body'));
        return null;
      }
    } finally {
      setGcashReceiptUploading(false);
    }
  };

  // Submit payment — scans the receipt, cross-checks reference/amount/time,
  // checks for reuse, then submits for VENDOR verification (not auto-paid).
  const handleSubmitPayment = async (index) => {
  const payment = gcashPayments[index];
  const referenceDigits = normalizeReference(payment.referenceNumber);
  if (!isValidGcashReference(referenceDigits)) {
    Alert.alert(t('checkout.invalid_reference_title'), t('checkout.invalid_reference_body'));
    return;
  }
  if (!payment.receiptUri) {
    Alert.alert(t('checkout.missing_receipt_title'), t('checkout.missing_receipt_body'));
    return;
  }
  if (payment.isProcessing) return;
  const updatedPayments = [...gcashPayments];
  updatedPayments[index].isProcessing = true;
  setGcashPayments(updatedPayments);
  setGcashScanError(null);
 setGcashScanStatus(' Scanning receipt…');
  try {
    // 1) Scan the receipt with OCR — best effort. A failed or imperfect scan
    //    no longer blocks payment: vendors verify submissions manually anyway.
    let scan = null;
    let scanFailed = false;
    try {
      scan = await scanReceipt(payment.receiptUri);
    } catch (scanError) {
      console.error('Receipt scan failed:', scanError);
      scanFailed = true;
    }

    // 2) Reference / amount / timestamp cross-checks (when we have a scan)
    let softIssue = null;
    if (!scanFailed) {
      const oldestAllowed = new Date(Date.now() - 20 * 60 * 1000);
      const validation = validateReceiptScan({
        typedReference: referenceDigits,
        scan,
        expectedAmount: payment.total || 0,
        oldestAllowedTime: oldestAllowed,
      });

      if (!validation.refMatched) {
        const found = validation.clueReferences.length
          ? validation.clueReferences.join(', ')
          : validation.digitCandidates.length
            ? validation.digitCandidates.join(', ')
            : 'no number sequence found';
        const body = `We scanned your receipt and could not find the reference number you typed.\n\nYou typed: ${referenceDigits}\nFound on receipt: ${found}`;
        setGcashScanError(`Reference number not found on receipt. You typed: ${referenceDigits}. Found: ${found}`);
        softIssue = { title: 'Reference Number Not Found on Receipt', body };
      } else if (!validation.amountMatched) {
        const body = validation.amounts.length === 0
          ? `We could not find the total amount on your receipt (should be ₱${(payment.total || 0).toFixed(2)}).`
          : `The amount on your receipt (${validation.amounts.map((a) => `₱${a.toFixed(2)}`).join(', ')}) does not match this vendor's total (₱${(payment.total || 0).toFixed(2)}).`;
        setGcashScanError(body);
        softIssue = { title: 'Receipt Amount Problem', body };
      } else if (!validation.timeOk) {
        const body = validation.timeProblem === 'future'
          ? 'The date/time on this receipt is in the future. Please upload the correct receipt.'
          : 'The date/time on this receipt is older than 20 minutes. Please upload the receipt for THIS payment.';
        setGcashScanError(body);
        softIssue = {
          title: validation.timeProblem === 'future' ? 'Invalid Receipt Date' : 'Old Receipt Detected',
          body,
        };
      }
    }

    // 3) Soft failures get a manual-verification escape hatch instead of a dead end
    if (scanFailed || softIssue) {
      const title = scanFailed ? 'Receipt Scan Unavailable' : softIssue.title;
      const body = scanFailed
        ? 'We could not read your receipt automatically. Please check your internet connection or retake a clearer photo.'
        : softIssue.body;

      const proceed = await new Promise((resolve) => {
        Alert.alert(
          title,
          `${body}\n\nVendors verify every payment manually — you can submit now and your vendor will confirm it.`,
          [
            { text: 'Fix It', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Submit Anyway', onPress: () => resolve(true) },
          ]
        );
      });
      if (!proceed) return;
    }

 setGcashScanStatus(' Checking for duplicates…');

    // 3) The same GCash reference cannot be used on another order.
    const { data: duplicateRef } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_reference', referenceDigits)
      .neq('id', payment.orderId)
      .maybeSingle();
    if (duplicateRef) {
      setGcashScanError(t('checkout.duplicate_reference_body'));
      Alert.alert(t('checkout.duplicate_reference_title'), t('checkout.duplicate_reference_body'));
      return;
    }

    // 4) The same receipt image cannot be reused on another order.
    const receiptHash = await computeImageHash(payment.receiptUri);
    if (receiptHash) {
      try {
        const { data: duplicateImage } = await supabase
          .from('orders')
          .select('id')
          .eq('receipt_image_hash', receiptHash)
          .neq('id', payment.orderId)
          .maybeSingle();
        if (duplicateImage) {
          setGcashScanError(t('checkout.duplicate_receipt_body'));
          Alert.alert(t('checkout.duplicate_receipt_title'), t('checkout.duplicate_receipt_body'));
          return;
        }
      } catch (hashCheckError) {
        console.warn('receipt_image_hash column may not exist yet:', hashCheckError);
      }
    }

 setGcashScanStatus(' Uploading receipt…');
    const receiptUrl = await uploadGcashReceipt(payment.receiptUri, payment.stallId);
    if (!receiptUrl) {
      setGcashScanError('Failed to upload your receipt. Please try again.');
      return;
    }
    // Submit for vendor verification — NOT marked as paid.
    const { error } = await supabase
      .from('orders')
      .update({
        payment_status: 'awaiting_verification',
        payment_reference: referenceDigits,
        payment_receipt_url: receiptUrl,
        payment_scan_text: (scan.text || '').slice(0, 1500) || null,
        payment_scan_matched: validation.refMatched,
        receipt_image_hash: receiptHash || null,
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
      hapticSuccess();
      if (gcashTimerRef.current) clearInterval(gcashTimerRef.current);
      setTimeout(() => {
        setGcashModalVisible(false);
        Alert.alert(
          t('checkout.all_payments_submitted_title'),
          t('checkout.all_payments_submitted_body'),
          [
            {
              text: t('checkout.view_orders'),
              onPress: () => navigation.replace('Orders')
            },
            {
              text: t('checkout.continue_shopping'),
              onPress: () => navigation.replace('Home')
            }
          ]
        );
      }, 1500);
    } else {
      const nextIndex = index + 1;
      setCurrentStallIndex(nextIndex);
      Alert.alert(
        t('checkout.payment_submitted'),
        t('checkout.payment_submitted_for_vendor').replace('{{stallName}}', payment.stallName),
        [{ text: t('common.continue') }]
      );
    }
  } catch (error) {
    console.error('Error submitting payment:', error);
    setGcashScanError(t('checkout.submit_payment_error'));
    Alert.alert(t('common.error'), t('checkout.submit_payment_error'));
  } finally {
    const resetPayments = [...gcashPayments];
    resetPayments[index].isProcessing = false;
    setGcashPayments(resetPayments);
    setGcashScanStatus(null);
  }
};

  const skipToNextVendor = (index) => {
    const nextIndex = index + 1;
    if (nextIndex < gcashPayments.length) {
      setCurrentStallIndex(nextIndex);
    }
  };

  // ── Pickup time validation: must be at least 15 min from now ──
  const validateAndSetPickup = (candidate) => {
    const minimum = new Date(Date.now() + 15 * 60 * 1000);
    if (candidate.getTime() < minimum.getTime()) {
      const bumped = new Date(Date.now() + 30 * 60 * 1000);
      setPickupTime(bumped);
      Alert.alert(
        t('checkout.pickup_adjusted_title'),
        t('checkout.pickup_adjusted_body')
      );
      return;
    }
    setPickupTime(candidate);
  };

  // Web fallbacks — @react-native-community/datetimepicker has no web support
  const handleWebDateChange = (dateStr) => {
    if (!dateStr) return;
    const [y, m, d] = dateStr.split('-').map(Number);
    const next = new Date(pickupTime);
    next.setFullYear(y, m - 1, d);
    validateAndSetPickup(next);
  };

  const handleWebTimeChange = (timeStr) => {
    if (!timeStr) return;
    const [h, min] = timeStr.split(':').map(Number);
    const next = new Date(pickupTime);
    next.setHours(h, min, 0, 0);
    validateAndSetPickup(next);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(pickupTime.getHours());
      newDate.setMinutes(pickupTime.getMinutes());
      validateAndSetPickup(newDate);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newTime = new Date(pickupTime);
      newTime.setHours(selectedTime.getHours());
      newTime.setMinutes(selectedTime.getMinutes());
      validateAndSetPickup(newTime);
    }
  };

  const groupedOrders = groupByStall();
  const currentPayment = gcashPayments[currentStallIndex];
  const totalVendors = gcashPayments.length;
  // Confirm Payment is enabled only when a valid 13-digit reference and a receipt are present
  const gcashReady = !!(currentPayment && isValidGcashReference(currentPayment.referenceNumber) && currentPayment.receiptUri);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.background} />
      
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

        {/* Checkout Progress: Review → Payment → Pickup */}
        <View style={styles.progressRow}>
          {['Review', 'Payment', 'Pickup'].map((label, idx) => {
            const done = idx === 0
              ? cart.length > 0
              : idx === 1 && allPaymentsCompleted;
            const active = idx === 0
              ? false
              : idx === 1 ? !allPaymentsCompleted : false;
            return (
              <React.Fragment key={label}>
                {idx > 0 && (
                  <View style={[styles.progressConnector, done && styles.progressConnectorDone]} />
                )}
                <View style={styles.progressStep}>
                  <View style={[
                    styles.progressDot,
                    done && styles.progressDotDone,
                    active && styles.progressDotActive,
                  ]}>
                    {done && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={[
                    styles.progressLabel,
                    (done || active) && styles.progressLabelActive,
                  ]}>
                    {label}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('checkout.order_summary')}</Text>
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
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={pickupTime.toISOString().slice(0, 10)}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => handleWebDateChange(e.target.value)}
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: COLORS.text.dark,
                      padding: 0,
                      cursor: 'pointer',
                      fontFamily: 'Nunito_600SemiBold',
                    }}
                  />
                ) : (
                  <Text style={styles.pickupDateTime}>{formatDate(pickupTime)}</Text>
                )}
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
                {Platform.OS === 'web' ? (
                  <input
                    type="time"
                    value={`${String(pickupTime.getHours()).padStart(2, '0')}:${String(pickupTime.getMinutes()).padStart(2, '0')}`}
                    onChange={(e) => handleWebTimeChange(e.target.value)}
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: COLORS.text.dark,
                      padding: 0,
                      cursor: 'pointer',
                      fontFamily: 'Nunito_600SemiBold',
                    }}
                  />
                ) : (
                  <Text style={styles.pickupDateTime}>{formatTime(pickupTime)}</Text>
                )}
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
          <Text style={styles.sectionTitle}>{t('checkout.payment_method')}</Text>
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
          <Text style={styles.sectionTitle}>{t('checkout.special_instructions')}</Text>
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
                  {t('checkout.place_order_gcash')}
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
          <View style={[styles.gcashModalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(15,23,42,0.35)' }]}>
            {/* Liquid Glass backdrop — real blur with translucent fallback */}
            <BlurView
              intensity={isDark ? 60 : 35}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
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
              <View
                style={[
                  styles.gcashModalContent,
                  {
                    backgroundColor: isDark
                      ? 'rgba(26, 26, 46, 0.88)'
                      : 'rgba(255, 255, 255, 0.9)',
                    borderWidth: 1,
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.14)'
                      : 'rgba(255, 255, 255, 0.7)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.15,
                    shadowRadius: 24,
                    elevation: 16,
                  },
                ]}
              >
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
                      placeholder="Enter 13-digit GCash reference number"
                      placeholderTextColor={COLORS.text.lighter}
                      value={currentPayment.referenceNumber || ''}
                      onChangeText={(text) => {
                        const updatedPayments = [...gcashPayments];
                        updatedPayments[currentStallIndex].referenceNumber = text;
                        setGcashPayments(updatedPayments);
                      }}
                      keyboardType="numeric"
                      maxLength={13}
                    />
                    <Text style={styles.gcashInputHint}>
                      GCash reference numbers are exactly 13 digits
                    </Text>
                  </View>
                )}

                {currentPayment && (
                  <View style={styles.gcashReceiptSection}>
                    <Text style={styles.gcashInputLabel}>
                      <Ionicons name="camera-outline" size={16} color={COLORS.text.dark} /> Payment Receipt
                    </Text>
                    <TouchableOpacity style={styles.gcashReceiptButton} onPress={() => takeGcashReceiptFromCamera(currentStallIndex)} disabled={gcashReceiptUploading} activeOpacity={0.7}>
                      {currentPayment.receiptUri ? (
                        <View style={styles.gcashReceiptPreviewContainer}>
                          <Image source={{ uri: currentPayment.receiptUri }} style={styles.gcashReceiptPreview} />
                          <Text style={styles.gcashReceiptChangeText}><Ionicons name="camera-outline" size={14} /> Tap to retake</Text>
                        </View>
                      ) : (
                        <View style={styles.gcashReceiptPlaceholder}>
                          <Ionicons name="camera-outline" size={36} color={COLORS.gcash} />
                          <Text style={styles.gcashReceiptText}>{gcashReceiptUploading ? 'Uploading...' : 'Take Photo of Receipt'}</Text>
                          <Text style={styles.gcashReceiptHint}>Photograph your GCash receipt now</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.gcashReceiptSecondaryButton}
                      onPress={() => pickGcashReceipt(currentStallIndex)}
                      disabled={gcashReceiptUploading}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="images-outline" size={16} color={COLORS.text.light} />
                      <Text style={styles.gcashReceiptSecondaryText}>Choose from gallery instead</Text>
                    </TouchableOpacity>
                    {gcashScanStatus && (
                      <View style={styles.gcashScanStatusRow}>
                        <ActivityIndicator size="small" color={COLORS.gcash} />
                        <Text style={styles.gcashScanStatusText}>{gcashScanStatus}</Text>
                      </View>
                    )}
                    {gcashScanError && (
                      <View style={styles.gcashScanErrorRow}>
                        <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                        <Text style={styles.gcashScanErrorText}>{gcashScanError}</Text>
                      </View>
                    )}
                  </View>
                )}

                {currentPayment && (
                  <TouchableOpacity
                    style={[styles.gcashSubmitButton, (currentPayment.isPaid || currentPayment.isProcessing || !gcashReady) && styles.gcashSubmitButtonDisabled]}
                    onPress={() => handleSubmitPayment(currentStallIndex)}
                    disabled={currentPayment.isPaid || currentPayment.isProcessing || !gcashReady}
                    activeOpacity={0.8}
                  >
                    <LinearGradient colors={[COLORS.gcash, '#005BB5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gcashSubmitGradient}>
                      {currentPayment.isProcessing ? (
                        <>
                          <ActivityIndicator color="#FFFFFF" />
                          <Text style={styles.gcashSubmitText}>Verifying Payment…</Text>
                        </>
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
                        <Text style={styles.gcashStatusItemAmount}>₱{p.total.toFixed(2)}{p.isPaid && ' '}</Text>
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

const createStyles = (COLORS) => StyleSheet.create({
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

  // Checkout progress indicator
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    marginHorizontal: SPACING.lg,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  progressDotActive: {
    borderColor: COLORS.primary,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.text.lighter,
    marginTop: 4,
    fontWeight: '500',
  },
  progressLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  progressConnector: {
    width: 44,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
    marginBottom: 16,
  },
  progressConnectorDone: {
    backgroundColor: COLORS.primary,
  },

  // Sections
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    shadowColor: COLORS.shadowDark,
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
    flexShrink: 1,
    textAlign: 'center',
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.surface,
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
    backgroundColor: COLORS.errorLight,
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
    color: COLORS.error,
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
    backgroundColor: COLORS.surface,
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
  gcashInputHint: {
    fontSize: 11,
    color: COLORS.text.light,
    marginTop: 6,
  },
  gcashReceiptSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
  },
  gcashReceiptSecondaryText: {
    fontSize: 13,
    color: COLORS.text.light,
    fontWeight: '500',
  },
  gcashScanStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  gcashScanStatusText: {
    fontSize: 13,
    color: COLORS.text.medium,
    fontWeight: '500',
  },
  gcashScanErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.errorLight,
  },
  gcashScanErrorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.error,
    fontWeight: '600',
    lineHeight: 18,
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