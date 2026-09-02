// src/components/vendor/PromotionModal.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  vendorColors,
  vendorSpacing,
  vendorBorderRadius,
} from '../../theme/vendorTheme';

export function PromotionModal({ visible, onClose, onSubmit, editingPromotion, products }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    original_price: '',
    discounted_price: '',
    discount_type: 'percentage',
    discount_value: '',
    start_date: '',
    end_date: '',
    is_active: true,
  });

  useEffect(() => {
    if (editingPromotion) {
      setFormData({
        product_id: editingPromotion.product_id || '',
        original_price: editingPromotion.original_price?.toString() || '',
        discounted_price: editingPromotion.discounted_price?.toString() || '',
        discount_type: editingPromotion.discount_type || 'percentage',
        discount_value: editingPromotion.discount_value?.toString() || '',
        start_date: editingPromotion.start_date?.slice(0, 10) || '',
        end_date: editingPromotion.end_date?.slice(0, 10) || '',
        is_active: editingPromotion.is_active ?? true,
      });
    } else {
      setFormData({
        product_id: '',
        original_price: '',
        discounted_price: '',
        discount_type: 'percentage',
        discount_value: '',
        start_date: '',
        end_date: '',
        is_active: true,
      });
    }
  }, [editingPromotion]);

  const handleProductSelect = (productId) => {
    const product = products.find(p => p.id === productId);
    setFormData(prev => ({
      ...prev,
      product_id: productId,
      original_price: product?.price?.toString() || '',
    }));
  };

  const handleDiscountedPriceChange = (value) => {
    const discounted = parseFloat(value) || 0;
    const original = parseFloat(formData.original_price) || 0;
    let discountValue = '';

    if (original > 0 && discounted > 0 && discounted < original) {
      if (formData.discount_type === 'percentage') {
        discountValue = (((original - discounted) / original) * 100).toFixed(1);
      } else {
        discountValue = (original - discounted).toFixed(2);
      }
    }

    setFormData(prev => ({
      ...prev,
      discounted_price: value,
      discount_value: discountValue,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.product_id) {
      Alert.alert('Error', 'Please select a product');
      return;
    }
    if (!formData.original_price || !formData.discounted_price) {
      Alert.alert('Error', 'Please enter original and discounted prices');
      return;
    }

    const original = parseFloat(formData.original_price);
    const discounted = parseFloat(formData.discounted_price);

    if (discounted >= original) {
      Alert.alert('Error', 'Discounted price must be lower than the original price');
      return;
    }

    const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setDate(defaultEnd.getDate() + 7);

    let endDateIso = defaultEnd.toISOString();
    if (formData.end_date) {
      if (!dateFormat.test(formData.end_date)) {
        Alert.alert('Error', 'End date must be in YYYY-MM-DD format');
        return;
      }
      const endDate = new Date(formData.end_date);
      if (Number.isNaN(endDate.getTime())) {
        Alert.alert('Error', 'End date is not a valid date');
        return;
      }
      if (endDate <= now) {
        Alert.alert('Error', 'End date must be in the future');
        return;
      }
      endDateIso = endDate.toISOString();
    }

    let startDateIso = now.toISOString();
    if (formData.start_date) {
      if (!dateFormat.test(formData.start_date)) {
        Alert.alert('Error', 'Start date must be in YYYY-MM-DD format');
        return;
      }
      const startDate = new Date(formData.start_date);
      if (Number.isNaN(startDate.getTime())) {
        Alert.alert('Error', 'Start date is not a valid date');
        return;
      }
      startDateIso = startDate.toISOString();
    }

    setLoading(true);
    try {
      const payload = {
        product_id: formData.product_id,
        original_price: original,
        discounted_price: discounted,
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value) || 0,
        start_date: startDateIso,
        end_date: endDateIso,
        is_active: formData.is_active,
      };

      await onSubmit(payload);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIcon}>
              <Ionicons name="pricetag-outline" size={22} color={vendorColors.primary} />
            </View>
            <Text style={styles.modalTitle}>
              {editingPromotion ? 'Edit Special Price' : 'New Special Price'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={vendorColors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Product Selector */}
            <Text style={styles.label}>Product *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productList}>
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[
                    styles.productChip,
                    formData.product_id === product.id && styles.productChipActive,
                  ]}
                  onPress={() => handleProductSelect(product.id)}
                >
                  <Text style={[
                    styles.productChipText,
                    formData.product_id === product.id && styles.productChipTextActive,
                  ]}>
                    {product.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Original Price */}
            <Text style={styles.label}>Original Price (₱) *</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₱</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={formData.original_price}
                onChangeText={(text) => setFormData({ ...formData, original_price: text })}
                editable={!editingPromotion}
              />
            </View>

            {/* Discounted Price */}
            <Text style={styles.label}>Special Price (₱) *</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencySymbol}>₱</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                value={formData.discounted_price}
                onChangeText={handleDiscountedPriceChange}
              />
            </View>

            {/* Discount Preview */}
            {formData.discount_value && parseFloat(formData.discount_value) > 0 && (
              <View style={styles.discountPreview}>
                <Ionicons name="trending-down-outline" size={16} color={vendorColors.success} />
                <Text style={styles.discountPreviewText}>
                  {formData.discount_type === 'percentage'
                    ? `${formData.discount_value}% OFF`
                    : `₱${formData.discount_value} OFF`}
                </Text>
              </View>
            )}

            {/* Dates */}
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.label}>Start Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={formData.start_date}
                  onChangeText={(text) => setFormData({ ...formData, start_date: text })}
                />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.label}>End Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={formData.end_date}
                  onChangeText={(text) => setFormData({ ...formData, end_date: text })}
                />
              </View>
            </View>

            <Text style={styles.hint}>Leave dates empty to start now and end in 7 days</Text>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingPromotion ? 'Update Special Price' : 'Create Special Price'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: vendorColors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: vendorColors.text.primary,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: vendorColors.text.medium,
    marginBottom: 8,
    marginTop: 4,
  },
  productList: {
    marginBottom: 16,
  },
  productChip: {
    backgroundColor: vendorColors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: vendorBorderRadius.full,
    marginRight: 8,
    borderWidth: 1,
    borderColor: vendorColors.border,
  },
  productChipActive: {
    backgroundColor: vendorColors.primary,
    borderColor: vendorColors.primary,
  },
  productChipText: {
    fontSize: 12,
    color: vendorColors.text.medium,
    fontWeight: '500',
  },
  productChipTextActive: {
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: vendorColors.border,
    borderRadius: vendorBorderRadius.md,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: vendorColors.surface,
  },
  currencySymbol: {
    fontSize: 16,
    color: vendorColors.text.secondary,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: vendorColors.text.primary,
  },
  discountPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: vendorColors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: vendorBorderRadius.md,
    marginBottom: 16,
  },
  discountPreviewText: {
    fontSize: 13,
    fontWeight: '700',
    color: vendorColors.success,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateField: {
    flex: 1,
  },
  hint: {
    fontSize: 11,
    color: vendorColors.text.tertiary,
    marginTop: 4,
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.md,
    backgroundColor: vendorColors.surfaceAlt,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: vendorColors.text.secondary,
  },
  submitButton: {
    flex: 1,
    borderRadius: vendorBorderRadius.md,
    overflow: 'hidden',
  },
  submitGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});