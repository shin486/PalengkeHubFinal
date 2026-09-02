import React, { useState, useEffect, useMemo } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { getPriceSuggestion, classifyPrice } from '../../services/priceSuggestion';
import { supabase } from '../../../lib/supabase';
import { useAuth, SIGNED_URL_TTL_SECONDS } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';

// Available unit options with labels
const UNIT_OPTIONS = [
  { id: 'kg', label: 'Per Kilo (kg)', icon: 'scale-outline', defaultPrice: 0 },
  { id: '500g', label: 'Per 500g', icon: 'cube-outline', defaultPrice: 0 },
  { id: '250g', label: 'Per 250g', icon: 'cube-outline', defaultPrice: 0 },
  { id: 'piece', label: 'Per Piece', icon: 'apps-outline', defaultPrice: 0 },
  { id: 'bundle', label: 'Per Bundle', icon: 'leaf-outline', defaultPrice: 0 },
  { id: 'dozen', label: 'Per Dozen (12 pcs)', icon: 'egg-outline', defaultPrice: 0 },
  { id: 'pack', label: 'Per Pack', icon: 'cube-outline', defaultPrice: 0 },
];

// Predefined categories
const CATEGORY_OPTIONS = [
  { id: 'vegetables', label: 'Vegetables', icon: 'leaf' },
  { id: 'meat', label: 'Meat', icon: 'restaurant' },
  { id: 'rice', label: 'Rice & Grains', icon: 'grain' },
  { id: 'fruits', label: 'Fruits', icon: 'nutrition' },
  { id: 'poultry', label: 'Poultry', icon: 'egg' },
  { id: 'other', label: 'Other', icon: 'construct' },
];

export function AddProductModal({ visible, onClose, onSubmit, editingProduct }) {
  const { user } = useAuth();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  // Price-suggestion hint colors by level
  const HINT_COLORS = { high: COLORS.error, low: COLORS.warning, fair: COLORS.success };
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

  // Price suggestion (market-rate guidance)
  const [priceSuggestion, setPriceSuggestion] = useState(null);

  // Debounced market lookup when the product name changes
  useEffect(() => {
    const name = formData.name;
    if (!name || name.trim().length < 3) {
      setPriceSuggestion(null);
      return;
    }
    const timer = setTimeout(async () => {
      const s = await getPriceSuggestion(name);
      setPriceSuggestion(s);
    }, 600);
    return () => clearTimeout(timer);
  }, [formData.name]);

  const priceHint = classifyPrice(formData.price, priceSuggestion);

  // Selected units to offer
  const [selectedUnits, setSelectedUnits] = useState(['kg', '500g', '250g']);

  useEffect(() => {
    if (editingProduct) {
      console.log(' MODAL - Editing product:', editingProduct.name);
      console.log(' MODAL - Image URL:', editingProduct.image_url);

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
      await uploadProductImage(result.assets[0].uri);
    }
  };

  // Uploads to Supabase Storage — was previously sent to ImgBB (a
  // third-party host with an API key hardcoded in the client bundle,
  // no ownership tie to the vendor/product, files not under our control).
  const uploadProductImage = async (uri) => {
    setUploadingImage(true);
    try {
      console.log(' Uploading product image:', uri);

      // fetch(uri).blob() is unreliable on Android for the content:// URIs
      // the image picker can return — it fails silently for some
      // pickers/OS versions. Reading the file as base64 and decoding to an
      // ArrayBuffer works consistently on both platforms. expo-file-system
      // has no web implementation of readAsStringAsync at all, so this used
      // to reject on every web upload — same fix as the profile avatar and
      // vendor document uploads.
      let blob;
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        blob = await response.blob();
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        blob = decodeBase64(base64);
      }
      const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      const path = `product_images/${user?.id || 'unknown'}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('vendor_documents')
        .upload(path, blob, { cacheControl: '3600', upsert: false, contentType });
      if (uploadError) throw uploadError;

      // vendor_documents is a private bucket — a long-lived signed URL is
      // used since getPublicUrl() 400s for any request without an auth
      // header (which every customer browsing products never sends).
      const { data: urlData, error: signError } = await supabase.storage
        .from('vendor_documents')
        .createSignedUrl(uploadData.path, SIGNED_URL_TTL_SECONDS);
      if (signError) throw signError;
      const imageUrl = urlData.signedUrl;
      console.log(' Product image uploaded:', imageUrl);

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

    console.log(' SUBMITTING - Image URL:', formData.image_url);

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

    console.log(' Product Data being sent:', productData);

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
 onError={() => console.log(' Image failed to load')}
 onLoad={() => console.log(' Image loaded')}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={44} color={COLORS.text.quaternary} />
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
              placeholderTextColor={COLORS.text.quaternary}
            />

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Describe your product..."
              placeholderTextColor={COLORS.text.quaternary}
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
                  <Ionicons name={cat.icon} size={16} color={formData.category === cat.id ? COLORS.text.inverse : COLORS.text.tertiary} />
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
                  <Ionicons name={unit.icon} size={16} color={selectedUnits.includes(unit.id) ? COLORS.text.inverse : COLORS.text.tertiary} />
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
            <Text style={styles.label}>Unit Prices</Text>
            <Text style={styles.subLabel}>Set price for each unit</Text>

            {selectedUnits.includes('kg') && (
              <View style={styles.unitPriceRow}>
                <View style={styles.unitPriceLabel}>
                  <Ionicons name="scale-outline" size={18} color={COLORS.text.tertiary} />
                  <Text style={styles.unitPriceText}>Per Kilo (kg) *</Text>
                </View>
                <View style={styles.unitPriceInputContainer}>
                  <Text style={styles.currencySymbol}>₱</Text>
                  <TextInput
                    style={styles.unitPriceInput}
                    placeholder="0.00"
                    placeholderTextColor={COLORS.text.quaternary}
                    keyboardType="decimal-pad"
                    value={formData.price}
                    onChangeText={(text) => setFormData({ ...formData, price: text })}
                  />
                </View>
              </View>
            )}

            {/* Market price suggestion */}
            {selectedUnits.includes('kg') && priceSuggestion && (
              <View
                style={[
                  styles.priceHint,
                  priceHint?.level === 'high' && styles.priceHintHigh,
                  priceHint?.level === 'low' && styles.priceHintLow,
                  priceHint?.level === 'fair' && styles.priceHintFair,
                ]}
              >
                <Ionicons
                  name={
                    priceHint?.level === 'high' ? 'trending-up'
                      : priceHint?.level === 'low' ? 'trending-down'
                        : 'checkmark-circle-outline'
                  }
                  size={15}
                  color={priceHint ? HINT_COLORS[priceHint.level] : COLORS.text.tertiary}
                />
                <Text style={styles.priceHintText}>
                  {priceSuggestion.count} stall{priceSuggestion.count !== 1 ? 's' : ''} sell{' '}
                  {formData.name.trim()} — range ₱{priceSuggestion.min.toFixed(0)}–₱{priceSuggestion.max.toFixed(2)}, avg ₱{priceSuggestion.avg.toFixed(2)}
                  {priceHint ? ` · Yours: ${priceHint.label}` : ''}
                </Text>
              </View>
            )}

            {selectedUnits.includes('500g') && (
              <View style={styles.unitPriceRow}>
                <View style={styles.unitPriceLabel}>
                  <Ionicons name="cube-outline" size={18} color={COLORS.text.tertiary} />
                  <Text style={styles.unitPriceText}>Per 500g</Text>
                </View>
                <View style={styles.unitPriceInputContainer}>
                  <Text style={styles.currencySymbol}>₱</Text>
                  <TextInput
                    style={styles.unitPriceInput}
                    placeholder={`Auto (${parseFloat(formData.price) * 0.5 || 0})`}
                    placeholderTextColor={COLORS.text.quaternary}
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
                  <Ionicons name="cube-outline" size={18} color={COLORS.text.tertiary} />
                  <Text style={styles.unitPriceText}>Per 250g</Text>
                </View>
                <View style={styles.unitPriceInputContainer}>
                  <Text style={styles.currencySymbol}>₱</Text>
                  <TextInput
                    style={styles.unitPriceInput}
                    placeholder={`Auto (${parseFloat(formData.price) * 0.25 || 0})`}
                    placeholderTextColor={COLORS.text.quaternary}
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
                colors={[COLORS.primary, COLORS.primaryLight]}
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

const createStyles = (COLORS) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 8,
    marginTop: 4,
  },
  priceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -2,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  priceHintHigh: {
    backgroundColor: COLORS.errorLight,
  },
  priceHintLow: {
    backgroundColor: COLORS.warningLight,
  },
  priceHintFair: {
    backgroundColor: COLORS.successLight,
  },
  priceHintText: {
    flex: 1,
    fontSize: 11.5,
    color: COLORS.text.secondary,
    lineHeight: 15,
  },
  subLabel: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.surface,
    color: COLORS.text.primary,
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
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.background,
  },
  imagePlaceholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: COLORS.text.tertiary,
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
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
  },
  categoryChipIcon: {
    fontSize: 14,
  },
  categoryChipText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  categoryChipTextActive: {
    color: COLORS.text.inverse,
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
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  unitChipActive: {
    backgroundColor: COLORS.primary,
  },
  unitChipIcon: {
    fontSize: 14,
  },
  unitChipText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  unitChipTextActive: {
    color: COLORS.text.inverse,
  },
  unitPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.text.secondary,
  },
  unitPriceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
  },
  currencySymbol: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    marginRight: 4,
  },
  unitPriceInput: {
    width: 80,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text.primary,
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
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.tertiary,
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
    color: COLORS.text.inverse,
  },
});
