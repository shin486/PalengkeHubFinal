import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { Header } from './src/components/Header'; 
import { LoadingSpinner } from './src/components/LoadingSpinner';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { SignUpScreen } from './src/screens/auth/SignUpScreen';
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import AdminVendorApplicationsScreen from './src/screens/admin/AdminVendorApplicationsScreen';
import AdminStallsManagementScreen from './src/screens/admin/AdminStallsManagementScreen';
import AdminReportsScreen from './src/screens/admin/AdminReportsScreen';
import VendorDashboardScreen from './src/screens/vendor/VendorDashboardScreen';
import ProductDetailsScreen from './src/screens/customer/ProductDetailsScreen';
import StallsDirectoryScreen from './src/screens/customer/StallsDirectoryScreen';
import StallDetailsScreen from './src/screens/customer/StallDetailsScreen';
import CartScreen from './src/screens/customer/CartScreen';
import SearchScreen from './src/screens/customer/SearchScreen';
import OrdersScreen from './src/screens/customer/OrdersScreen';
import ProfileScreen from './src/screens/customer/ProfileScreen';
import CheckoutScreen from './src/screens/customer/CheckoutScreen';
import CategoryProductsScreen from './src/screens/customer/CategoryProductsScreen';
import { useCart } from './src/hooks/useCart';

const { width } = Dimensions.get('window');
const Stack = createNativeStackNavigator();

const colors = {
  primary: '#6366F1',
  secondary: '#8B5CF6',
  accent: '#EC4899',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
  },
  border: '#E5E7EB',
};

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('❌ ERROR CAUGHT:', error);
    console.log('❌ ERROR INFO:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'red', marginBottom: 20 }}>
            🐛 Error Detected
          </Text>
          <Text style={{ fontSize: 16, marginBottom: 10 }}>{this.state.error?.toString()}</Text>
          <Text style={{ fontSize: 14, color: '#666', marginTop: 20 }}>
            Component Stack:
          </Text>
          <Text style={{ fontSize: 12, color: '#999' }}>
            {this.state.errorInfo?.componentStack}
          </Text>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

// HomeScreen component
function HomeScreen({ isGuest = false, navigation }) {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [selectedSection, setSelectedSection] = useState('All');
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 1, name: 'Meat', icon: '🥩', gradient: ['#FF6B6B', '#EE5A24'] },
    { id: 2, name: 'Vegetables', icon: '🥬', gradient: ['#6AB04A', '#2ECC71'] },
    { id: 3, name: 'Fish', icon: '🐟', gradient: ['#3498DB', '#2980B9'] },
    { id: 4, name: 'Fruits', icon: '🍎', gradient: ['#F39C12', '#E67E22'] },
    { id: 5, name: 'Dairy', icon: '🥛', gradient: ['#9B59B6', '#8E44AD'] },
    { id: 6, name: 'Dry Goods', icon: '📦', gradient: ['#7F8C8D', '#34495E'] },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [stallsResponse, productsResponse] = await Promise.all([
        supabase.from('stalls').select('*').order('stall_number'),
        supabase
          .from('products')
          .select('*, stalls(stall_number, stall_name)')
          .eq('is_available', true)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      setStalls(stallsResponse.data || []);
      setFeaturedProducts(productsResponse.data || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sections = ['All', ...new Set(stalls.map(s => s.section))];
  const filteredStalls = selectedSection === 'All' 
    ? stalls 
    : stalls.filter(s => s.section === selectedSection);

  const renderCategoryCard = (cat) => (
    <TouchableOpacity
      key={cat.id}
      style={styles.categoryCard}
      onPress={() => navigation.navigate('CategoryProducts', {
        categoryName: cat.name,
        categoryIcon: cat.icon,
        gradient: cat.gradient
      })}
    >
      <LinearGradient
        colors={cat.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.categoryGradient}
      >
        <Text style={styles.categoryIcon}>{cat.icon}</Text>
      </LinearGradient>
      <Text style={styles.categoryName}>{cat.name}</Text>
    </TouchableOpacity>
  );

  const renderProductCard = (product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
      activeOpacity={0.7}
    >
      <View style={styles.productImageContainer}>
        <LinearGradient
          colors={['#F3F4F6', '#E5E7EB']}
          style={styles.productImagePlaceholder}
        >
          <Text style={styles.productEmoji}>🛒</Text>
        </LinearGradient>
        <BlurView intensity={80} tint="light" style={styles.productBadge}>
          <Text style={styles.productBadgeText}>{product.category}</Text>
        </BlurView>
      </View>
      
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productPrice}>₱{product.price}</Text>
        <View style={styles.productMeta}>
          <Text style={styles.productStall}>Stall {product.stalls?.stall_number}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingStar}>⭐</Text>
            <Text style={styles.ratingValue}>4.5</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderStallCard = (stall) => (
    <TouchableOpacity
      key={stall.id}
      style={styles.stallCard}
      onPress={() => navigation.navigate('StallDetails', { stallId: stall.id })}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB']}
        style={styles.stallGradient}
      >
        <View style={styles.stallHeader}>
          <Text style={styles.stallNumber}>#{stall.stall_number}</Text>
          {stall.average_rating > 0 && (
            <View style={styles.stallRating}>
              <Text style={styles.stallRatingStar}>⭐</Text>
              <Text style={styles.stallRatingValue}>{stall.average_rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.stallName}>{stall.stall_name || 'Market Stall'}</Text>
        
        <View style={styles.stallSectionBadge}>
          <Text style={styles.stallSectionText}>{stall.section}</Text>
        </View>
        
        {stall.description && (
          <Text style={styles.stallDescription} numberOfLines={2}>
            {stall.description}
          </Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Guest Banner */}
        {isGuest && (
          <BlurView intensity={100} tint="light" style={styles.guestBanner}>
            <Text style={styles.guestBannerText}>👋 Browsing as guest</Text>
            <Text style={styles.guestBannerSubtext}>Sign in to save cart and order</Text>
          </BlurView>
        )}

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Fresh from the Market</Text>
          <Text style={styles.welcomeSubtitle}>Discover the best from Lipa City Public Market</Text>
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {categories.map(renderCategoryCard)}
          </ScrollView>
        </View>

        {/* Featured Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Products</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.productsScroll}
          >
            {featuredProducts.map(renderProductCard)}
          </ScrollView>
        </View>

        {/* Stalls Directory */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by Section</Text>
            <TouchableOpacity onPress={() => navigation.navigate('StallsDirectory')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {/* Section Filter */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
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

          {/* Stalls Grid */}
          <View style={styles.stallsGrid}>
            {filteredStalls.slice(0, 4).map(renderStallCard)}
          </View>
          
          {filteredStalls.length > 4 && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('StallsDirectory')}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.viewAllGradient}
              >
                <Text style={styles.viewAllText}>View All Stalls</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Auth Stack Navigator


// Custom hook to get current route name
function useCurrentRoute() {
  const navigation = useNavigation();
  const [route, setRoute] = useState(null);

  useEffect(() => {
    if (!navigation) return;

    const getCurrentRoute = () => {
      const state = navigation.getState();
      if (state && state.routes) {
        const current = state.routes[state.index];
        setRoute(current);
      }
    };

    getCurrentRoute();
    const unsubscribe = navigation.addListener('state', getCurrentRoute);
    return unsubscribe;
  }, [navigation]);

  return route;
}

// Main App Stack Navigator
// Main App Stack Navigator
function AppStack({ isGuest }) {
  const { cartCount } = useCart();
  const navigation = useNavigation();
  const currentRoute = useCurrentRoute();

  const getHeaderProps = () => {
    const routeName = currentRoute?.name;
    
    switch (routeName) {
      case 'Home':
        return { title: '🛒 PalengkeHub', subtitle: 'Lipa City Public Market' };
      case 'Search':
        return { title: '🔍 Search', subtitle: 'Find products and stalls' };
      case 'Cart':
        return { 
          title: '🛒 Your Cart', 
          subtitle: cartCount > 0 ? `${cartCount} item${cartCount > 1 ? 's' : ''}` : 'Add items to get started' 
        };
      case 'Orders':
        return { title: '📋 My Orders', subtitle: 'Track your orders here' };
      case 'Profile':
        return { title: '👤 My Profile', subtitle: 'Manage your account' };
      case 'StallsDirectory':
        return { title: '🏪 Stalls Directory', subtitle: 'Browse all market stalls' };
      case 'ProductDetails':
        return { title: '🛍️ Product Details', subtitle: 'View item details' };
      case 'StallDetails':
        return { title: '🏪 Stall Details', subtitle: 'View stall information' };
      case 'CategoryProducts':
        return { title: '📂 Category', subtitle: 'Browse products' };
      default:
        return { title: '🛒 PalengkeHub', subtitle: 'Lipa City Public Market' };
    }
  };

  const { title, subtitle } = getHeaderProps();

  return (
    <View style={styles.container}>
      <Header title={title} subtitle={subtitle} />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Screen name="Home">
          {props => <HomeScreen {...props} isGuest={isGuest} />}
        </Stack.Screen>
        <Stack.Screen name="VendorDashboard" component={VendorDashboardScreen} />
        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
        <Stack.Screen name="StallDetails" component={StallDetailsScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="StallsDirectory" component={StallsDirectoryScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
      </Stack.Navigator>
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Search')}>
          <Text style={styles.navIcon}>🔍</Text>
          <Text style={styles.navText}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Cart')}>
          <Text style={styles.navIcon}>🛒</Text>
          <Text style={styles.navText}>Cart</Text>
          {cartCount > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Orders')}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navText}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Global navigation ref
let navigationContainerRef = null;


// Root Navigator - UPDATED VERSION
// Root Navigator - CORRECTED VERSION
function RootNavigator() {
  const { user, loading, isGuest, setIsGuest, profile } = useAuth();

  console.log('🔄 RootNavigator - isGuest:', isGuest, 'user:', user?.email, 'role:', profile?.role);

  useEffect(() => {
    if (isGuest && global.navigationRef) {
      console.log('🎯 Guest mode activated - navigating to App');
      global.navigationRef.reset({
        index: 0,
        routes: [{ name: 'App' }],
      });
    }
  }, [isGuest]);

  if (loading) {
    return <LoadingSpinner />;
  }

  // Determine initial route
  let initialRoute = 'Login';
  
  if (isGuest) {
    initialRoute = 'App';
  } else if (user && profile?.role === 'vendor') {
    initialRoute = 'VendorDashboard';
  } else if (user && profile?.role === 'admin') {
    initialRoute = 'AdminDashboard';
  } else if (user && profile?.role === 'consumer') {
    initialRoute = 'App';
  }

  return (
    <NavigationContainer 
      ref={(ref) => {
        global.navigationRef = ref;
        navigationContainerRef = ref;
        console.log('✅ NavigationContainer ref set');
      }}
    >
      <Stack.Navigator 
        screenOptions={{ headerShown: false }} 
        initialRouteName={initialRoute}
      >
        {/* Auth screens */}
        <Stack.Screen name="Login">
          {() => <LoginScreen setIsGuest={setIsGuest} />}
        </Stack.Screen>
        <Stack.Screen name="SignUp">
          {() => <SignUpScreen setIsGuest={setIsGuest} />}
        </Stack.Screen>
        
        {/* Vendor screens */}
        <Stack.Screen name="VendorDashboard" component={VendorDashboardScreen} />
        
        {/* Admin screens */}
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="AdminVendorApplications" component={AdminVendorApplicationsScreen} />
        <Stack.Screen name="AdminStallsManagement" component={AdminStallsManagementScreen} />
        <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
        
        {/* Customer / Guest App - FIXED: using component prop instead of children */}
        <Stack.Screen name="App">
          {(props) => <AppStack {...props} isGuest={isGuest} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Helper function to reset to login screen
// Helper function to reset to login screen
export const resetToLogin = () => {
  console.log('🔄 resetToLogin called, ref exists:', !!navigationContainerRef);
  
  if (navigationContainerRef) {
    navigationContainerRef.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
    console.log('✅ Reset to Login executed');
  } else {
    console.log('❌ navigationContainerRef is null!');
  }
};
// Main App Export
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    position: 'relative',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  navBadge: {
    position: 'absolute',
    top: 0,
    right: '20%',
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  guestBanner: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  guestBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  guestBannerSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  welcomeSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryCard: {
    alignItems: 'center',
    width: 80,
  },
  categoryGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryIcon: {
    fontSize: 32,
  },
  categoryName: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '500',
  },
  productsScroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  productCard: {
    width: width * 0.45,
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  productImageContainer: {
    position: 'relative',
  },
  productImagePlaceholder: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productEmoji: {
    fontSize: 40,
  },
  productBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  productBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.primary,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 6,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productStall: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingStar: {
    fontSize: 12,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterScroll: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: 'white',
  },
  stallsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  stallCard: {
    width: (width - 44) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  stallGradient: {
    padding: 16,
  },
  stallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stallNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  stallRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  stallRatingStar: {
    fontSize: 12,
  },
  stallRatingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  stallName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  stallSectionBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  stallSectionText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  stallDescription: {
    fontSize: 12,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
  viewAllButton: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  viewAllGradient: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewAllText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});