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
import { useI18n } from '../contexts/i18nContext';
import { supabase } from '../../lib/supabase';
import { normalizeReference, isValidGcashReference, scanReceipt, computeImageHash, validateReceiptScan } from '../utils/receiptScanner';
import { clampPickupTime, MARKET_OPEN_HOUR, MARKET_CLOSE_HOUR } from '../utils/marketHours';
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

const UNIT_MULTIPLIERS = {
  'kg': 1.00,
  '500g': 0.50,
  '250g': 0.25,
  'piece': 0.25,
  'bundle': 0.35,
  'dozen': 2.40,
  'pack': 0.80,
  'small': 0.70,
  'medium': 1.00,
  'large': 1.40,
};

export default function CheckoutContent({ cart, cartTotal, navigation, onBack }) {
  const { user } = useAuth();
  const { removeItems, syncPrices } = useCart();
  const { t } = useI18n();
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
      
      notify(
        t('checkout.payment_expired_title', 'Payment Time Expired'),
        t('checkout.payment_expired_desc', 'Your 10-minute payment window for %{stall} has expired. This order has been cancelled.', { stall: payment.stallName })
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
        notify(
          t('checkout.camera_permission_title', 'Permission Needed'),
          t('checkout.camera_permission_body', 'Camera access is needed to photograph your receipt. You can choose an image from your gallery instead.')
        );
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
        notify(
          t('checkout.gallery_permission_title', 'Permission Needed'),
          t('checkout.gallery_permission_body', 'Please allow photo library access to upload your GCash receipt.')
        );
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
      notify(t('common.error', 'Error'), t('checkout.receipt_select_error', 'Failed to select receipt image.'));
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
      notify(t('checkout.upload_error_title', 'Upload Error'), t('checkout.upload_error_body', 'Failed to upload receipt. Please try again.'));
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
      notify(
        t('checkout.invalid_reference_title', 'Invalid Reference Number'),
        t('checkout.invalid_reference_body', 'GCash reference numbers are exactly 13 digits. Please check the reference number on your GCash receipt.')
      );
      return;
    }
    if (!payment.receiptUri) {
      notify(
        t('checkout.missing_receipt_title', 'Missing Receipt'),
        t('checkout.missing_receipt_body', 'Please take a photo of your GCash receipt.')
      );
      return;
    }
    if (payment.isProcessing) return;

    setGcashPayments(prev => {
      const updated = [...prev];
      updated[index].isProcessing = true;
      return updated;
    });
    setGcashScanError(null);
    setGcashScanStatus(t('checkout.scanning_receipt', 'Scanning receipt…'));

    try {
      // 1) Scan the receipt with OCR — best effort, matching CheckoutScreen.js:
      // a failed or imperfect scan no longer dead-ends the customer here since
      // the vendor verifies every submission manually against their own GCash
      // records regardless (payment_status only ever becomes
      // 'awaiting_verification', never auto-'paid'). This used to hard-block
      // on any scan/match failure while the other checkout entry point
      // (CheckoutScreen.js) already offered a manual-verification escape
      // hatch instead — same anti-fraud check, two different outcomes
      // depending on which screen the customer happened to be on.
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
      // Declared here (not const inside the block below) because the DB
      // update further down reads validation.refMatched — it needs to stay
      // in scope, and null, when the scan itself failed.
      let validation = null;
      if (!scanFailed) {
      const oldestAllowed = new Date(Date.now() - 20 * 60 * 1000);
      validation = validateReceiptScan({
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
        const body = t('checkout.ref_not_found_body', 'We scanned your receipt and could not find the reference number you typed.\n\nYou typed: %{typed}\nFound on receipt: %{found}', { typed: referenceDigits, found });
        setGcashScanError(`Reference number not found on receipt. You typed: ${referenceDigits}. Found: ${found}`);
        softIssue = { title: t('checkout.ref_not_found_title', 'Reference Number Not Found on Receipt'), body };
      } else if (!validation.amountMatched) {
        const body = validation.amounts.length === 0
          ? t('checkout.amount_not_found', 'We could not find the total amount on your receipt (should be ₱%{amount}).', { amount: (payment.total || 0).toFixed(2) })
          : t('checkout.amount_mismatch', 'The amount on your receipt (%{receiptAmount}) does not match this vendor\'s total (₱%{expectedAmount}).', {
              receiptAmount: validation.amounts.map((a) => `₱${a.toFixed(2)}`).join(', '),
              expectedAmount: (payment.total || 0).toFixed(2),
            });
        setGcashScanError(body);
        softIssue = { title: t('checkout.amount_problem_title', 'Receipt Amount Problem'), body };
      } else if (!validation.timeOk) {
        const body = validation.timeProblem === 'future'
          ? t('checkout.date_future', 'The date/time on this receipt is in the future. Please upload the correct receipt.')
          : t('checkout.date_old', 'The date/time on this receipt is too old. Please upload the receipt for THIS payment.');
        setGcashScanError(body);
        softIssue = {
          title: validation.timeProblem === 'future' ? t('checkout.invalid_receipt_date', 'Invalid Receipt Date') : t('checkout.old_receipt_detected', 'Old Receipt Detected'),
          body,
        };
      }
      }

      // 3) Soft failures get a manual-verification escape hatch instead of a
      // dead end — matches CheckoutScreen.js's pattern.
      if (scanFailed || softIssue) {
        const title = scanFailed ? t('checkout.receipt_scan_unavailable_title', 'Receipt Scan Unavailable') : softIssue.title;
        const body = scanFailed
          ? t('checkout.receipt_scan_unavailable_body', 'We could not read your receipt automatically. Please check your internet connection or retake a clearer photo.')
          : softIssue.body;

        const confirmBody = `${body}\n\n${t('checkout.vendor_verify_suffix', 'Vendors verify every payment manually — you can submit now and your vendor will confirm it.')}`;
        // react-native-web does NOT implement Alert.alert — its button
        // callbacks never fire on web, so the Promise below would hang
        // forever. window.confirm() is synchronous, so no Promise needed.
        const proceed = Platform.OS === 'web'
          ? window.confirm(`${title}\n\n${confirmBody}`)
          : await new Promise((resolve) => {
            Alert.alert(
              title,
              confirmBody,
              [
                { text: t('checkout.fix_it', 'Fix It'), style: 'cancel', onPress: () => resolve(false) },
                { text: t('checkout.submit_anyway', 'Submit Anyway'), onPress: () => resolve(true) },
              ]
            );
          });
        if (!proceed) return;
      }

      setGcashScanStatus(t('checkout.checking_duplicates', 'Checking for duplicates…'));

      // 3) The same GCash reference cannot be used on another order.
      const { data: duplicateRef } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_reference', referenceDigits)
        .neq('id', payment.orderId)
        .maybeSingle();
      if (duplicateRef) {
        setGcashScanError(t('checkout.duplicate_reference_body', 'This GCash reference number was already used on another order. Every payment must have a unique reference number.'));
        notify(
          t('checkout.duplicate_reference_title', 'Reference Already Used'),
          t('checkout.duplicate_reference_body', 'This GCash reference number was already used on another order. Every payment must have a unique reference number.')
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
            setGcashScanError(t('checkout.duplicate_receipt_body', 'This exact receipt image was already uploaded for another order. Please upload a fresh receipt for this payment.'));
            notify(
              t('checkout.duplicate_receipt_title', 'Duplicate Receipt Detected'),
              t('checkout.duplicate_receipt_body', 'This exact receipt image was already uploaded for another order. Please upload a fresh receipt for this payment.')
            );
            return;
          }
        } catch (hashCheckError) {
          console.warn('receipt_image_hash column may not exist yet:', hashCheckError);
        }
      }

      setGcashScanStatus(t('checkout.uploading_receipt', 'Uploading receipt…'));
      const receiptUrl = await uploadGcashReceipt(payment.receiptUri, payment.stallId, index);
      if (!receiptUrl) {
        setGcashScanError(t('checkout.upload_error_body', 'Failed to upload receipt. Please try again.'));
        return;
      }
      
      //  Submit for vendor verification — NOT marked as paid.
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'awaiting_verification',
          payment_reference: referenceDigits,
          payment_receipt_url: receiptUrl,
          payment_scan_text: (scan?.text || '').slice(0, 1500) || null,
          payment_scan_matched: validation?.refMatched ?? false,
          receipt_image_hash: receiptHash || null,
        })
        .eq('id', payment.orderId);
      
      if (error) throw error;

      // Vendor otherwise only learns of a submitted GCash payment via
      // realtime/polling on the orders list — no notifications row was ever
      // written for this, unlike the vendor->customer direction (see
      // useVendorOrders.js's status-change notifications).
      if (payment.vendorId) {
        const { error: notifyError } = await supabase.from('notifications').insert({
          user_id: payment.vendorId,
          title: 'Payment Submitted',
          message: `A customer submitted a GCash payment for order at ${payment.stallName}. Please verify it.`,
          type: 'order',
          data: { order_id: payment.orderId, type: 'payment_submitted' },
          is_read: false,
          created_at: new Date().toISOString(),
        });
        if (notifyError) console.error('Error notifying vendor of payment submission:', notifyError);
      }

      //  Mark this vendor's payment as submitted (awaiting vendor verification).
      // Build the updated array once and reuse it below — checking
      // completion off the outer `gcashPayments` closure instead reads the
      // pre-update snapshot (setState doesn't mutate it synchronously), so
      // the just-submitted payment never counted itself as paid and the
      // "all submitted" flow never fired even on a fully successful checkout.
      const updatedPayments = gcashPayments.map((p, i) => i === index
        ? { ...p, isPaid: true, isSubmitted: true, isProcessing: false, receiptUrl }
        : p);
      setGcashPayments(updatedPayments);

      //  Check if all vendors are submitted
      const allPaid = updatedPayments.every(p => p.isPaid || p.isExpired);
      
      if (allPaid) {
        setAllPaymentsCompleted(true);
        if (gcashTimerRef.current) {
          clearInterval(gcashTimerRef.current);
        }
        setTimeout(() => {
          setGcashModalVisible(false);
          const successBody = t('checkout.all_payments_submitted_body', 'Your GCash payments have been submitted. The vendors will verify each payment against their own GCash records and confirm your orders.');
          const successTitle = t('checkout.all_payments_submitted_title', 'All Payments Submitted!');
          // react-native-web does NOT implement Alert.alert — use window.confirm on web
          if (Platform.OS === 'web') {
            navigation.navigate(window.confirm(`${successTitle}\n\n${successBody}\n\nOK = ${t('checkout.view_orders', 'View Orders')}, Cancel = ${t('checkout.continue_shopping', 'Continue Shopping')}`) ? 'Orders' : 'Home');
            return;
          }
          Alert.alert(
            successTitle,
            successBody,
            [
              { text: t('checkout.view_orders', 'View Orders'), onPress: () => navigation.navigate('Orders') },
              { text: t('checkout.continue_shopping', 'Continue Shopping'), onPress: () => navigation.navigate('Home') }
            ]
          );
        }, 1500);
      } else {
        //  Move to next unpaid vendor
        const nextIndex = updatedPayments.findIndex((p, idx) => idx > index && !p.isPaid && !p.isExpired);
        if (nextIndex !== -1) {
          setCurrentVendorIndex(nextIndex);
          // Start timer for next vendor
          startTimerForVendor(nextIndex);
          notify(
            t('checkout.payment_submitted', 'Payment Submitted!'),
            t('checkout.payment_submitted_for_vendor', 'Payment for %{stallName} was submitted and is now waiting for vendor verification. Please proceed to pay the next vendor.', { stallName: payment.stallName })
          );
        }
      }
      
    } catch (error) {
      console.error('Error submitting payment:', error);
      setGcashScanError(t('checkout.submit_payment_error', 'Failed to submit payment. Please try again.'));
      notify(t('common.error', 'Error'), t('checkout.submit_payment_error', 'Failed to submit payment. Please try again.'));
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

  const groupByStall = (sourceCart = cart) => {
    const grouped = {};
    sourceCart.forEach(item => {
      const stallId = item.stall_id;
      if (!grouped[stallId]) {
        grouped[stallId] = {
          stall: {
            stall_name: item.stall_name,
            stall_number: item.stall_number,
            section: item.section,
            stall_id: stallId,
            gcash_qr_url: item.gcash_qr_url || null,
            // No fake fallback number here — showing a plausible-looking
            // placeholder as "the vendor's GCash number" risked a customer
            // sending real money to a number that isn't actually theirs.
            gcash_number: item.gcash_number || null,
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

  // react-native-web doesn't implement Alert.alert's dialog reliably (see
  // the same workaround already used for the receipt-scan escape hatch
  // below) — a plain window.alert() is what actually shows on web.
  const notify = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Shared by both the native DateTimePicker handlers and the web <input>
  // handlers below — takes a plain Date/selection, not a native picker
  // event, so both platforms funnel through the exact same validation.
  const applyPickupDate = (selectedDate) => {
    if (!selectedDate) return;
    const newDate = new Date(selectedDate);
    newDate.setHours(pickupTime.getHours());
    newDate.setMinutes(pickupTime.getMinutes());
    // The previously-picked time-of-day can land outside market hours
    // or in the past once carried onto a different (e.g. today's) date
    // — nudge it back into a valid slot instead of accepting it as-is.
    setPickupTime(clampPickupTime(newDate));
  };

  const applyPickupTime = (selectedTime) => {
    if (!selectedTime) return;
    const newTime = new Date(pickupTime);
    newTime.setHours(selectedTime.getHours());
    newTime.setMinutes(selectedTime.getMinutes());
    newTime.setSeconds(0, 0);

    if (newTime.getHours() < MARKET_OPEN_HOUR || newTime.getHours() >= MARKET_CLOSE_HOUR) {
      notify(t('checkout.outside_hours_title', 'Outside Market Hours'), t('checkout.outside_hours_body', 'Pickup time must be between 5:00 AM and 7:00 PM.'));
      return;
    }

    // Same 15-minute prep buffer clampPickupTime enforces for the date
    // picker (applyPickupDate, and the initial default below) — this used
    // to only check `newTime < now` (i.e. not literally in the past),
    // which let a same-day pickup be set for a minute or two from now.
    // Vendors need real prep time regardless of which picker the
    // customer used to land on that slot.
    const now = new Date();
    const earliest = new Date(now.getTime() + 15 * 60 * 1000);
    if (newTime.toDateString() === now.toDateString() && newTime < earliest) {
      notify(t('checkout.invalid_time_title', 'Invalid Time'), t('checkout.invalid_time_body', 'Pickup time must be at least 15 minutes from now.'));
      return;
    }

    setPickupTime(newTime);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    applyPickupDate(selectedDate);
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    applyPickupTime(selectedTime);
  };

  // @react-native-community/datetimepicker ships no web implementation at
  // all (no .web.js — it's native iOS/Android only), so on web the "Pickup
  // Time" button opened nothing: tapping it just flipped showTimePicker to
  // true with no visible picker to show for it. Native <input type="date"/
  // "time"> triggers the browser's own picker and needs no extra library —
  // same validation, real UI on web instead of a dead button.
  const pad2 = (n) => String(n).padStart(2, '0');
  const toDateInputValue = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const toTimeInputValue = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const handleWebDateInput = (e) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    applyPickupDate(new Date(y, m - 1, d));
  };

  const handleWebTimeInput = (e) => {
    const val = e.target.value;
    if (!val) return;
    const [h, min] = val.split(':').map(Number);
    const t = new Date(pickupTime);
    t.setHours(h, min, 0, 0);
    applyPickupTime(t);
  };

  const webPickerInputStyle = {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary || COLORS.text.dark,
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  };

  // Re-checks every cart line against the live `products` row right before
  // an order is created. The cart itself only ever reflects whatever
  // price/quantity was set at add-to-cart time — previously trusted as-is
  // all the way into the order, with nothing to catch a vendor's price
  // change, a since-unlisted product, or (with direct API access) an
  // arbitrarily tampered cart price. Quantity is also clamped here since
  // groupByStall's `item.quantity || 1` only ever caught a literal 0, not
  // a negative number.
  const verifyCartAgainstServer = async () => {
    const productIds = [...new Set(cart.map(item => item.product_id || item.id))];
    if (productIds.length === 0) return { verifiedCart: [], blockedNames: [], pricesChanged: false };

    const { data: freshProducts, error } = await supabase
      .from('products')
      .select(`
        id,
        price,
        is_available,
        name,
        price_options,
        stall:stalls (
          id,
          is_active
        )
      `)
      .in('id', productIds);

    if (error) {
      throw new Error(t('checkout.verify_error', 'Could not verify your items. Please check your connection and try again.'));
    }

    const freshMap = new Map((freshProducts || []).map(p => [p.id, p]));
    const blockedNames = [];
    const verifiedCart = [];
    const changedPrices = new Map();

    for (const item of cart) {
      const pid = item.product_id || item.id;
      const fresh = freshMap.get(pid);
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));

      // Block if product does not exist, is marked unavailable, or its stall is deactivated
      if (!fresh || !fresh.is_available || (fresh.stall && fresh.stall.is_active === false)) {
        blockedNames.push(item.name);
        continue;
      }

      // Determine expected unit base price from price_options or multiplier,
      // matching ProductDetailsScreen and the database trigger enforce_order_item_prices()
      const unit = item.selected_unit || item.unit || 'kg';
      let expectedUnitBase = Number(fresh.price);
      if (fresh.price_options && typeof fresh.price_options === 'object' && fresh.price_options[unit] != null) {
        expectedUnitBase = Number(fresh.price_options[unit]);
      } else {
        const mult = UNIT_MULTIPLIERS[unit] || 1.00;
        expectedUnitBase = Number((Number(fresh.price) * mult).toFixed(2));
      }

      // An accepted haggle price is verified independently server-side against haggle_offers
      // and scoped strictly to this specific customer.
      if (item.haggle_offer_id) {
        if (user?.id) {
          try {
            const { data: validHaggle } = await supabase
              .from('haggle_offers')
              .select('id, current_price, status')
              .eq('id', item.haggle_offer_id)
              .eq('customer_id', user.id)
              .eq('status', 'accepted')
              .maybeSingle();

            if (validHaggle) {
              verifiedCart.push({ ...item, price: Number(validHaggle.current_price), quantity });
              continue;
            }
          } catch (hErr) {
            console.warn('Checkout haggle verify failed:', hErr.message);
          }
        }
        // If not a valid accepted haggle for this user, fall through to normal price verification below
      }

      const baseAtAddTime = Number(item.original_price ?? item.price);
      if (Math.abs(expectedUnitBase - baseAtAddTime) > 0.01 || Math.abs(expectedUnitBase - Number(item.price)) > 0.01) {
        // If a discount ratio was applied, preserve it; otherwise use expectedUnitBase
        const ratio = baseAtAddTime > 0 ? expectedUnitBase / baseAtAddTime : 1;
        const scaledPrice = item.original_price && baseAtAddTime !== Number(item.price)
          ? Number((item.price * ratio).toFixed(2))
          : expectedUnitBase;

        changedPrices.set(pid, scaledPrice);
        verifiedCart.push({ ...item, price: scaledPrice, quantity });
        continue;
      }

      verifiedCart.push({ ...item, price: Number(item.price), quantity });
    }

    // Correct the actual cart (not just this local copy) so if this blocks
    // checkout, the customer reviewing their cart afterward sees the same
    // updated numbers this check just used — not the stale ones that
    // triggered the block.
    if (changedPrices.size > 0) {
      await syncPrices(changedPrices);
    }

    return { verifiedCart, blockedNames, pricesChanged: changedPrices.size > 0 };
  };

  //  FULL GCASH PAYMENT FLOW - Place order then open GCash modal
  const placeOrder = async () => {
    if (!user) {
      notify(
        t('auth.login_required', 'Login Required'),
        t('checkout.login_required_body', 'Please log in to place your order.')
      );
      if (navigation?.navigate) {
        navigation.navigate('Login');
      }
      return;
    }

    // Verify consumer exists in public.profiles before creating orders
    let { data: profileCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profileCheck) {
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
          role: 'consumer',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();

      profileCheck = created;
    }

    if (!profileCheck) {
      await supabase.auth.signOut();
      notify(
        t('auth.session_expired', 'Session Expired'),
        t('checkout.session_expired_body', 'Your account profile was not found. Please log in with a registered account to complete your order.')
      );
      if (navigation?.navigate) {
        navigation.navigate('Login');
      }
      return;
    }

    if (cart.length === 0) {
      notify(t('checkout.empty_cart_title', 'Empty Cart'), t('checkout.empty_cart_body', 'Add items to your cart first'));
      return;
    }

    // Belt-and-suspenders: the pickers already reject an invalid pick,
    // but time keeps moving after that — a slot that was valid when
    // chosen can slip into the past (or past closing) by the time the
    // order actually submits, e.g. sitting on this screen near closing.
    if (pickupTime.getHours() < MARKET_OPEN_HOUR || pickupTime.getHours() >= MARKET_CLOSE_HOUR || pickupTime < new Date()) {
      notify(t('checkout.invalid_pickup_time_title', 'Invalid Pickup Time'), t('checkout.invalid_pickup_time_body', 'Please choose a pickup time between 5:00 AM and 7:00 PM, later than now.'));
      return;
    }

    setLoading(true);
    try {
      const { verifiedCart, blockedNames, pricesChanged } = await verifyCartAgainstServer();

      if (blockedNames.length > 0) {
        setLoading(false);
        notify(
          t('checkout.items_unavailable_title', 'Some items are no longer available'),
          t('checkout.items_unavailable_body', '%{names} %{verb} no longer available. Please remove %{pronoun} from your cart and try again.', {
            names: blockedNames.join(', '),
            verb: blockedNames.length === 1 ? t('cart.is', 'is') : t('cart.are', 'are'),
            pronoun: blockedNames.length === 1 ? 'it' : 'them',
          })
        );
        return;
      }

      if (pricesChanged) {
        setLoading(false);
        notify(
          t('checkout.prices_changed_title', 'Prices have changed'),
          t('checkout.prices_changed_body', 'One or more items in your cart changed price since you added them. Please review your cart — the updated total is now shown there.')
        );
        return;
      }

      const groupedOrders = groupByStall(verifiedCart);
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

        // Placing the order is what "spends" an accepted haggle — it
        // reverts to the normal listed price after this, per how the
        // feature was designed (one use per acceptance, consumed at
        // checkout regardless of whether the order later gets cancelled).
        const haggleIdsForStall = cart
          .filter(item => item.stall_id === Number(stallId) && item.haggle_offer_id)
          .map(item => item.haggle_offer_id);
        if (haggleIdsForStall.length) {
          const { error: haggleUseError } = await supabase
            .from('haggle_offers')
            .update({ status: 'used', used_order_id: order.id })
            .in('id', haggleIdsForStall);
          if (haggleUseError) console.warn('Failed to mark haggle(s) as used:', haggleUseError.message);
        }

        // Fetch the vendor's CURRENT GCash details rather than trusting
        // data.stall (a snapshot frozen onto the cart item back when it was
        // added — a cart can sit for hours/days, and if the vendor updates
        // their GCash number/QR in that window, checkout would otherwise
        // show the customer stale payment details with no way to know.
        const { data: freshStall } = await supabase
          .from('stalls')
          .select('gcash_qr_url, gcash_number, vendor_id')
          .eq('id', stallId)
          .maybeSingle();

        //  Each vendor gets their own payment object with individual timer
        payments.push({
          stallId: parseInt(stallId),
          vendorId: freshStall?.vendor_id || null,
          stallName: data.stall.stall_name,
          stallNumber: data.stall.stall_number,
          gcashQrUrl: freshStall?.gcash_qr_url ?? data.stall.gcash_qr_url ?? null,
          gcashNumber: freshStall?.gcash_number ?? data.stall.gcash_number ?? null,
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

      // Only removes the items that were actually part of THIS checkout
      // (the cart prop is whatever subset CartScreen passed in via its
      // per-item selection) — anything the customer left unchecked stays
      // in the cart for later instead of a full clearCart() sweeping it.
      removeItems(cart.map(item => item.product_id));
      setGcashPayments(payments);
      setCurrentVendorIndex(0);
      setAllPaymentsCompleted(false);

      //  Open GCash modal with first vendor
      setGcashModalVisible(true);
      
      //  Start timer for first vendor
      startTimerForVendor(0);

    } catch (error) {
      console.error('Error placing order:', error);
      const isFkError = error?.code === '23503' || error?.message?.includes('orders_consumer_id_fkey');
      const errorMessage = isFkError
        ? t('checkout.account_not_found', 'Your account profile was not found. Please log in again to complete your order.')
        : (error?.message || t('checkout.place_order_error', 'Failed to place order. Please try again.'));
      notify(t('common.error', 'Error'), errorMessage);
      if (isFkError && navigation?.navigate) {
        navigation.navigate('Login');
      }
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
        <Ionicons name="arrow-back" size={24} color={COLORS.text.primary || COLORS.text.dark} />
        <Text style={styles.backText}>{t('checkout.back_to_cart', 'Back to Cart')}</Text>
      </TouchableOpacity>

      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('checkout.order_summary', 'Order Summary')}</Text>
        {Object.entries(groupedOrders).length === 0 ? (
          <Text style={styles.emptyOrderText}>{t('checkout.empty_order', 'No items in order')}</Text>
        ) : (
          Object.entries(groupedOrders).map(([stallId, data]) => (
            <View key={stallId} style={styles.stallSection}>
              <View style={styles.stallHeader}>
                <Ionicons name="storefront" size={18} color={COLORS.primary} />
                <Text style={styles.stallName}>{data.stall?.stall_name || t('stalls.vendor_fallback', 'Market Stall')}</Text>
                <Text style={styles.stallNumber}>#{data.stall?.stall_number}</Text>
              </View>
              {data.items.map((item, index) => (
                <View key={index} style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.quantity}x {item.name}</Text>
                  <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.stallTotal}>
                <Text style={styles.stallTotalLabel}>{t('checkout.stall_total', 'Stall Total')}</Text>
                <Text style={styles.stallTotalAmount}>₱{data.total.toFixed(2)}</Text>
              </View>
            </View>
          ))
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('common.total', 'Total')}</Text>
          <Text style={styles.totalAmount}>₱{cartTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* Pickup Time */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('checkout.pickup_schedule', 'Pickup Time')}</Text>
        {Platform.OS === 'web' ? (
          <View style={styles.pickupRow}>
            <View style={styles.pickupButton}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
              <input
                type="date"
                value={toDateInputValue(pickupTime)}
                min={toDateInputValue(new Date())}
                onChange={handleWebDateInput}
                style={webPickerInputStyle}
              />
            </View>
            <View style={styles.pickupButton}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              <input
                type="time"
                value={toTimeInputValue(pickupTime)}
                onChange={handleWebTimeInput}
                style={webPickerInputStyle}
              />
            </View>
          </View>
        ) : (
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
        )}
        <View style={styles.pickupNote}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.pickupNoteText}>{t('checkout.arrive_early', 'Please arrive within 15 minutes of your selected time')}</Text>
        </View>
      </View>

      {Platform.OS !== 'web' && showDatePicker && (
        <DateTimePicker value={pickupTime} mode="date" display="default" minimumDate={new Date()} onChange={onDateChange} />
      )}
      {Platform.OS !== 'web' && showTimePicker && (
        <DateTimePicker value={pickupTime} mode="time" display="default" onChange={onTimeChange} />
      )}

      {/* Payment Method - GCash Only */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('checkout.payment_method', 'Payment Method')}</Text>
        <Text style={styles.sectionSubtitle}>{t('checkout.pay_securely_gcash', 'Pay securely using GCash')}</Text>
        
        <View style={styles.gcashPaymentCard}>
          <View style={styles.gcashPaymentRow}>
            <View style={styles.gcashPaymentLeft}>
              <View style={styles.gcashIconContainer}>
                <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.gcashPaymentInfo}>
                <Text style={styles.gcashPaymentName}>{t('checkout.gcash', 'GCash')}</Text>
                <Text style={styles.gcashPaymentDesc}>{t('checkout.pay_securely_gcash', 'Pay securely using GCash')}</Text>
              </View>
            </View>
            <View style={styles.gcashPaymentCheck}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
            </View>
          </View>
          <View style={styles.gcashPaymentFooter}>
            <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.text.light} />
            <Text style={styles.gcashPaymentFooterText}>{t('checkout.secured_gcash', 'Secured by GCash')}</Text>
          </View>
        </View>
        
        {Object.keys(groupedOrders).length > 1 && (
          <View style={styles.vendorCountInfo}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.text.light} />
            <Text style={styles.vendorCountText}>
              {t('checkout.multi_vendor_info', 'You are ordering from %{count} vendors. You will need to pay each vendor separately via GCash.', { count: Object.keys(groupedOrders).length })}
            </Text>
          </View>
        )}
      </View>

      {/* Special Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('checkout.special_instructions', 'Special Instructions')}</Text>
        <TextInput
          style={styles.instructionsInput}
          placeholder={t('checkout.instructions_placeholder', 'Special instructions for the seller...')}
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
                {t('checkout.place_order_gcash', 'Place Order & Pay via GCash')}
                {Object.keys(groupedOrders).length > 1 && ' ' + t('checkout.vendors_count', '(%{count} vendors)', { count: Object.keys(groupedOrders).length })}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
        <Text style={styles.infoText}>
          {t('checkout.info_payment_window', 'After placing your order, you will have 10 minutes to complete your GCash payment. Each vendor must be paid separately.')}
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
                    {t('checkout.vendor_progress', 'Vendor %{current} of %{total}', { current: currentVendorIndex + 1, total: totalVendors })}
                    {remainingVendors > 1 && ' • ' + t('checkout.vendors_remaining', '%{count} remaining', { count: remainingVendors })}
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
                <Text style={styles.gcashModalTitle}>{t('checkout.gcash_payment', 'GCash Payment')}</Text>
                {totalVendors > 1 ? (
                  <Text style={styles.gcashModalSubtitle}>{t('checkout.pay_stall', 'Pay %{stall}', { stall: currentPayment?.stallName })}</Text>
                ) : (
                  <Text style={styles.gcashModalSubtitle}>{t('checkout.gcash_timer_hint', 'Complete your payment within 10 minutes or your order will be cancelled.')}</Text>
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
                  <Text style={styles.gcashTimerLabel}>{t('checkout.time_remaining', 'Time Remaining')}</Text>
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
                  <Text style={styles.gcashQRTitle}>{t('checkout.scan_to_pay', 'Scan to Pay')}</Text>
                  <View style={styles.gcashQRBox}>
                    {currentPayment.gcashQrUrl ? (
                      <Image source={{ uri: currentPayment.gcashQrUrl }} style={styles.gcashQRImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.gcashQRPlaceholder}>
                        {currentPayment.gcashNumber ? (
                          <>
                            <Ionicons name="qr-code-outline" size={72} color={COLORS.gcash} />
                            <Text style={styles.gcashQRPlaceholderText}>{t('checkout.vendor_qr_code', 'Vendor QR Code')}</Text>
                            <Text style={styles.gcashQRPlaceholderSubtext}>GCash: {currentPayment.gcashNumber}</Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="warning-outline" size={48} color={COLORS.error} />
                            <Text style={styles.gcashQRPlaceholderText}>{t('checkout.no_gcash_number', 'No GCash number on file')}</Text>
                            <Text style={styles.gcashQRPlaceholderSubtext}>{t('checkout.no_gcash_desc', "This vendor hasn't set up GCash payment yet. Please confirm their payment details directly before sending money.")}</Text>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                  <Text style={styles.gcashQRVendor}>{currentPayment.stallName}</Text>
                  <Text style={styles.gcashQRPrice}>{t('checkout.amount_label', 'Amount: ₱%{amount}', { amount: currentPayment.total.toFixed(2) })}</Text>
                  <Text style={styles.gcashQRHint}>{t('checkout.open_gcash_hint', 'Open GCash, scan QR, send exact amount')}</Text>
                </View>
              )}

              {/* Reference Number Input */}
              {currentPayment && !currentPayment.isPaid && !currentPayment.isExpired && (
                <View style={styles.gcashInputSection}>
                  <Text style={styles.gcashInputLabel}>
                    <Ionicons name="document-text-outline" size={16} color={COLORS.text.primary || COLORS.text.dark} /> {t('checkout.gcash_reference', 'GCash Reference Number')}
                  </Text>
                  <TextInput
                    style={styles.gcashInput}
                    placeholder={t('checkout.gcash_ref_placeholder', 'e.g. 1234 5678 9012')}
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
                    {t('checkout.gcash_ref_hint', 'You can find this in your GCash app under Transaction History.')}
                  </Text>
                </View>
              )}

              {/* Receipt Upload */}
              {currentPayment && !currentPayment.isPaid && !currentPayment.isExpired && (
                <View style={styles.gcashReceiptSection}>
                  <Text style={styles.gcashInputLabel}>
                    <Ionicons name="camera-outline" size={16} color={COLORS.text.primary || COLORS.text.dark} /> {t('checkout.payment_receipt', 'Payment Receipt')}
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
                          <Ionicons name="camera-outline" size={14} /> {t('checkout.tap_to_retake', 'Tap to retake')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.gcashReceiptPlaceholder}>
                        <Ionicons name="camera-outline" size={36} color={COLORS.gcash} />
                        <Text style={styles.gcashReceiptText}>
                          {gcashReceiptUploading ? t('common.loading', 'Uploading...') : t('checkout.take_photo_receipt', 'Take Photo of Receipt')}
                        </Text>
                        <Text style={styles.gcashReceiptHint}>{t('checkout.photo_receipt_hint', 'Photograph your GCash receipt now')}</Text>
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
                    <Text style={styles.gcashReceiptSecondaryText}>{t('checkout.choose_from_gallery', 'Choose from gallery instead')}</Text>
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
                  <Text style={styles.gcashExpiredTitle}>{t('checkout.payment_expired_title', 'Payment Time Expired')}</Text>
                  <Text style={styles.gcashExpiredText}>
                    {t('checkout.payment_expired_desc', 'Your payment window for %{stall} has expired. This order has been cancelled.', { stall: currentPayment.stallName })}
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
                        <Text style={styles.gcashSubmitText}>{t('checkout.verifying_payment', 'Verifying Payment…')}</Text>
                      </>
                    ) : currentPayment.isPaid ? (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.gcashSubmitText}>{t('checkout.payment_completed', 'Payment Completed')}</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.gcashSubmitText}>
                          {totalVendors > 1 ? t('checkout.pay_stall', 'Pay %{stall}', { stall: currentPayment.stallName }) : t('checkout.confirm_payment', 'Confirm Payment')}
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
                  <Text style={styles.gcashCompletedText}>{t('checkout.payment_submitted', 'Payment Submitted!')}</Text>
                  <Text style={styles.gcashCompletedSubtext}>
                    {t('checkout.vendor_verify_shortly', '%{stall} will verify your payment shortly', { stall: currentPayment.stallName })}
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
                  <Text style={styles.gcashSkipText}>{t('checkout.skip_next_vendor', 'Skip to next vendor')}</Text>
                </TouchableOpacity>
              )}

              {/* Payment Progress Summary */}
              {totalVendors > 1 && (
                <View style={styles.gcashStatusSummary}>
                  <Text style={styles.gcashStatusSummaryTitle}>{t('checkout.payment_progress', 'Payment Progress')}</Text>
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
                        {p.isPaid && ' ' + t('common.paid', 'Paid')}
                        {p.isExpired && ' ' + t('checkout.expired', 'Expired')}
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
    color: COLORS.text.primary || COLORS.text.dark,
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
    color: COLORS.text.primary || COLORS.text.dark,
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
    color: COLORS.text.primary || COLORS.text.dark,
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
    color: COLORS.text.primary || COLORS.text.dark,
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
    backgroundColor: COLORS.surfaceSecondary || COLORS.background,
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 8,
  },
  pickupText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary || COLORS.text.dark,
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
    color: COLORS.text.primary || COLORS.text.dark,
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
    color: COLORS.text.primary || COLORS.text.dark,
    minHeight: 70,
    backgroundColor: COLORS.surfaceSecondary || COLORS.background,
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
    color: COLORS.text.primary || COLORS.text.dark,
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
    color: COLORS.text.primary || COLORS.text.dark,
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
    color: COLORS.text.primary || COLORS.text.dark,
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
    color: COLORS.text.primary || COLORS.text.dark,
    marginBottom: SPACING.sm,
  },
  gcashInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.text.primary || COLORS.text.dark,
    backgroundColor: COLORS.surfaceSecondary || COLORS.background,
  },
  gcashReceiptSection: {
    marginBottom: SPACING.md,
  },
  gcashReceiptButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.surfaceSecondary || COLORS.background,
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
    color: COLORS.text.primary || COLORS.text.dark,
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
    color: COLORS.text.primary || COLORS.text.dark,
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