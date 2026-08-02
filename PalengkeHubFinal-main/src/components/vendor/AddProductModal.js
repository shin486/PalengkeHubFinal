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
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// ✅ USE THE SAME IMGBB API KEY as chatService
const IMGBB_API_KEY = '0f4823dff292c1d4c4a6fdcc7d0037c9';

// Available unit options with labels
const UNIT_OPTIONS = [
  { id: 'kg', label: 'Per Kilo (kg)', icon: '⚖️', defaultPrice: 0 },
  { id: '500g', label: 'Per 500g', icon: '📦', defaultPrice: 0 },
  { id: '250g', label: 'Per 250g', icon: '📦', defaultPrice: 0 },
  { id: 'piece', label: 'Per Piece', icon: '🔢', defaultPrice: 0 },
  { id: 'bundle', label: 'Per Bundle', icon: '🌿', defaultPrice: 0 },
  { id: 'dozen', label: 'Per Dozen (12 pcs)', icon: '🥚', defaultPrice: 0 },
  { id: 'pack', label: 'Per Pack', icon: '📦', defaultPrice: 0 },
];

// Predefined categories
const CATEGORY_OPTIONS = [
  { id: 'vegetables', label: 'Vegetables', icon: '🥬' },
  { id: 'meat', label: 'Meat', icon: '🥩' },
  { id: 'rice', label: 'Rice & Grains', icon: '🍚' },
  { id: 'fruits', label: 'Fruits', icon: '🍎' },
  { id: 'poultry', label: 'Poultry', icon: '🐔' },
  { id: 'other', label: 'Other', icon: '🛠️' },
];

export function AddProductModal({ visible, onClose, onSubmit, editingProduct }) {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Base form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'kg',
    category: '',
    image_url: '',
  });
  
  // Unit prices for different options
  const [unitPrices, setUnitPrices] = useState({});
  
  // Selected units to offer
  const [selectedUnits, setSelectedUnits] = useState(['kg', '500g', '250g']);

  useEffect(() => {
    if (editingProduct) {
      console.log('🔵 MODAL - Editing product:', editingProduct.name);
      console.log('🔵 MODAL - Image URL:', editingProduct.image_url);
      
      setFormData({
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        price: editingProduct.price?.toString() || '',
        unit: editingProduct.unit || 'kg',
        category: editingProduct.category || '',
        image_url: editingProduct.image_url || '',
      });
      
      if (editingProduct.price_options && typeof editingProduct.price_options === 'object') {
        setUnitPrices(editingProduct.price_options);
      } else {
        setUnitPrices({});
      }
      
      if (editingProduct.unit_options && Array.isArray(editingProduct.unit_options)) {
        setSelectedUnits(editingProduct.unit_options);
      } else {
        setSelectedUnits(['kg', '500g', '250g']);
      }
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        unit: 'kg',
        category: '',
        image_url: '',
      });
      setUnitPrices({});
      setSelectedUnits(['kg', '500g', '250g']);
    }
  }, [editingProduct]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to add images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadImageToImgBB(result.assets[0].uri);
    }
  };

  // ✅ EXACT SAME FUNCTION as chatService.uploadChatImage
  const uploadImageToImgBB = async (uri) => {
    setUploadingImage(true);
    try {
      console.log('📸 Uploading product image to ImgBB:', uri);
      
      // Fetch the image
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      // Upload to ImgBB
      const formData = new FormData();
      formData.append('image', base64);
      
      const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
        params: {
          key: IMGBB_API_KEY
        },
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const imageUrl = uploadResponse.data.data.url;
      console.log('📸 Product image uploaded to ImgBB:', imageUrl);
      
      // Update form data with the image URL
      setFormData(prev => ({ ...prev, image_url: imageUrl }));
      
      Alert.alert('Success', 'Product image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading product image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUnitPriceChange = (unitId, value) => {
    const price = parseFloat(value) || 0;
    setUnitPrices(prev => ({ ...prev, [unitId]: price }));
    
    if (unitId === 'kg') {
      setFormData({ ...formData, price: value });
    }
  };

  const toggleUnit = (unitId) => {
    if (selectedUnits.includes(unitId)) {
      setSelectedUnits(selectedUnits.filter(u => u !== unitId));
      const newPrices = { ...unitPrices };
      delete newPrices[unitId];
      setUnitPrices(newPrices);
    } else {
      setSelectedUnits([...selectedUnits, unitId]);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!formData.category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    console.log('🔵 SUBMITTING - Image URL:', formData.image_url);

    setLoading(true);
    
    const priceOptions = {};
    selectedUnits.forEach(unit => {
      if (unitPrices[unit] && unitPrices[unit] > 0) {
        priceOptions[unit] = unitPrices[unit];
      } else if (unit === 'kg') {
        priceOptions[unit] = parseFloat(formData.price);
      }
    });
    
    const productData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      unit: formData.unit,
      category: formData.category,
      image_url: formData.image_url,
      price_options: Object.keys(priceOptions).length > 0 ? priceOptions : null,
      unit_options: selectedUnits,
      is_available: editingProduct ? editingProduct.is_available : true,
    };

    console.log('🔵 Product Data being sent:', productData);
    
    await onSubmit(productData);
    setLoading(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Product Image */}
            <Text style={styles.label}>Product Image</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {formData.image_url ? (
                <Image 
                  source={{ uri: formData.image_url }} 
                  style={styles.productImage}
                  onError={() => console.log('❌ Image failed to load')}
                  onLoad={() => console.log('✅ Image loaded')}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderIcon}>📷</Text>
                  <Text style={styles.imagePlaceholderText}>Tap to add image</Text>
                </View>
              )}
              {uploadingImage && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* Product Name */}
            <Text style={styles.label}>Product Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="e.g., Pork Liempo"
              placeholderTextColor="#9CA3AF"
            />

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Describe your product..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />

            {/* CATEGORY */}
            <Text style={styles.label}>Category *</Text>
            <View style={styles.categoryContainer}>
              {CATEGORY_OPTIONS.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    formData.category === cat.id && styles.categoryChipActive,
                  ]}
                  onPress={() => setFormData({ ...formData, category: cat.id })}
                >
                  <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                  <Text
                    style={[
                      styles.categoryChipText,
                      formData.category === cat.id && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Unit Options Selection */}
            <Text style={styles.label}>Available Units for Sale</Text>
            <Text style={styles.subLabel}>Select which units customers can buy</Text>
            <View style={styles.unitSelectorContainer}>
              {UNIT_OPTIONS.map((unit) => (
                <TouchableOpacity
                  key={unit.id}
                  style={[
                    styles.unitChip,
                    selectedUnits.includes(unit.id) && styles.unitChipActive
                  ]}
                  onPress={() => toggleUnit(unit.id)}
                >
                  <Text style={styles.unitChipIcon}>{unit.icon}</Text>
                  <Text style={[
                    styles.unitChipText,
                    selectedUnits.includes(unit.id) && styles.unitChipTextActive
                  ]}>
                    {unit.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Unit Prices Section */}
            <Text style={styles.label}>💰 Unit Prices</Text>
            <Text style={styles.subLabel}>Set price for each unit</Text>
            
            {selectedUnits.includes('kg') && (
              <View style={styles.unitPriceRow}>
                <View style={styles.unitPriceLabel}>
                  <Text style={styles.unitPriceIcon}>⚖️</Text>
                  <Text style={styles.unitPriceText}>Per Kilo (kg) *</Text>
                </View>
                <View style={styles.unitPriceInputContainer}>
                  <Text style={styles.currencySymbol}>₱</Text>
                  <TextInput
                    style={styles.unitPriceInput}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={formData.price}
                    onChangeText={(text) => setFormData({ ...formData, price: text })}
                  />
                </View>
              </View>
            )}

            {selectedUnits.includes('500g') && (
              <View style={styles.unitPriceRow}>
                <View style={styles.unitPriceLabel}>
                  <Text style={styles.unitPriceIcon}>📦</Text>
                  <Text style={styles.unitPriceText}>Per 500g</Text>
                </View>
                <View style={styles.unitPriceInputContainer}>
                  <Text style={styles.currencySymbol}>₱</Text>
                  <TextInput
                    style={styles.unitPriceInput}
                    placeholder={`Auto (${parseFloat(formData.price) * 0.5 || 0})`}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={unitPrices['500g'] ? unitPrices['500g'].toString() : ''}
                    onChangeText={(text) => handleUnitPriceChange('500g', text)}
                  />
                </View>
              </View>
            )}

            {selectedUnits.includes('250g') && (
              <View style={styles.unitPriceRow}>
                <View style={styles.unitPriceLabel}>
                  <Text style={styles.unitPriceIcon}>📦</Text>
                  <Text style={styles.unitPriceText}>Per 250g</Text>
                </View>
                <View style={styles.unitPriceInputContainer}>
                  <Text style={styles.currencySymbol}>₱</Text>
                  <TextInput
                    style={styles.unitPriceInput}
                    placeholder={`Auto (${parseFloat(formData.price) * 0.25 || 0})`}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                    value={unitPrices['250g'] ? unitPrices['250g'].toString() : ''}
                    onChangeText={(text) => handleUnitPriceChange('250g', text)}
                  />
                </View>
              </View>
            )}

            {/* Add other units similarly... */}
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading || uploadingImage}
            >
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                style={styles.submitGradient}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                </Text>
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
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 4,
  },
  subLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  imagePicker: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
  },
  productImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  imagePlaceholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#6B7280',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#DC2626',
  },
  categoryChipIcon: {
    fontSize: 14,
  },
  categoryChipText: {
    fontSize: 12,
    color: '#374151',
  },
  categoryChipTextActive: {
    color: 'white',
  },
  unitSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  unitChipActive: {
    backgroundColor: '#DC2626',
  },
  unitChipIcon: {
    fontSize: 14,
  },
  unitChipText: {
    fontSize: 12,
    color: '#374151',
  },
  unitChipTextActive: {
    color: 'white',
  },
  unitPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unitPriceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  unitPriceIcon: {
    fontSize: 18,
  },
  unitPriceText: {
    fontSize: 14,
    color: '#374151',
  },
  unitPriceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 8,
  },
  currencySymbol: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
  unitPriceInput: {
    width: 80,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    textAlign: 'right',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    flex: 1,
    borderRadius: 12,
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