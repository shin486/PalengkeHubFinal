import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../hooks/useCart';

export default function ProductDetailsScreen({ route, navigation }) {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [stall, setStall] = useState(null);
  const [quantity, setQuantity] = useState(1);
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
      
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
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
      addToCart(product, stall.id, stall, quantity);
      Alert.alert(
        'Added to Cart',
        `${quantity}x ${product.name} added to your cart`,
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
      addToCart(product, stall.id, stall, quantity);
      navigation.navigate('Cart');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
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
        <View style={styles.productImagePlaceholder}>
          <Text style={styles.productEmoji}>🛒</Text>
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>₱{product.price}</Text>
          <Text style={styles.productUnit}>/ {product.unit}</Text>
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

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.button, styles.addToCartButton]}
          onPress={handleAddToCart}
          disabled={!product?.is_available}
        >
          <Text style={styles.buttonText}>
            {product?.is_available ? `Add to Cart (${quantity})` : 'Out of Stock'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.buyNowButton]}
          onPress={handleBuyNow}
          disabled={!product?.is_available}
        >
          <Text style={styles.buttonText}>
            {product?.is_available ? 'Buy Now' : 'Unavailable'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#FF6B6B',
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
  productImagePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#f1f3f5',
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
    color: '#333',
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
    color: '#FF6B6B',
    marginRight: 8,
  },
  productUnit: {
    fontSize: 16,
    color: '#666',
  },
  productDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 15,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 16,
    color: '#666',
    marginRight: 10,
  },
  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableBadge: {
    backgroundColor: '#E8F5E9',
  },
  unavailableBadge: {
    backgroundColor: '#FFEBEE',
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  availableText: {
    color: '#2E7D32',
  },
  unavailableText: {
    color: '#EF4444',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButton: {
    width: 44,
    height: 44,
    backgroundColor: '#f1f3f5',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 20,
    minWidth: 30,
    textAlign: 'center',
    color: '#333',
  },
  stallSection: {
    marginTop: 10,
  },
  stallCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  stallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stallNumber: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  stallRating: {
    fontSize: 14,
    color: '#FFB800',
  },
  stallName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  stallSectionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  stallDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  viewStallLink: {
    fontSize: 14,
    color: '#FF6B6B',
    marginTop: 10,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    marginTop: 10,
    marginBottom: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  addToCartButton: {
    backgroundColor: '#FF6B6B',
  },
  buyNowButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});