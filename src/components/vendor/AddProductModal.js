import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const UNITS = ['kg', 'piece', 'bundle', 'dozen'];
const CATEGORIES = ['Meat', 'Vegetable', 'Fish', 'Fruit', 'Dairy', 'Dry Goods'];

export const AddProductModal = ({ visible, onClose, onSubmit, editingProduct = null }) => {
  const [product, setProduct] = useState({
    name: editingProduct?.name || '',
    description: editingProduct?.description || '',
    price: editingProduct?.price?.toString() || '',
    unit: editingProduct?.unit || 'kg',
    category: editingProduct?.category || 'Meat',
    is_available: editingProduct?.is_available ?? true,
  });

  const handleSubmit = () => {
    if (!product.name || !product.price) {
      Alert.alert('Error', 'Please fill in product name and price');
      return;
    }
    onSubmit({
      ...product,
      price: parseFloat(product.price),
    });
    resetForm();
  };

  const resetForm = () => {
    setProduct({
      name: '',
      description: '',
      price: '',
      unit: 'kg',
      category: 'Meat',
      is_available: true,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </Text>
          
          <TextInput
            style={styles.input}
            placeholder="Product Name *"
            placeholderTextColor="#9CA3AF"
            value={product.name}
            onChangeText={t => setProduct({...product, name: t})}
          />
          
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            placeholderTextColor="#9CA3AF"
            value={product.description}
            onChangeText={t => setProduct({...product, description: t})}
            multiline
          />
          
          <TextInput
            style={styles.input}
            placeholder="Price *"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            value={product.price}
            onChangeText={t => setProduct({...product, price: t})}
          />
          
          <View style={styles.row}>
            <Text style={styles.label}>Unit:</Text>
            <View style={styles.options}>
              {UNITS.map(unit => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.option, product.unit === unit && styles.optionActive]}
                  onPress={() => setProduct({...product, unit})}
                >
                  <Text style={product.unit === unit && styles.optionTextActive}>{unit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, product.category === cat && styles.chipActive]}
                  onPress={() => setProduct({...product, category: cat})}
                >
                  <Text style={product.category === cat && styles.chipTextActive}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.buttons}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.submitButton]} onPress={handleSubmit}>
              <LinearGradient
                colors={['#FF6B6B', '#FF8E8E']}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </Text>
              </LinearGradient>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  options: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  optionActive: {
    backgroundColor: '#FF6B6B',
  },
  optionTextActive: {
    color: 'white',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#FF6B6B',
  },
  chipTextActive: {
    color: 'white',
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    overflow: 'hidden',
  },
  submitGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});