import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../hooks/useCart';

// Unit configurations (for display only)
const UNIT_CONFIG = {
  'kg': { label: 'Per Kilo (kg)', icon: '⚖️', suffix: 'kg' },
  '500g': { label: 'Per 500g', icon: '📦', suffix: '500g' },
  '250g': { label: 'Per 250g', icon: '📦', suffix: '250g' },
  'piece': { label: 'Per Piece', icon: '🔢', suffix: 'pc' },
  'bundle': { label: 'Per Bundle', icon: '🌿', suffix: 'bundle' },
  'dozen': { label: 'Per Dozen (12 pcs)', icon: '🥚', suffix: 'dozen' },
  'pack': { label: 'Per Pack', icon: '📦', suffix: 'pack' },
};

export default function ProductDetailsScreen({ route, navigation }) {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [stall, setStall] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const { user, isGuest, setIsGuest } = useAuth();
  const { addToCart } = useCart();

  useEffect(() => {
    if (productId) {
      fetchProductDetails();
    }
  }, [productId]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      
      const { data: productData, error } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            id,
            stall_number,
            stall_name,
            section,
            description,
            average_rating,
            total_ratings
          )
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;
      
      setProduct(productData);
      setStall(productData.stalls);
      
      // Get available units from vendor's unit_options
      let units = [];
      
      if (productData.unit_options && Array.isArray(productData.unit_options) && productData.unit_options.length > 0) {
        units = productData.unit_options;
      } else {
        // Fallback based on category
        if (productData.category === 'Meat' || productData.category === 'Fish') {
          units = ['kg', '500g', '250g', 'piece'];
        } else if (productData.category === 'Vegetables') {
          units = ['kg', '500g', '250g', 'piece', 'bundle'];
        } else {
          units = ['kg', '500g', '250g'];
        }
      }
      
      setAvailableUnits(units);
      setSelectedUnit(units[0]);
      
      // ✅ Get price from vendor's price_options
      const priceOptions = productData.price_options || {};
      
      // Set initial price using vendor's price or fallback
      let initialPrice;
      if (priceOptions[units[0]]) {
        initialPrice = priceOptions[units[0]];
      } else {
        initialPrice = productData.price;
      }
      
      setCurrentPrice(initialPrice);
      
      console.log('Product loaded:', productData.name);
      console.log('Vendor price options:', priceOptions);
      console.log('Available units:', units);
      
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  const handleUnitChange = (unit) => {
    setSelectedUnit(unit);
    
    // ✅ Get price from vendor's price_options
    const priceOptions = product?.price_options || {};
    let newPrice;
    
    if (priceOptions[unit]) {
      newPrice = priceOptions[unit];
    } else {
      // Fallback to base price if vendor didn't set custom price
      newPrice = product?.price || 0;
    }
    
    setCurrentPrice(newPrice);
    setQuantity(1);
  };

  const getUnitDisplayText = (unit) => {
    const unitInfo = UNIT_CONFIG[unit];
    if (unitInfo) return unitInfo.label;
    return `Per ${unit}`;
  };

  const getUnitSuffix = (unit) => {
    const unitInfo = UNIT_CONFIG[unit];
    return unitInfo?.suffix || unit;
  };

  // ✅ Get the price for a specific unit (from vendor's price_options)
  const getUnitPrice = (unit) => {
    const priceOptions = product?.price_options || {};
    if (priceOptions[unit]) {
      return priceOptions[unit];
    }
    // Fallback to base price if not set
    return product?.price || 0;
  };

  const handleAddToCart = () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to add items to cart',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => {
              if (setIsGuest) setIsGuest(false);
              else navigation.popToTop();
            }
          }
        ]
      );
      return;
    }
    
    if (product && stall) {
      const cartProduct = {
        ...product,
        price: currentPrice,
        selected_unit: selectedUnit,
        selected_unit_label: getUnitDisplayText(selectedUnit),
        selected_unit_suffix: getUnitSuffix(selectedUnit),
        original_unit: product.unit,
        original_price: product.price,
      };
      
      addToCart(cartProduct, stall.id, stall, quantity);
      
      let quantityText = '';
      if (selectedUnit === 'kg') quantityText = `${quantity}kg`;
      else if (selectedUnit === '500g') quantityText = `${quantity * 0.5}kg`;
      else if (selectedUnit === '250g') quantityText = `${quantity * 0.25}kg`;
      else quantityText = `${quantity} ${getUnitSuffix(selectedUnit)}`;
      
      Alert.alert(
        'Added to Cart',
        `${quantityText} of ${product.name} added to your cart`,
        [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => navigation.navigate('Cart') }
        ]
      );
    }
  };

  const handleBuyNow = () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to complete purchase',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => {
              if (setIsGuest) setIsGuest(false);
              else navigation.popToTop();
            }
          }
        ]
      );
      return;
    }
    
    if (product && stall) {
      const cartProduct = {
        ...product,
        price: currentPrice,
        selected_unit: selectedUnit,
        selected_unit_label: getUnitDisplayText(selectedUnit),
        selected_unit_suffix: getUnitSuffix(selectedUnit),
        original_unit: product.unit,
        original_price: product.price,
      };
      
      addToCart(cartProduct, stall.id, stall, quantity);
      navigation.navigate('Cart');
    }
  };

  const handleReportProduct = () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to report an issue',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => {
              if (setIsGuest) setIsGuest(false);
            }
          }
        ]
      );
      return;
    }

    navigation.navigate('ReportIssue', {
      type: 'product',
      targetId: product.id,
      targetName: product.name,
      targetType: 'product'
    });
  };

  const totalPrice = currentPrice * quantity;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image 
            source={{ uri: product.image_url }} 
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.productEmoji}>🛒</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>₱{currentPrice.toFixed(2)}</Text>
          <Text style={styles.productUnit}>/ {getUnitDisplayText(selectedUnit)}</Text>
        </View>

        {product.description ? (
          <Text style={styles.productDescription}>{product.description}</Text>
        ) : null}

        <View style={styles.availabilityRow}>
          <Text style={styles.availabilityLabel}>Status:</Text>
          <View style={[
            styles.availabilityBadge,
            product.is_available ? styles.availableBadge : styles.unavailableBadge
          ]}>
            <Text style={[
              styles.availabilityText,
              product.is_available ? styles.availableText : styles.unavailableText
            ]}>
              {product.is_available ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>
        </View>
      </View>

      {/* Unit Selection - Shows ONLY vendor's selected units with their custom prices */}
      {availableUnits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Unit</Text>
          <View style={styles.unitsContainer}>
            {availableUnits.map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[
                  styles.unitChip,
                  selectedUnit === unit && styles.unitChipActive
                ]}
                onPress={() => handleUnitChange(unit)}
              >
                <Text style={styles.unitChipIcon}>{UNIT_CONFIG[unit]?.icon || '📦'}</Text>
                <Text style={[
                  styles.unitChipText,
                  selectedUnit === unit && styles.unitChipTextActive
                ]}>
                  {getUnitDisplayText(unit)}
                </Text>
                <Text style={[
                  styles.unitChipPrice,
                  selectedUnit === unit && styles.unitChipPriceActive
                ]}>
                  ₱{getUnitPrice(unit).toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Quantity Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quantity</Text>
        <View style={styles.quantityContainer}>
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          
          <Text style={styles.quantityText}>{quantity}</Text>
          
          <TouchableOpacity 
            style={styles.quantityButton}
            onPress={() => setQuantity(quantity + 1)}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Total Price */}
      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total Amount:</Text>
        <Text style={styles.totalPrice}>₱{totalPrice.toFixed(2)}</Text>
      </View>

      {/* Stall Info */}
      {stall ? (
        <TouchableOpacity 
          style={styles.stallSection}
          onPress={() => navigation.navigate('StallDetails', { stallId: stall.id })}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>Sold by</Text>
          <View style={styles.stallCard}>
            <View style={styles.stallHeader}>
              <Text style={styles.stallNumber}>Stall #{stall.stall_number}</Text>
              {stall.average_rating > 0 ? (
                <Text style={styles.stallRating}>⭐ {stall.average_rating.toFixed(1)}</Text>
              ) : null}
            </View>
            <Text style={styles.stallName}>{stall.stall_name || 'Market Stall'}</Text>
            <Text style={styles.stallSectionText}>{stall.section}</Text>
            {stall.description ? (
              <Text style={styles.stallDescription} numberOfLines={2}>
                {stall.description}
              </Text>
            ) : null}
            <Text style={styles.viewStallLink}>View Stall Details →</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Report Button */}
      <View style={styles.reportSection}>
        <TouchableOpacity 
          style={styles.reportProductButton}
          onPress={handleReportProduct}
        >
          <Text style={styles.reportIcon}>🚫</Text>
          <Text style={styles.reportButtonText}>Report this Product</Text>
        </TouchableOpacity>
        <Text style={styles.reportNote}>
          Found an issue with this product? Let us know so we can investigate.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.button, styles.addToCartButton]}
          onPress={handleAddToCart}
          disabled={!product?.is_available}
        >
          <LinearGradient
            colors={['#DC2626', '#EF4444']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {product?.is_available ? `Add to Cart (₱${totalPrice.toFixed(2)})` : 'Out of Stock'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.buyNowButton]}
          onPress={handleBuyNow}
          disabled={!product?.is_available}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {product?.is_available ? 'Buy Now' : 'Unavailable'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
  },
  productImage: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
  productImagePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productEmoji: {
    fontSize: 60,
  },
  productInfo: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 1,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 15,
  },
  productPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#DC2626',
    marginRight: 8,
  },
  productUnit: {
    fontSize: 14,
    color: '#6B7280',
  },
  productDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 15,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 10,
  },
  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableBadge: {
    backgroundColor: '#D1FAE5',
  },
  unavailableBadge: {
    backgroundColor: '#FEE2E2',
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  availableText: {
    color: '#059669',
  },
  unavailableText: {
    color: '#DC2626',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 15,
  },
  unitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 8,
  },
  unitChipActive: {
    backgroundColor: '#DC2626',
  },
  unitChipIcon: {
    fontSize: 16,
  },
  unitChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  unitChipTextActive: {
    color: 'white',
  },
  unitChipPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
    marginLeft: 4,
  },
  unitChipPriceActive: {
    color: 'white',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 44,
    height: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  quantityText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginHorizontal: 24,
    minWidth: 40,
    textAlign: 'center',
    color: '#111827',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 20,
    marginTop: 10,
    borderRadius: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  stallSection: {
    marginTop: 10,
  },
  stallCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  stallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stallNumber: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  stallRating: {
    fontSize: 12,
    color: '#F59E0B',
  },
  stallName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  stallSectionText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  stallDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  viewStallLink: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 10,
    fontWeight: '500',
  },
  reportSection: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 10,
    alignItems: 'center',
  },
  reportProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    width: '100%',
  },
  reportIcon: {
    fontSize: 18,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
  },
  reportNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});