// App.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { I18nProvider } from './src/contexts/i18nContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { registerPushToken, setupNotificationListeners } from './src/services/notificationService';
import { Header } from './src/components/Header'; 
import { LoadingSpinner } from './src/components/LoadingSpinner';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { SignUpScreen } from './src/screens/auth/SignUpScreen';
import NotificationScreen from './src/screens/customer/NotificationScreen';
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import AdminVendorApplicationsScreen from './src/screens/admin/AdminVendorApplicationsScreen';
import AdminStallsManagementScreen from './src/screens/admin/AdminStallsManagementScreen';
import AdminStallDetailsScreen from './src/screens/admin/AdminStallDetailsScreen';
import AdminReportsScreen from './src/screens/admin/AdminReportsScreen';
import AdminAuditTrailScreen from './src/screens/admin/AdminAuditTrailScreen';
import AdminPriceMonitoringScreen from './src/screens/admin/AdminPriceMonitoringScreen';
import HelpSupportScreen from './src/screens/shared/HelpSupportScreen';
import PrivacyPolicyScreen from './src/screens/shared/PrivacyPolicyScreen';
import VendorDashboardScreen from './src/screens/vendor/VendorDashboardScreen';
import VendorOrdersScreen from './src/screens/vendor/VendorOrdersScreen';
import VendorOrderDetailScreen from './src/screens/vendor/VendorOrderDetailScreen';
import VendorProductsScreen from './src/screens/vendor/VendorProductsScreen';
import VendorReportsScreen from './src/screens/vendor/VendorReportsScreen';
import VendorNotificationsScreen from './src/screens/vendor/VendorNotificationsScreen';
import VendorProfileScreen from './src/screens/vendor/VendorProfileScreen';
import VendorBottomNavigation from './src/components/vendor/VendorBottomNavigation';
import ProductDetailsScreen from './src/screens/customer/ProductDetailsScreen';
import StallsDirectoryScreen from './src/screens/customer/StallsDirectoryScreen';
import StallDetailsScreen from './src/screens/customer/StallDetailsScreen';
import CartScreen from './src/screens/customer/CartScreen';
import SearchScreen from './src/screens/customer/SearchScreen';
import OrdersScreen from './src/screens/customer/OrdersScreen';
import ProfileScreen from './src/screens/customer/ProfileScreen';
import FavoritesScreen from './src/screens/customer/FavoritesScreen';
import CheckoutScreen from './src/screens/customer/CheckoutScreen';
import PickupPassScreen from './src/screens/customer/PickupPassScreen';
import CategoryProductsScreen from './src/screens/customer/CategoryProductsScreen';
import ChatListScreen from './src/screens/customer/ChatListScreen';
import ChatDetailScreen from './src/screens/customer/ChatDetailScreen';
import VendorChatDetailScreen from './src/screens/vendor/VendorChatDetailScreen';
import VendorChatListScreen from './src/screens/vendor/VendorChatListScreen';
import VendorPromotionsScreen from './src/screens/vendor/VendorPromotionsScreen';
import { useCart } from './src/hooks/useCart';
import VendorRatingsScreen from './src/screens/vendor/VendorRatingsScreen';

// Customer Report Screens
import ReportIssueScreen from './src/screens/customer/ReportIssueScreen';
import CustomerReportsScreen from './src/screens/customer/CustomerReportsScreen';

// Vendor Report Screens
import VendorReportIssueScreen from './src/screens/vendor/VendorReportIssueScreen';
import VendorReportsListScreen from './src/screens/vendor/VendorReportsListScreen';

// Import the redesigned HomeScreen
import HomeScreen from './src/screens/customer/HomeScreen';

// Import the redesigned BottomNavigation
import BottomNavigation from './src/components/BottomNavigation';

const { width } = Dimensions.get('window');
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const colors = {
  primary: '#C62828',
  secondary: '#E53935',
  accent: '#FFEBEE',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8F9FB',
  surface: '#FFFFFF',
  text: {
    primary: '#1F2937',
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
    console.log(' ERROR CAUGHT:', error);
    console.log(' ERROR INFO:', errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'red', marginBottom: 20 }}>
 Error Detected
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

// Helper to get the active route name from a navigation state
function getActiveRouteName(state) {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name;
}

// ============================================================
// CUSTOMER BOTTOM TAB NAVIGATOR
// ============================================================
function CustomerTabNavigator({ isGuest, onRouteChange }) {
  const { cartCount } = useCart();
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    const fetchUnreadChatCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('conversations')
          .select('id, customer_unread_count')
          .eq('customer_id', user.id)
          .gt('customer_unread_count', 0);
        
        if (!error && data) {
          const total = data.reduce((sum, conv) => sum + (conv.customer_unread_count || 0), 0);
          setUnreadChatCount(total);
        }
      }
    };
    fetchUnreadChatCount();

    const channel = supabase
      .channel('chat-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => fetchUnreadChatCount()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => fetchUnreadChatCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => (
        <BottomNavigation
          {...props}
          cartCount={cartCount}
          unreadChatCount={unreadChatCount}
        />
      )}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        initialParams={{ isGuest }}
        listeners={{
          focus: () => onRouteChange?.('Home')
        }}
      />
      <Tab.Screen 
        name="Cart" 
        component={CartScreen}
        listeners={{
          focus: () => onRouteChange?.('Cart')
        }}
      />
      <Tab.Screen 
        name="Orders" 
        component={OrdersScreen}
        listeners={{
          focus: () => onRouteChange?.('Orders')
        }}
      />
      <Tab.Screen 
        name="Chats" 
        component={ChatListScreen}
        listeners={{
          focus: () => onRouteChange?.('Chats')
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        listeners={{
          focus: () => onRouteChange?.('Profile')
        }}
      />
    </Tab.Navigator>
  );
}

// ============================================================
// VENDOR BOTTOM TAB NAVIGATOR
// ============================================================
function VendorTabNavigator() {
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get stall
      const { data: stall } = await supabase
        .from('stalls')
        .select('id')
        .eq('vendor_id', user.id)
        .single();

      if (stall) {
        const { count: pending } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('stall_id', stall.id)
          .eq('status', 'pending');
        setPendingCount(pending || 0);

        const { data: convs } = await supabase
          .from('conversations')
          .select('vendor_unread_count')
          .eq('stall_id', stall.id)
          .gt('vendor_unread_count', 0);
        const total = (convs || []).reduce((sum, c) => sum + (c.vendor_unread_count || 0), 0);
        setUnreadChatCount(total);
      }
    };
    fetchCounts();

    const channel = supabase
      .channel('vendor-tab-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchCounts())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true }}
      tabBar={(props) => (
        <VendorBottomNavigation
          {...props}
          pendingCount={pendingCount}
          unreadChatCount={unreadChatCount}
        />
      )}
    >
      <Tab.Screen name="VendorDashboard" component={VendorDashboardScreen} />
      <Tab.Screen name="VendorOrders" component={VendorOrdersScreen} />
      <Tab.Screen name="VendorProducts" component={VendorProductsScreen} />
      <Tab.Screen name="VendorChats" component={VendorChatListScreen} />
      <Tab.Screen name="VendorProfile" component={VendorProfileScreen} />
    </Tab.Navigator>
  );
}

// ============================================================
// MAIN APP STACK
// ============================================================
function AppStack({ isGuest }) {
  const [activeRouteName, setActiveRouteName] = useState('Home');
  const { user } = useAuth();
  const navigation = useNavigation();
  const [unreadCount, setUnreadCount] = useState(0);

  //  Expose setActiveRouteName globally so screens can update the header visibility
  useEffect(() => {
    global.setActiveRouteName = setActiveRouteName;
    global.updateRouteName = setActiveRouteName;
    return () => {
      delete global.setActiveRouteName;
      delete global.updateRouteName;
    };
  }, []);

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

    // Register push notifications
    if (user && !isGuest) {
      registerPushToken(user.id);
    }

    // Setup notification listeners for navigation
    const cleanup = setupNotificationListeners(null, (response) => {
      const data = response.notification.request.content.data;
      if (data.type === 'order_update') {
        navigation.navigate('Orders');
      } else if (data.type === 'promotion' && data.stallId) {
        navigation.navigate('StallDetails', { stallId: data.stallId });
      } else if (data.type === 'chat') {
        navigation.navigate('ChatList');
      }
    });

    return cleanup;
  }, []);

  //  Updated: All screens that should hide the header
  const getHeaderProps = () => {
    const routeName = activeRouteName;
    
    // Complete list of screens where header should be hidden
    const hiddenScreens = [
      'Home',
      'ChatDetail',
      'ChatList',
      'StallDetails',
      'ProductDetails',
      'Search',
      'CategoryProducts',
    ];
    
    const isHeaderHidden = hiddenScreens.includes(routeName);
    
    if (isHeaderHidden) {
      console.log(' Hiding header on:', routeName);
      return null;
    }
    
    console.log(' Showing header on:', routeName);
    
    switch (routeName) {
      case 'Cart':
        return { title: 'My PalengKart', subtitle: '' };
      case 'Orders':
        return { title: 'My Orders', subtitle: 'Track your orders here' };
      case 'Chats':
        return { title: 'Messages', subtitle: 'Your conversations' };
      case 'Profile':
        return { title: 'My Profile', subtitle: 'Manage your account' };
      case 'StallsDirectory':
        return { title: 'Stalls Directory', subtitle: 'Browse all market stalls' };
      case 'Favorites':
        return { title: 'Favorites', subtitle: 'Your saved products and stalls' };
      case 'Notifications':
        return { title: 'Notifications', subtitle: 'Your alerts' };
      case 'ReportIssue':
        return { title: 'Report Issue', subtitle: 'Help us improve' };
      case 'CustomerReports':
        return { title: 'My Reports', subtitle: 'Track your reports' };
      default:
        return { title: 'PalengkeHub', subtitle: 'Lipa City Public Market' };
    }
  };

  const headerProps = getHeaderProps();

  console.log(' AppStack - activeRouteName:', activeRouteName);
  console.log(' AppStack - headerProps:', headerProps);

  return (
    <View style={styles.container}>
      {/*  Only show global Header if NOT on hidden screens */}
      {headerProps && (
        <Header title={headerProps.title} subtitle={headerProps.subtitle} />
      )}
      
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'none' }}
        onStateChange={(state) => {
          const routeName = getActiveRouteName(state);
          console.log(' StackNavigator - route changed to:', routeName);
          //  Update activeRouteName for ALL routes, including MainTabs
          setActiveRouteName(routeName);
        }}
      >
        <Stack.Screen name="MainTabs">
          {props => (
            <CustomerTabNavigator
              {...props}
              isGuest={isGuest}
              onRouteChange={(tabName) => {
                console.log(' Tab changed to:', tabName);
                setActiveRouteName(tabName);
              }}
            />
          )}
        </Stack.Screen>
        
        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
        <Stack.Screen name="StallDetails" component={StallDetailsScreen} />
        <Stack.Screen name="StallsDirectory" component={StallsDirectoryScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="PickupPass" component={PickupPassScreen} />
        <Stack.Screen name="Notifications" component={NotificationScreen} />
        <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
        
        <Stack.Screen 
          name="ChatDetail" 
          component={ChatDetailScreen} 
          options={{ headerShown: false }}
        />
        
        <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
        <Stack.Screen name="CustomerReports" component={CustomerReportsScreen} />
                <Stack.Screen name="Favorites" component={FavoritesScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      </Stack.Navigator>
    </View>
  );
}

// Global navigation ref
let navigationContainerRef = null;

// ============================================================
// ROOT NAVIGATOR
// ============================================================
function RootNavigator() {
  const { user, loading, isGuest, setIsGuest, profile } = useAuth();

  // Android hardware back button / gesture: navigate back INSIDE the app instead
  // of closing it. The app runs as a web bundle inside a Capacitor WebView which
  // has no browser history, so without this listener the system back button
  // exits the app instead of going to the previous screen.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handlePromise = CapacitorApp.addListener('backButton', () => {
      if (
        navigationContainerRef &&
        navigationContainerRef.isReady() &&
        navigationContainerRef.canGoBack()
      ) {
        navigationContainerRef.goBack();
      } else {
        // At the root screen - exit the app (standard Android behavior)
        CapacitorApp.exitApp();
      }
    });

    return () => {
      if (handlePromise && typeof handlePromise.then === 'function') {
        handlePromise
          .then((handle) => {
            if (handle && handle.remove) handle.remove();
          })
          .catch(() => {});
      }
    };
  }, []);

  console.log(' RootNavigator - isGuest:', isGuest, 'user:', user?.email, 'role:', profile?.role);

  useEffect(() => {
    if (isGuest && global.navigationRef) {
      console.log(' Guest mode activated - navigating to App');
      global.navigationRef.reset({
        index: 0,
        routes: [{ name: 'App' }],
      });
    }
  }, [isGuest]);

  useEffect(() => {
    if (loading || !user || !global.navigationRef) return;

    const target =
      profile?.role === 'admin' ? 'AdminDashboard'
      : profile?.role === 'vendor' ? 'VendorDashboard'
      : 'App';

    console.log(' Redirecting authenticated user to:', target);

    global.navigationRef.reset({
      index: 0,
      routes: [{ name: target }],
    });
  }, [user, profile, loading]);

  if (loading) {
    return <LoadingSpinner />;
  }

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
        console.log(' NavigationContainer ref set');
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
        <Stack.Screen name="VendorDashboard" component={VendorTabNavigator} />
        <Stack.Screen name="VendorOrderDetail" component={VendorOrderDetailScreen} />
        <Stack.Screen name="VendorReports" component={VendorReportsScreen} />
        <Stack.Screen name="VendorNotifications" component={VendorNotificationsScreen} />
        <Stack.Screen name="VendorChatDetail" component={VendorChatDetailScreen} />
        <Stack.Screen name="VendorPromotions" component={VendorPromotionsScreen} />

        <Stack.Screen name="VendorRatings" component={VendorRatingsScreen} />
        <Stack.Screen name="VendorReportIssue" component={VendorReportIssueScreen} />
        <Stack.Screen name="VendorReportsList" component={VendorReportsListScreen} />
        
                {/* Shared screens (Customer + Vendor) */}
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />

        {/* Admin screens */}
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="AdminVendorApplications" component={AdminVendorApplicationsScreen} />
        <Stack.Screen name="AdminStallsManagement" component={AdminStallsManagementScreen} />
        <Stack.Screen name="AdminStallDetails" component={AdminStallDetailsScreen} />
        <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
        <Stack.Screen name="AdminAuditTrail" component={AdminAuditTrailScreen} />
        <Stack.Screen name="AdminPriceMonitoring" component={AdminPriceMonitoringScreen} />
        
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
  console.log(' resetToLogin called, ref exists:', !!navigationContainerRef);
  
  if (navigationContainerRef) {
    navigationContainerRef.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
    console.log(' Reset to Login executed');
  } else {
    console.log(' navigationContainerRef is null!');
  }
};

// ============================================================
// MAIN APP EXPORT
// ============================================================
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <I18nProvider>
            <ThemeProvider>
              <CartProvider>
                <RootNavigator />
              </CartProvider>
            </ThemeProvider>
          </I18nProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});