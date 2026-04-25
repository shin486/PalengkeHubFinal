import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

// Helper function to calculate discounted price
const getDiscountedPrice = (originalPrice, promotion) => {
  if (!promotion) return originalPrice;
  if (promotion.discount_type === 'percentage') {
    return originalPrice * (1 - promotion.discount_value / 100);
  } else {
    return Math.max(0, originalPrice - promotion.discount_value);
  }
};

export default function CategoryProductsScreen({ route, navigation }) {
  const { categoryName, categoryIcon } = route.params;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { user, isGuest, setIsGuest } = useAuth();

  useEffect(() => {
    fetchProductsByCategory();
  }, []);

  const fetchProductsByCategory = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            id,
            stall_number,
            stall_name,
            section
          )
        `)
        .eq('category', categoryName)
        .eq('is_available', true)
        .order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        const productIds = data.map(p => p.id);
        const now = new Date().toISOString();
        const { data: promotions } = await supabase
          .from('promotions')
          .select('*')
          .in('product_id', productIds)
          .eq('is_active', true)
          .lte('start_date', now)
          .gte('end_date', now);

        const promoMap = new Map();
        if (promotions) {
          promotions.forEach(promo => {
            promoMap.set(promo.product_id, promo);
          });
        }

        const productsWithPromo = data.map(product => {
          const promotion = promoMap.get(product.id);
          const discountedPrice = getDiscountedPrice(product.price, promotion);
          return {
            ...product,
            promotion,
            originalPrice: product.price,
            price: discountedPrice,
            hasPromotion: !!promotion,
          };
        });

        setProducts(productsWithPromo);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product, stall) => {
    if (!user && !isGuest) {
      Alert.alert(
        'Login Required',
        'Please login to add items to cart',
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
    
    if (product && stall) {
      addToCart(product, stall.id, stall, 1);
      Alert.alert('Added to Cart', `${product.name} added to your cart`);
    }
  };

  const renderProductCard = ({ item }) => {
    const stall = item.stalls;
    const hasPromotion = item.hasPromotion;
    const discountText = hasPromotion && item.promotion?.discount_type === 'percentage'
      ? `${item.promotion.discount_value}% OFF`
      : hasPromotion ? `₱${item.promotion?.discount_value} OFF` : null;

    return (
      <View style={styles.productCard}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
          activeOpacity={0.8}
          style={styles.cardContent}
        >
          <View style={styles.productImageWrapper}>
            <View style={styles.productImagePlaceholder}>
              <Text style={styles.productImageEmoji}>🛒</Text>
            </View>
            {hasPromotion && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>{discountText}</Text>
              </View>
            )}
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.priceRow}>
              {hasPromotion && (
                <Text style={styles.originalPrice}>₱{item.originalPrice.toFixed(2)}</Text>
              )}
              <Text style={styles.productPrice}>₱{item.price.toFixed(2)}</Text>
              <Text style={styles.productUnit}>/{item.unit}</Text>
            </View>
            <View style={styles.productMeta}>
              <Text style={styles.stallName}>
                🏪 {stall?.stall_name || 'Market Stall'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.addToCartBtn}
          onPress={() => handleAddToCart(item, stall)}
        >
          <LinearGradient
            colors={['#DC2626', '#EF4444']}
            style={styles.addToCartGradient}
          >
            <Text style={styles.addToCartText}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading {categoryName}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Simple header - no gradient, no red */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>{categoryIcon}</Text>
          <Text style={styles.headerTitle}>{categoryName}</Text>
          <Text style={styles.headerSubtitle}>
            {products.length} product{products.length !== 1 ? 's' : ''} available
          </Text>
        </View>
      </View>

      {/* Products List */}
      {products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptyText}>
            No {categoryName.toLowerCase()} available at the moment
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProductCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
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
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    marginBottom: 16,
  },
  backText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '500',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 30,
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  productImageWrapper: {
    width: 80,
    height: 80,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginRight: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImageEmoji: {
    fontSize: 36,
  },
  discountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  discountBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: 'white',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  originalPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
    marginRight: 4,
  },
  productUnit: {
    fontSize: 11,
    color: '#6B7280',
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stallName: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
  },
  addToCartBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addToCartGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});