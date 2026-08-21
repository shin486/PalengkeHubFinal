// src/components/vendor/PaymentApproveModal.js
// Confirmation gate before a vendor approves a payment: the vendor must confirm
// they reviewed the receipt AND checked their own GCash app for the incoming
// amount + reference before the payment can be marked as verified.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vendorColors, vendorSpacing, vendorBorderRadius, vendorShadows } from '../../theme/vendorTheme';

const PaymentApproveModal = ({ visible, order, processing, onClose, onConfirm }) => {
  const [checkedReceipt, setCheckedReceipt] = useState(false);
  const [checkedGcash, setCheckedGcash] = useState(false);

  useEffect(() => {
    if (visible) {
      setCheckedReceipt(false);
      setCheckedGcash(false);
    }
  }, [visible]);

  if (!order) return null;

  const scanMatched = order.payment_scan_matched === true;
  const hasScan = typeof order.payment_scan_matched === 'boolean';
  const canConfirm = checkedReceipt && checkedGcash && !processing;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Verify Payment Before Approving</Text>
          <Text style={styles.subtitle}>
            Order #{order.order_number?.slice(-8) || (order.id ? String(order.id).slice(-8) : '')} • ₱{order.total_amount}
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Customer reference #</Text>
            <Text style={styles.infoValue}>{order.payment_reference || '—'}</Text>
            {hasScan && (
              <Text style={[styles.scanText, { color: scanMatched ? vendorColors.success : vendorColors.warning }]}>
                {scanMatched
                  ? 'Receipt scan matched this reference number'
                  : 'Receipt scan could not confirm a match — verify manually'}
              </Text>
            )}
          </View>

          {order.payment_receipt_url && (
            <View style={styles.receiptBox}>
              <Image
                source={{ uri: order.payment_receipt_url }}
                style={styles.receiptImage}
                resizeMode="contain"
              />
            </View>
          )}

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setCheckedReceipt(!checkedReceipt)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={checkedReceipt ? 'checkbox' : 'square-outline'}
              size={22}
              color={checkedReceipt ? vendorColors.success : vendorColors.text.tertiary}
            />
            <Text style={styles.checkText}>I reviewed the uploaded receipt and the details look correct.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => setCheckedGcash(!checkedGcash)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={checkedGcash ? 'checkbox' : 'square-outline'}
              size={22}
              color={checkedGcash ? vendorColors.success : vendorColors.text.tertiary}
            />
            <Text style={styles.checkText}>
              I checked my own GCash app and received ₱{order.total_amount} with reference{' '}
              {order.payment_reference || '—'}.
            </Text>
          </TouchableOpacity>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmDisabled]}
              onPress={onConfirm}
              disabled={!canConfirm}
              activeOpacity={0.7}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>Approve Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: vendorSpacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: vendorColors.surface,
    borderRadius: vendorBorderRadius.xl,
    padding: vendorSpacing.lg,
    maxHeight: '90%',
    ...vendorShadows.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: vendorColors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: vendorColors.text.secondary,
    marginBottom: 14,
  },
  infoBox: {
    backgroundColor: vendorColors.surfaceAlt,
    borderRadius: vendorBorderRadius.md,
    padding: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: vendorColors.text.tertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: vendorColors.text.primary,
    letterSpacing: 1,
  },
  scanText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  receiptBox: {
    borderRadius: vendorBorderRadius.md,
    borderWidth: 1,
    borderColor: vendorColors.border,
    backgroundColor: vendorColors.background,
    padding: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  receiptImage: {
    width: '100%',
    height: 160,
    borderRadius: vendorBorderRadius.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  checkText: {
    flex: 1,
    fontSize: 13,
    color: vendorColors.text.secondary,
    lineHeight: 18,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: vendorColors.surfaceAlt,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.sm,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: vendorColors.text.secondary,
  },
  confirmBtn: {
    flex: 1.4,
    backgroundColor: vendorColors.success,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDisabled: {
    opacity: 0.45,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default PaymentApproveModal;
