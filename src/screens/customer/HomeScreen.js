import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  StatusBar,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useCart } from '../../hooks/useCart';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

// Lipa City Red Color Scheme
const COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  accent: '#F87171',
  accentLight: '#FEE2E2',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: {
    dark: '#1F2937',
    medium: '#4B5563',
    light: '#9CA3AF',
    white: '#FFFFFF',
  },
  border: '#F3F4F6',
  success: '#10B981',
  error: '#DC2626',
  warning: '#F59E0B',
};

export default function HomeScreen({ isGuest = false, navigation }) {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [selectedSection, setSelectedSection] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { user, setIsGuest } = useAuth();
  const { addToCart } = useCart();

  const categories = [
    { id: 1, name: 'Meat', icon: '🥩', gradient: ['#DC2626', '#EF4444'] },
    { id: 2, name: 'Vegetables', icon: '🥬', gradient: ['#10B981', '#34D399'] },
    { id: 3, name: 'Fish', icon: '🐟', gradient: ['#3B82F6', '#60A5FA'] },
    { id: 4, name: 'Fruits', icon: '🍎', gradient: ['#F59E0B', '#FBBF24'] },
    { id: 5, name: 'Dairy', icon: '🥛', gradient: ['#8B5CF6', '#A78BFA'] },
    { id: 6, name: 'Dry Goods', icon: '📦', gradient: ['#6B7280', '#9CA3AF'] },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: stallsData } = await supabase
        .from('stalls')
        .select('*')
        .eq('is_active', true)
        .order('stall_number');
      setStalls(stallsData || []);

      const { data: productsData } = await supabase
        .from('products')
        .select('*, stalls(stall_number, stall_name, id)')
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(10);
      setFeaturedProducts(productsData || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const sections = ['All', ...new Set(stalls.map(s => s.section))];
  const filteredStalls = selectedSection === 'All' 
    ? stalls 
    : stalls.filter(s => s.section === selectedSection);

  // Handle add to cart
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
      Alert.alert(
        'Added to Cart',
        `${product.name} added to your cart`,
        [
          { text: 'Continue Shopping', style: 'cancel' },
          { text: 'View Cart', onPress: () => navigation.navigate('Cart') }
        ]
      );
    }
  };

  // Category Item
  const CategoryItem = ({ category }) => (
    <TouchableOpacity 
      style={styles.categoryItem}
      onPress={() => navigation.navigate('CategoryProducts', {
        categoryName: category.name,
        categoryIcon: category.icon,
      })}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={category.gradient}
        style={styles.categoryIconWrapper}
      >
        <Text style={styles.categoryIcon}>{category.icon}</Text>
      </LinearGradient>
      <Text style={styles.categoryName}>{category.name}</Text>
    </TouchableOpacity>
  );

  // Product Card with working add to cart
  const ProductCard = ({ product }) => (
    <View style={styles.productCard}>
      <TouchableOpacity 
        onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
        activeOpacity={0.8}
      >
        <View style={styles.productImageWrapper}>
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.productImageEmoji}>🛒</Text>
          </View>
        </View>
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.productPrice}>₱{product.price}</Text>
          <Text style={styles.productUnit}>{product.unit}</Text>
          <View style={styles.productFooter}>
            <Text style={styles.productVendor}>Stall {product.stalls?.stall_number}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.addToCartBtn}
        onPress={() => handleAddToCart(product, product.stalls)}
      >
        <Text style={styles.addToCartText}>+</Text>
      </TouchableOpacity>
    </View>
  );

  // Stall Card
  const StallCard = ({ stall }) => (
    <TouchableOpacity 
      style={styles.stallCard}
      onPress={() => navigation.navigate('StallDetails', { stallId: stall.id })}
      activeOpacity={0.8}
    >
      <View style={styles.stallCardContent}>
        <LinearGradient
          colors={['#FEF2F2', '#FEE2E2']}
          style={styles.stallAvatar}
        >
          <Text style={styles.stallAvatarEmoji}>🏪</Text>
        </LinearGradient>
        <View style={styles.stallInfo}>
          <Text style={styles.stallName}>{stall.stall_name || 'Market Stall'}</Text>
          <Text style={styles.stallNumber}>Stall #{stall.stall_number}</Text>
          <View style={styles.stallMeta}>
            <Text style={styles.stallSection}>{stall.section}</Text>
            {stall.average_rating > 0 && (
              <Text style={styles.stallRating}>⭐ {stall.average_rating.toFixed(1)}</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Guest Banner */}
      {isGuest && (
        <View style={styles.guestContainer}>
          <Text style={styles.guestIcon}>👋</Text>
          <View style={styles.guestContent}>
            <Text style={styles.guestTitle}>Guest Mode</Text>
            <Text style={styles.guestText}>Sign in for a better experience</Text>
          </View>
          <TouchableOpacity 
            style={styles.guestSignInBtn}
            onPress={() => navigation.navigate('Login')}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryLight]}
              style={styles.guestSignInGradient}
            >
              <Text style={styles.guestSignInText}>Sign In</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Categories Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Browse Categories</Text>
        
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map(category => (
            <CategoryItem key={category.id} category={category} />
          ))}
        </ScrollView>
      </View>

      {/* Featured Products */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔥 Featured Products</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>View All →</Text>
          </TouchableOpacity>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productsContainer}
        >
          {featuredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
          {featuredProducts.length === 0 && (
            <View style={styles.emptyProducts}>
              <Text style={styles.emptyEmoji}>🛍️</Text>
              <Text style={styles.emptyText}>No products available</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Stalls Section */}
      <View style={[styles.section, styles.lastSection]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏪 Market Stalls</Text>
          <TouchableOpacity onPress={() => navigation.navigate('StallsDirectory')}>
            <Text style={styles.sectionLink}>View All →</Text>
          </TouchableOpacity>
        </View>

        {/* Section Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {sections.map((section, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.filterChip,
                selectedSection === section && styles.filterChipActive
              ]}
              onPress={() => setSelectedSection(section)}
            >
              <Text style={[
                styles.filterChipText,
                selectedSection === section && styles.filterChipTextActive
              ]}>
                {section}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stalls List */}
        <View style={styles.stallsContainer}>
          {filteredStalls.slice(0, 4).map(stall => (
            <StallCard key={stall.id} stall={stall} />
          ))}
        </View>
        
        {filteredStalls.length > 4 && (
          <TouchableOpacity 
            style={styles.browseAllBtn}
            onPress={() => navigation.navigate('StallsDirectory')}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryLight]}
              style={styles.browseAllGradient}
            >
              <Text style={styles.browseAllText}>Browse All Stalls</Text>
              <Text style={styles.browseAllArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // Guest Banner
  guestContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: 16,
    padding: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  guestIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  guestContent: {
    flex: 1,
  },
  guestTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  guestText: {
    fontSize: 12,
    color: COLORS.text.light,
    marginTop: 2,
  },
  guestSignInBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  guestSignInGradient: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  guestSignInText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.white,
  },
  // Section
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  lastSection: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  sectionLink: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  // Categories
  categoriesContainer: {
    paddingRight: 16,
    gap: 16,
  },
  categoryItem: {
    alignItems: 'center',
    width: 70,
  },
  categoryIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryIcon: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text.medium,
  },
  // Products
  productsContainer: {
    paddingRight: 16,
    gap: 14,
  },
  productCard: {
    width: width * 0.42,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  productImageWrapper: {
    padding: 16,
    backgroundColor: '#F8F8F8',
  },
  productImagePlaceholder: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImageEmoji: {
    fontSize: 44,
  },
  productDetails: {
    padding: 12,
    backgroundColor: COLORS.surface,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  productUnit: {
    fontSize: 11,
    color: COLORS.text.light,
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productVendor: {
    fontSize: 10,
    color: COLORS.text.light,
  },
  addToCartBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addToCartText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.white,
  },
  // Filters
  filterContainer: {
    paddingRight: 16,
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text.medium,
  },
  filterChipTextActive: {
    color: COLORS.text.white,
  },
  // Stalls
  stallsContainer: {
    gap: 12,
  },
  stallCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  stallCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stallAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stallAvatarEmoji: {
    fontSize: 26,
  },
  stallInfo: {
    flex: 1,
  },
  stallName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 2,
  },
  stallNumber: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  stallMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stallSection: {
    fontSize: 11,
    color: COLORS.text.light,
    backgroundColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  stallRating: {
    fontSize: 11,
    color: COLORS.warning,
  },
  browseAllBtn: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  browseAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  browseAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.white,
  },
  browseAllArrow: {
    fontSize: 16,
    color: COLORS.text.white,
  },
  // Empty States
  emptyProducts: {
    width: 200,
    alignItems: 'center',
    padding: 30,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.light,
  },
});