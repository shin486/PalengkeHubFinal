// src/components/CheckoutContent.js

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { useAuth, SIGNED_URL_TTL_SECONDS } from '../contexts/AuthContext';
import { useCart } from '../hooks/useCart';
import { useColors } from '../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { normalizeReference, isValidGcashReference, scanReceipt, computeImageHash, validateReceiptScan } from '../utils/receiptScanner';
import { SPACING, RADIUS } from '../theme/tokens';

// Theme-aware colors are provided by ThemeContext via useColors().

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


// Matches the market's posted hours ("Open 5:00 AM to 7:00 PM") shown
// elsewhere in the app — a pickup slot outside this window means the
// stall isn't even open.
const MARKET_OPEN_HOUR = 5;
const MARKET_CLOSE_HOUR = 19; // 7:00 PM, exclusive

// Nudges a candidate pickup date/time so it always lands inside market
// hours and, if it's today, no earlier than a few minutes from now.
// The native date/time pickers have no concept of "business hours" or
// "not in the past" — @react-native-community/datetimepicker's
// minimumDate only constrains the date picker, not the time picker —
// so that has to be enforced here instead of trusted from the picker.
const clampPickupTime = (candidate) => {
  const now = new Date();
  const result = new Date(candidate);
  result.setSeconds(0, 0);

  if (result.toDateString() === now.toDateString()) {
    const earliest = new Date(now.getTime() + 15 * 60 * 1000); // 15-min prep buffer
    if (result < earliest) result.setTime(earliest.getTime());
  }

  if (result.getHours() < MARKET_OPEN_HOUR) {
    result.setHours(MARKET_OPEN_HOUR, 0, 0, 0);
  } else if (result.getHours() >= MARKET_CLOSE_HOUR) {
    // Past closing (or bumped past it by the "not in the past" nudge
    // above) — roll to opening time the next day rather than accepting
    // a pickup slot the market won't be open for.
    result.setDate(result.getDate() + 1);
    result.setHours(MARKET_OPEN_HOUR, 0, 0, 0);
  }

  return result;
};

export default function CheckoutContent({ cart, cartTotal, navigation, onBack }) {
  const { user } = useAuth();
  const { clearCart } = useCart();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  
  const [loading, setLoading] = useState(false);
  const [pickupTime, setPickupTime] = useState(() => clampPickupTime(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  //  Per-vendor GCash payment states
  const [gcashModalVisible, setGcashModalVisible] = useState(false);
  const [gcashPayments, setGcashPayments] = useState([]);
  const [currentVendorIndex, setCurrentVendorIndex] = useState(0);
  const [allPaymentsCompleted, setAllPaymentsCompleted] = useState(false);
  const [gcashReceiptUploading, setGcashReceiptUploading] = useState(false);
  const [gcashSubmitting, setGcashSubmitting] = useState(false);
  const [gcashScanStatus, setGcashScanStatus] = useState(null);
  const [gcashScanError, setGcashScanError] = useState(null);
  
  //  Each vendor has their own timer (stored in the payment object)
  const gcashTimerRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (gcashTimerRef.current) {
        clearInterval(gcashTimerRef.current);
      }
    };
  }, []);

  //  Timer tick function - updates countdown for current vendor
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

  //  Handle timeout for a specific vendor
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
        'Payment Time Expired',
        `Your 10-minute payment window for ${payment.stallName} has expired. This vendor's order has been cancelled.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Vendor timeout error:', error);
    }
  };

  // Handle GCash modal close
  const handleGcashModalClose = () => {
    // Close the modal directly. Multi-button Alerts don't render their buttons
    // on the app's web runtime, so a confirmation dialog here would appear to
    // do nothing. The per-vendor 10-minute timer keeps running and expires
    // unpaid orders as before.
    setGcashModalVisible(false);
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
          const dataUri = `data:image/jpeg;base64,${photo.base64String}`;
          setGcashPayments(prev => {
            const updated = [...prev];
            updated[index].receiptUri = dataUri;
            return updated;
          });
        }
        return;
      }
      // Web fallback: browser camera picker.
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Camera access is needed to photograph your receipt. You can choose an image from your gallery instead.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: false,
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
      console.error('Error taking receipt photo:', error);
      pickGcashReceipt(index);
    }
  };

  // Pick GCash receipt image for a specific vendor
  const pickGcashReceipt = async (index) => {
    try {
      // Native Android app (Capacitor): use the @capacitor/camera plugin to open
      // the system gallery picker, which asks the user to grant access to their
      // photos before they can choose a receipt image.
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.Base64,
          source: CameraSource.Photos,
          quality: 70,
          correctOrientation: true,
        });
        if (photo && photo.base64String) {
          const dataUri = `data:image/jpeg;base64,${photo.base64String}`;
          setGcashPayments(prev => {
            const updated = [...prev];
            updated[index].receiptUri = dataUri;
            return updated;
          });
        }
        return;
      }

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
      // fetch(uri).blob() is unreliable on Android for the content:// URIs
      // the image picker can return — it fails silently on some
      // pickers/OS versions. Reading the file as base64 and decoding to an
      // ArrayBuffer works consistently on both platforms. expo-file-system
      // has no web implementation of readAsStringAsync at all, so this
      // rejected on every web upload — same fix as the other upload flows.
      let fileData;
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        fileData = await response.blob();
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        fileData = decodeBase64(base64);
      }
      const fileName = `receipt_${Date.now()}_${stallId}.jpg`;
      const folder = `gcash_receipts/${user.id}/${stallId}`;

      // Preferred path: upload to Supabase storage.
      try {
        const { data, error } = await supabase.storage
          .from('vendor_documents')
          .upload(`${folder}/${fileName}`, fileData, {
            cacheControl: '3600',
            contentType: 'image/jpeg',
          });
        if (!error && data) {
          // vendor_documents is a PRIVATE bucket — getPublicUrl() builds a
          // URL that 400s for everyone (including the vendor viewing it in
          // the app), since it only works on public buckets. A signed URL
          // is a real URL that works with no auth headers.
          const { data: urlData, error: signError } = await supabase.storage
            .from('vendor_documents')
            .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);
          if (signError) throw signError;
          return urlData?.signedUrl || null;
        }
        console.warn('Storage upload failed (bucket missing?), embedding receipt on the order instead:', error?.message || error);
      } catch (e) {
        console.warn('Storage upload failed (bucket missing?), embedding receipt on the order instead:', e?.message || e);
      }

      // Fallback: no storage buckets configured yet, so keep the compressed
      // receipt attached directly to the order so payment can still be confirmed.
      return await imageToCompressedDataUri(uri);
    } catch (error) {
      console.error('Error uploading receipt:', error);
      Alert.alert('Upload Error', 'Failed to upload receipt. Please try again.');
      return null;
    } finally {
      setGcashReceiptUploading(false);
    }
  };

  //  Submit payment for current vendor — scans the receipt, cross-checks the
  // reference number/amount/timestamp, checks for reuse, then submits the order
  // for VENDOR verification (it is NOT auto-marked as paid).
  const handleSubmitPayment = async (index) => {
    const payment = gcashPayments[index];
    const referenceDigits = normalizeReference(payment.referenceNumber);

    if (!isValidGcashReference(referenceDigits)) {
      Alert.alert('Invalid Reference Number', 'GCash reference numbers are exactly 13 digits. Please check the reference number on your GCash receipt.');
      return;
    }
    if (!payment.receiptUri) {
      Alert.alert('Missing Receipt', 'Please take a photo of your GCash receipt.');
      return;
    }
    if (payment.isProcessing) return;

    setGcashPayments(prev => {
      const updated = [...prev];
      updated[index].isProcessing = true;
      return updated;
    });
    setGcashScanError(null);
    setGcashScanStatus('Scanning receipt…');

    try {
      // 1) Scan the receipt with OCR. A receipt we cannot read is not accepted.
      let scan = null;
      try {
        scan = await scanReceipt(payment.receiptUri);
      } catch (scanError) {
        console.error('Receipt scan failed:', scanError);
        setGcashScanError('We could not scan your receipt. Please check your internet connection and try again, or retake a clearer photo.');
        Alert.alert(
          'Receipt Scan Unavailable',
          'We could not scan your receipt. Please check your internet connection and try again.\n\nIf the problem continues, retake a clearer photo of the receipt.'
        );
        return;
      }

      // 2) Reference / amount / timestamp cross-checks
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
        setGcashScanError(`We scanned your receipt and could not find the reference number you typed.\nYou typed: ${referenceDigits}\nFound on receipt: ${found}`);
        Alert.alert(
          'Reference Number Not Found on Receipt',
          `We scanned your receipt and could not find the reference number you typed.\n\nYou typed: ${referenceDigits}\nFound on receipt: ${found}\n\nPlease fix your reference number or upload a clearer photo of the correct receipt.`
        );
        return;
      }
      if (!validation.amountMatched) {
        const amountReason = validation.amounts.length === 0
          ? `We could not find the total amount on your receipt. Please upload a clearer photo that shows the amount sent (should be ₱${(payment.total || 0).toFixed(2)}).`
          : `The amount on your receipt (${validation.amounts.map((a) => `₱${a.toFixed(2)}`).join(', ')}) does not match this vendor's total (₱${(payment.total || 0).toFixed(2)}).`;
        setGcashScanError(amountReason);
        Alert.alert(
          'Receipt Amount Problem',
          `${amountReason}\n\nPlease upload the receipt for THIS payment.`
        );
        return;
      }
      if (!validation.timeOk) {
        setGcashScanError(
          validation.timeProblem === 'future'
            ? 'The date/time on this receipt is in the future. Please upload the correct receipt.'
            : 'The date/time on this receipt is too old. Please upload the receipt for THIS payment.'
        );
        Alert.alert(
          validation.timeProblem === 'future' ? 'Invalid Receipt Date' : 'Old Receipt Detected',
          validation.timeProblem === 'future'
            ? 'The date/time on this receipt is in the future. Please upload the correct receipt.'
            : 'The date/time on this receipt is too old. Please upload the receipt for THIS payment.'
        );
        return;
      }

      setGcashScanStatus('Checking for duplicates…');

      // 3) The same GCash reference cannot be used on another order.
      const { data: duplicateRef } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_reference', referenceDigits)
        .neq('id', payment.orderId)
        .maybeSingle();
      if (duplicateRef) {
        setGcashScanError('This GCash reference number was already used on another order. Every payment must have a unique reference number.');
        Alert.alert(
          'Reference Already Used',
          'This GCash reference number was already used on another order. Every payment must have a unique reference number.'
        );
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
            setGcashScanError('This exact receipt image was already uploaded for another order. Please upload a fresh receipt for this payment.');
            Alert.alert(
              'Duplicate Receipt Detected',
              'This exact receipt image was already uploaded for another order. Please upload a fresh receipt for this payment.'
            );
            return;
          }
        } catch (hashCheckError) {
          console.warn('receipt_image_hash column may not exist yet:', hashCheckError);
        }
      }

      setGcashScanStatus('Uploading receipt…');
      const receiptUrl = await uploadGcashReceipt(payment.receiptUri, payment.stallId, index);
      if (!receiptUrl) {
        setGcashScanError('Failed to upload your receipt. Please try again.');
        return;
      }
      
      //  Submit for vendor verification — NOT marked as paid.
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
      
      //  Mark this vendor's payment as submitted (awaiting vendor verification)
      setGcashPayments(prev => {
        const updated = [...prev];
        updated[index].isPaid = true;
        updated[index].isSubmitted = true;
        updated[index].isProcessing = false;
        updated[index].receiptUrl = receiptUrl;
        return updated;
      });
      
      //  Check if all vendors are submitted
      const allPaid = gcashPayments.every(p => p.isPaid || p.isExpired);
      
      if (allPaid) {
        setAllPaymentsCompleted(true);
        if (gcashTimerRef.current) {
          clearInterval(gcashTimerRef.current);
        }
        setTimeout(() => {
          setGcashModalVisible(false);
          Alert.alert(
            'All Payments Submitted!',
            'Your GCash payments have been submitted. The vendors will verify each payment against their own GCash records and confirm your orders.',
            [
              { text: 'View Orders', onPress: () => navigation.navigate('Orders') },
              { text: 'Continue Shopping', onPress: () => navigation.navigate('Home') }
            ]
          );
        }, 1500);
      } else {
        //  Move to next unpaid vendor
        const nextIndex = gcashPayments.findIndex((p, idx) => idx > index && !p.isPaid && !p.isExpired);
        if (nextIndex !== -1) {
          setCurrentVendorIndex(nextIndex);
          // Start timer for next vendor
          startTimerForVendor(nextIndex);
          Alert.alert(
            'Payment Submitted!',
            `Payment for ${payment.stallName} was submitted and is now waiting for vendor verification. Please proceed to pay the next vendor.`,
            [{ text: 'Continue' }]
          );
        }
      }
      
    } catch (error) {
      console.error('Error submitting payment:', error);
      setGcashScanError('Failed to submit payment. Please try again.');
      Alert.alert('Error', 'Failed to submit payment. Please try again.');
    } finally {
      setGcashPayments(prev => {
        const updated = [...prev];
        updated[index].isProcessing = false;
        return updated;
      });
      setGcashScanStatus(null);
    }
  };

  //  Skip to next unpaid vendor
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
      // The previously-picked time-of-day can land outside market hours
      // or in the past once carried onto a different (e.g. today's) date
      // — nudge it back into a valid slot instead of accepting it as-is.
      setPickupTime(clampPickupTime(newDate));
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (!selectedTime) return;

    const newTime = new Date(pickupTime);
    newTime.setHours(selectedTime.getHours());
    newTime.setMinutes(selectedTime.getMinutes());
    newTime.setSeconds(0, 0);

    if (newTime.getHours() < MARKET_OPEN_HOUR || newTime.getHours() >= MARKET_CLOSE_HOUR) {
      Alert.alert('Outside Market Hours', 'Pickup time must be between 5:00 AM and 7:00 PM.');
      return;
    }

    const now = new Date();
    if (newTime.toDateString() === now.toDateString() && newTime < now) {
      Alert.alert('Invalid Time', 'Please choose a pickup time later than now.');
      return;
    }

    setPickupTime(newTime);
  };

  //  FULL GCASH PAYMENT FLOW - Place order then open GCash modal
  const placeOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart first');
      return;
    }

    // Belt-and-suspenders: the pickers already reject an invalid pick,
    // but time keeps moving after that — a slot that was valid when
    // chosen can slip into the past (or past closing) by the time the
    // order actually submits, e.g. sitting on this screen near closing.
    if (pickupTime.getHours() < MARKET_OPEN_HOUR || pickupTime.getHours() >= MARKET_CLOSE_HOUR || pickupTime < new Date()) {
      Alert.alert('Invalid Pickup Time', 'Please choose a pickup time between 5:00 AM and 7:00 PM, later than now.');
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

        //  Each vendor gets their own payment object with individual timer
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
 timeRemaining: 600, // 10 minutes per vendor
        });
      }

      clearCart();
      setGcashPayments(payments);
      setCurrentVendorIndex(0);
      setAllPaymentsCompleted(false);

      //  Open GCash modal with first vendor
      setGcashModalVisible(true);
      
      //  Start timer for first vendor
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
  // Confirm Payment is enabled only when a valid 13-digit reference and a receipt are present
  const gcashReady = !!(currentPayment && isValidGcashReference(currentPayment.referenceNumber) && currentPayment.receiptUri);
  const totalVendors = gcashPayments.length;
  
  //  Count remaining vendors to pay
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

              {/*  Individual Timer for Current Vendor */}
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
                    placeholder="Enter 13-digit GCash reference number"
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
                    maxLength={13}
                  />
                  <Text style={styles.gcashInputHint}>
                    GCash reference numbers are exactly 13 digits
                  </Text>
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
                    onPress={() => takeGcashReceiptFromCamera(currentVendorIndex)} 
                    disabled={gcashReceiptUploading} 
                    activeOpacity={0.7}
                  >
                    {currentPayment.receiptUri ? (
                      <View style={styles.gcashReceiptPreviewContainer}>
                        <Image source={{ uri: currentPayment.receiptUri }} style={styles.gcashReceiptPreview} />
                        <Text style={styles.gcashReceiptChangeText}>
                          <Ionicons name="camera-outline" size={14} /> Tap to retake
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.gcashReceiptPlaceholder}>
                        <Ionicons name="camera-outline" size={36} color={COLORS.gcash} />
                        <Text style={styles.gcashReceiptText}>
                          {gcashReceiptUploading ? 'Uploading...' : 'Take Photo of Receipt'}
                        </Text>
                        <Text style={styles.gcashReceiptHint}>Photograph your GCash receipt now</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.gcashReceiptSecondaryButton}
                    onPress={() => pickGcashReceipt(currentVendorIndex)}
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
                    (!gcashReady || currentPayment.isProcessing) && styles.gcashSubmitButtonDisabled
                  ]}
                  onPress={() => handleSubmitPayment(currentVendorIndex)}
                  disabled={!gcashReady || currentPayment.isProcessing}
                  activeOpacity={0.8}
                >
                  <LinearGradient 
                    colors={[COLORS.gcash, '#005BB5']} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 0 }} 
                    style={styles.gcashSubmitGradient}
                  >
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

              {/* Vendor Completed State */}
              {currentPayment && currentPayment.isPaid && (
                <View style={styles.gcashCompletedContainer}>
                  <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                  <Text style={styles.gcashCompletedText}>Payment Submitted</Text>
                  <Text style={styles.gcashCompletedSubtext}>
                    {currentPayment.stallName} will verify your payment shortly
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
                  <Text style={styles.gcashSkipText}>Skip to next vendor</Text>
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
                        {p.isPaid && ' Paid'}
                        {p.isExpired && ' Expired'}
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

const createStyles = (COLORS) => StyleSheet.create({
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
    shadowColor: COLORS.shadowDark,
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
    flexShrink: 1,
    textAlign: 'center',
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
  gcashStatusItemExpired: {
    color: COLORS.error,
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
    backgroundColor: COLORS.errorLight,
    borderRadius: RADIUS.md,
  },
  gcashExpiredTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.error,
    marginTop: 8,
  },
  gcashExpiredText: {
    fontSize: 13,
    color: COLORS.text.light,
    textAlign: 'center',
    marginTop: 4,
  },
  gcashCompletedContainer: {
    alignItems: 'center',
    padding: 20,
    marginVertical: 10,
    backgroundColor: COLORS.successLight,
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
    color: COLORS.text.light,
    textAlign: 'center',
    marginTop: 4,
  },
});