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
import { checkAnomaly } from '../../services/priceAnomalyService';
import { supabase } from '../../../lib/supabase';
import { useAuth, SIGNED_URL_TTL_SECONDS } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { CATEGORY_OPTIONS } from '../../constants/productCategories';

// Weight/count-based units — for products that can be portioned to an
// exact amount (meat, poultry, rice, etc. can be cut/weighed to order).
const UNIT_OPTIONS = [
  { id: 'kg', label: 'Per Kilo (kg)', icon: 'scale-outline' },
  { id: '500g', label: 'Per 500g', icon: 'cube-outline' },
  { id: '250g', label: 'Per 250g', icon: 'cube-outline' },
  { id: 'piece', label: 'Per Piece', icon: 'apps-outline' },
  { id: 'bundle', label: 'Per Bundle', icon: 'leaf-outline' },
  { id: 'dozen', label: 'Per Dozen (12 pcs)', icon: 'egg-outline' },
  { id: 'pack', label: 'Per Pack', icon: 'cube-outline' },
];
const DEFAULT_UNITS = ['kg', '500g', '250g'];
const BASE_UNIT = 'kg';
// Roughly matches ProductDetailsScreen.js's UNIT_CONFIG multipliers — used
// only to show an "Auto (~₱X)" hint next to units the vendor hasn't priced
// yet; the real price customers pay always comes from price_options first.
const AUTO_HINT_MULTIPLIER = { '500g': 0.50, '250g': 0.25, piece: 0.25, bundle: 0.35, dozen: 2.40, pack: 0.80 };

// Size-based options — for produce that comes as discrete whole pieces and
// can't be cut to an exact weight the way meat can (a mango can't be
// portioned down to "250g of mango"), so it's sold by size grade instead.
// Only offered for the Fruits/Vegetables categories. iconSize scales up
// small->large so the chip row visually hints at the size difference even
// though it's the same glyph.
const SIZE_UNIT_OPTIONS = [
  { id: 'small', label: 'Small', icon: 'ellipse', iconSize: 10 },
  { id: 'medium', label: 'Medium', icon: 'ellipse', iconSize: 14 },
  { id: 'large', label: 'Large', icon: 'ellipse', iconSize: 18 },
];
const DEFAULT_SIZE_UNITS = ['small', 'medium', 'large'];
const BASE_SIZE_UNIT = 'medium';

const PRODUCE_CATEGORIES = ['fruits', 'vegetables'];
const isProduceCategory = (categoryId) => PRODUCE_CATEGORIES.includes(categoryId);

export function AddProductModal({ visible, onClose, onSubmit, editingProduct }) {
  const { user } = useAuth();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  // Price-suggestion hint colors by level
  const HINT_COLORS = { high: COLORS.error, low: COLORS.warning, fair: COLORS.success };
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const MAX_PHOTOS = 3;

  // Base form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'kg',
    category: '',
    image_url: '',
  });

  // Up to MAX_PHOTOS vendor photos. image_url (above) always mirrors
  // images[0] so every other screen that still reads the single legacy
  // field (cards, search results, cart, related products) keeps working.
  const [images, setImages] = useState([]);

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

  const isProduce = isProduceCategory(formData.category);
  const activeUnitOptions = isProduce ? SIZE_UNIT_OPTIONS : UNIT_OPTIONS;
  const baseUnit = isProduce ? BASE_SIZE_UNIT : BASE_UNIT;

  useEffect(() => {
    if (editingProduct) {
      console.log(' MODAL - Editing product:', editingProduct.name);
      console.log(' MODAL - Image URL:', editingProduct.image_url);

      const editingIsProduce = isProduceCategory(editingProduct.category);

      setFormData({
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        price: editingProduct.price?.toString() || '',
        unit: editingProduct.unit || (editingIsProduce ? BASE_SIZE_UNIT : BASE_UNIT),
        category: editingProduct.category || '',
        image_url: editingProduct.image_url || '',
      });
      setImages(
        Array.isArray(editingProduct.image_urls) && editingProduct.image_urls.length > 0
          ? editingProduct.image_urls
          : editingProduct.image_url ? [editingProduct.image_url] : []
      );

      if (editingProduct.price_options && typeof editingProduct.price_options === 'object') {
        setUnitPrices(editingProduct.price_options);
      } else {
        setUnitPrices({});
      }

      if (editingProduct.unit_options && Array.isArray(editingProduct.unit_options)) {
        setSelectedUnits(editingProduct.unit_options);
      } else {
        setSelectedUnits(editingIsProduce ? DEFAULT_SIZE_UNITS : DEFAULT_UNITS);
      }
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        unit: BASE_UNIT,
        category: '',
        image_url: '',
      });
      setImages([]);
      setUnitPrices({});
      setSelectedUnits(DEFAULT_UNITS);
    }
  }, [editingProduct]);

  const pickImage = async () => {
    const remaining = MAX_PHOTOS - images.length;
    if (remaining <= 0) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to add images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      allowsEditing: remaining === 1,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length > 0) {
      await uploadProductImages(result.assets.slice(0, remaining).map(a => a.uri));
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Uploads to Supabase Storage — was previously sent to ImgBB (a
  // third-party host with an API key hardcoded in the client bundle,
  // no ownership tie to the vendor/product, files not under our control).
  const uploadProductImages = async (uris) => {
    setUploadingImage(true);
    try {
      const uploaded = [];
      for (const uri of uris) {
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
        const path = `product_images/${user?.id || 'unknown'}/${Date.now()}-${uploaded.length}.${ext}`;
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
        console.log(' Product image uploaded:', urlData.signedUrl);
        uploaded.push(urlData.signedUrl);
      }

      setImages(prev => {
        const next = [...prev, ...uploaded].slice(0, MAX_PHOTOS);
        setFormData(f => ({ ...f, image_url: next[0] || '' }));
        return next;
      });
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

    if (unitId === baseUnit) {
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

  // Switching between a "sized" category (Fruits/Vegetables) and a
  // "weighed" one changes which units even make sense — kg/500g/piece
  // mean nothing for a size-graded mango, and small/medium/large mean
  // nothing for pork. Reset to that group's own defaults when crossing
  // that line; otherwise just record the category pick as normal.
  const handleCategorySelect = (categoryId) => {
    const nextIsProduce = isProduceCategory(categoryId);
    if (nextIsProduce !== isProduce) {
      setSelectedUnits(nextIsProduce ? DEFAULT_SIZE_UNITS : DEFAULT_UNITS);
      setUnitPrices({});
      setFormData({ ...formData, category: categoryId, unit: nextIsProduce ? BASE_SIZE_UNIT : BASE_UNIT, price: '' });
    } else {
      setFormData({ ...formData, category: categoryId });
    }
  };

  // Alert.alert is callback-based, not awaitable — this wraps it so
  // handleSubmit can pause on the confirm dialog like everything else.
  const confirmAsync = (title, message) =>
    new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Yes, Continue', onPress: () => resolve(true) },
      ]);
    });

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!formData.category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    const parsedPrice = parseFloat(formData.price);

    // Fresh check at save time, not the debounced priceSuggestion state
    // above — that's 600ms-debounced off the name field and can be
    // stale/null if the vendor submits quickly after typing.
    const anomaly = await checkAnomaly(formData.name, parsedPrice);
    if (anomaly) {
      const proceed = await confirmAsync(
        'Price may be flagged',
        `This price is ${anomaly.deviationPct}% above the market average (₱${anomaly.marketAvgPrice.toFixed(2)}) and may be flagged as a price anomaly for admin review. Do you want to continue?`
      );
      if (!proceed) return;
    }

    console.log(' SUBMITTING - Image URL:', formData.image_url);

    setLoading(true);

    const priceOptions = {};
    selectedUnits.forEach(unit => {
      if (unitPrices[unit] && unitPrices[unit] > 0) {
        priceOptions[unit] = unitPrices[unit];
      } else if (unit === baseUnit) {
        priceOptions[unit] = parsedPrice;
      }
    });

    const productData = {
      name: formData.name,
      description: formData.description,
      price: parsedPrice,
      unit: formData.unit,
      category: formData.category,
      image_url: images[0] || '',
      image_urls: images.length > 0 ? images : null,
      price_options: Object.keys(priceOptions).length > 0 ? priceOptions : null,
      unit_options: selectedUnits,
      is_available: editingProduct ? editingProduct.is_available : true,
      // Read by VendorProductsScreen to record the anomaly against the
      // saved product's id, then discarded — not a products-table column
      // (useVendorProducts' insert/update only pick known fields off this
      // object, so this is never sent to Supabase).
      _priceFlag: anomaly || null,
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
            {/* Product Photos — up to MAX_PHOTOS, shown swipeable to customers */}
            <Text style={styles.label}>Product Photos</Text>
            <Text style={styles.subLabel}>
              Add {MAX_PHOTOS === 1 ? '1 photo' : `up to ${MAX_PHOTOS} photos`} — customers can swipe through them
            </Text>
            <View style={styles.photoRow}>
              {images.map((uri, index) => (
                <View key={uri + index} style={styles.photoTile}>
                  <Image source={{ uri }} style={styles.productImage} />
                  <TouchableOpacity
                    style={styles.photoRemoveButton}
                    onPress={() => removeImage(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                  {index === 0 && (
                    <View style={styles.photoCoverBadge}>
                      <Text style={styles.photoCoverBadgeText}>Cover</Text>
                    </View>
                  )}
                </View>
              ))}
              {images.length < MAX_PHOTOS && (
                <TouchableOpacity style={[styles.photoTile, styles.imagePicker]} onPress={pickImage} disabled={uploadingImage}>
                  <View style={styles.imagePlaceholder}>
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <>
                        <Ionicons name="add" size={28} color={COLORS.text.quaternary} />
                        <Text style={styles.imagePlaceholderText}>Add photo</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </View>

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
                  onPress={() => handleCategorySelect(cat.id)}
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

            {/* Unit/Size Options Selection */}
            <Text style={styles.label}>{isProduce ? 'Available Sizes for Sale' : 'Available Units for Sale'}</Text>
            <Text style={styles.subLabel}>
              {isProduce
                ? "Fruits and vegetables can't be cut to an exact weight like meat can — pick which size grades you're selling"
                : 'Select which units customers can buy'}
            </Text>
            <View style={styles.unitSelectorContainer}>
              {activeUnitOptions.map((unit) => (
                <TouchableOpacity
                  key={unit.id}
                  style={[
                    styles.unitChip,
                    selectedUnits.includes(unit.id) && styles.unitChipActive
                  ]}
                  onPress={() => toggleUnit(unit.id)}
                >
                  <Ionicons name={unit.icon} size={unit.iconSize || 16} color={selectedUnits.includes(unit.id) ? COLORS.text.inverse : COLORS.text.tertiary} />
                  <Text style={[
                    styles.unitChipText,
                    selectedUnits.includes(unit.id) && styles.unitChipTextActive
                  ]}>
                    {unit.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Unit/Size Prices Section */}
            <Text style={styles.label}>{isProduce ? 'Size Prices' : 'Unit Prices'}</Text>
            <Text style={styles.subLabel}>{isProduce ? 'Set a price for each size' : 'Set price for each unit'}</Text>

            {selectedUnits.includes(baseUnit) && (() => {
              const baseOption = activeUnitOptions.find(u => u.id === baseUnit);
              return (
                <View style={styles.unitPriceRow}>
                  <View style={styles.unitPriceLabel}>
                    <Ionicons name={baseOption?.icon} size={18} color={COLORS.text.tertiary} />
                    <Text style={styles.unitPriceText}>{baseOption?.label} *</Text>
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
              );
            })()}

            {/* Market price suggestion */}
            {selectedUnits.includes(baseUnit) && priceSuggestion && (
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

            {/* Every other selected unit/size gets its own price row. Weight
                units get an "Auto" hint derived from the base price (matches
                ProductDetailsScreen.js's fallback multiplier if left blank);
                sizes have no sensible auto-derivation from "medium" alone, so
                the vendor must set each one explicitly. */}
            {activeUnitOptions
              .filter(unit => unit.id !== baseUnit && selectedUnits.includes(unit.id))
              .map(unit => {
                const autoMultiplier = AUTO_HINT_MULTIPLIER[unit.id];
                const placeholder = autoMultiplier
                  ? `Auto (${(parseFloat(formData.price) * autoMultiplier) || 0})`
                  : '0.00';
                return (
                  <View key={unit.id} style={styles.unitPriceRow}>
                    <View style={styles.unitPriceLabel}>
                      <Ionicons name={unit.icon} size={unit.iconSize || 18} color={COLORS.text.tertiary} />
                      <Text style={styles.unitPriceText}>{unit.label}</Text>
                    </View>
                    <View style={styles.unitPriceInputContainer}>
                      <Text style={styles.currencySymbol}>₱</Text>
                      <TextInput
                        style={styles.unitPriceInput}
                        placeholder={placeholder}
                        placeholderTextColor={COLORS.text.quaternary}
                        keyboardType="decimal-pad"
                        value={unitPrices[unit.id] ? unitPrices[unit.id].toString() : ''}
                        onChangeText={(text) => handleUnitPriceChange(unit.id, text)}
                      />
                    </View>
                  </View>
                );
              })}
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
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  photoTile: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePicker: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: COLORS.background,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  imagePlaceholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  imagePlaceholderText: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    marginTop: 4,
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCoverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
  },
  photoCoverBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
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
