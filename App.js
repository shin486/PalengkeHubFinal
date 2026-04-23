import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { NavigationContainer, useNavigation, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { Header } from './src/components/Header'; 
import { LoadingSpinner } from './src/components/LoadingSpinner';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { SignUpScreen } from './src/screens/auth/SignUpScreen';
import NotificationScreen from './src/screens/customer/NotificationScreen';
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
import ChatListScreen from './src/screens/customer/ChatListScreen';
import ChatDetailScreen from './src/screens/customer/ChatDetailScreen';
import VendorChatDetailScreen from './src/screens/vendor/VendorChatDetailScreen';
import { useCart } from './src/hooks/useCart';

// ✅ NEW: Customer Report Screens
import ReportIssueScreen from './src/screens/customer/ReportIssueScreen';
import CustomerReportsScreen from './src/screens/customer/CustomerReportsScreen';

// ✅ NEW: Vendor Report Screens
import VendorReportIssueScreen from './src/screens/vendor/VendorReportIssueScreen';
import VendorReportsListScreen from './src/screens/vendor/VendorReportsListScreen';

// ✅ IMPORT THE REDESIGNED HOMESCREEN
import HomeScreen from './src/screens/customer/HomeScreen';

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

// Main App Stack Navigator (Customer)
function AppStack({ isGuest }) {
  const { cartCount } = useCart();
  const navigation = useNavigation();
  const currentRoute = useCurrentRoute();
  
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        setUnreadCount(count || 0);
      }
    };
    fetchUnreadCount();
  }, []);

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
      case 'ChatList':
        return { title: '💬 Messages', subtitle: 'Chat with stalls' };
      case 'ChatDetail':
        return { title: '💬 Chat', subtitle: 'Conversation' };
      case 'Notifications':
        return { title: '🔔 Notifications', subtitle: 'Your alerts' };
      case 'ReportIssue':
        return { title: '🚩 Report Issue', subtitle: 'Help us improve' };
      case 'CustomerReports':
        return { title: '📋 My Reports', subtitle: 'Track your reports' };
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
        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
        <Stack.Screen name="StallDetails" component={StallDetailsScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="StallsDirectory" component={StallsDirectoryScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Notifications" component={NotificationScreen} />
        <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
        
        {/* ✅ NEW: Customer Report Screens */}
        <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
        <Stack.Screen name="CustomerReports" component={CustomerReportsScreen} />
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
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('ChatList')}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navText}>Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.navIcon}>🔔</Text>
          <Text style={styles.navText}>Alerts</Text>
          {unreadCount > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
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

// Root Navigator
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
        <Stack.Screen name="VendorChatDetail" component={VendorChatDetailScreen} />
        
        {/* ✅ NEW: Vendor Report Screens */}
        <Stack.Screen name="VendorReportIssue" component={VendorReportIssueScreen} />
        <Stack.Screen name="VendorReportsList" component={VendorReportsListScreen} />
        
        {/* Admin screens */}
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="AdminVendorApplications" component={AdminVendorApplicationsScreen} />
        <Stack.Screen name="AdminStallsManagement" component={AdminStallsManagementScreen} />
        <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
        
        {/* Customer / Guest App */}
        <Stack.Screen name="App">
          {(props) => <AppStack {...props} isGuest={isGuest} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

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
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
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
});