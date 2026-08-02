// src/screens/vendor/VendorDashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  FlatList,
  Image,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { supabase } from '../../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorProducts } from '../../hooks/useVendorProducts';
import { useVendorOrders } from '../../hooks/useVendorOrders';
import { ProductCard } from '../../components/vendor/ProductCard';
import { OrderCard } from '../../components/vendor/OrderCard';
import { AddProductModal } from '../../components/vendor/AddProductModal';
import { SalesChart } from '../../components/vendor/SalesChart';
import { Header } from '../../components/Header';

const { width } = Dimensions.get('window');

const IMGBB_API_KEY = '0f4823dff292c1d4c4a6fdcc7d0037c9';

// Helper for status colors
const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return '#F59E0B';
    case 'confirmed': return '#3B82F6';
    case 'preparing': return '#8B5CF6';
    case 'ready': return '#10B981';
    case 'completed': return '#6B7280';
    case 'cancelled': return '#EF4444';
    default: return '#6B7280';
  }
};

// Helper to get order progress
const getOrderProgress = (status) => {
  const steps = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
  const index = steps.indexOf(status);
  if (index === -1) return 0;
  return (index / (steps.length - 1)) * 100;
};

const getUnitDisplayName = (unit) => {
    switch (unit) {
      case 'kg': return 'kg';
      case '500g': return '500g';
      case '250g': return '250g';
      case 'piece': return 'piece';
      case 'bundle': return 'bundle';
      case 'dozen': return 'dozen';
      case 'pack': return 'pack';
      default: return unit;
    }
  };

export default function VendorDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [stall, setStall] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
const [uploadingStallImage, setUploadingStallImage] = useState(false);
const [stallImageError, setStallImageError] = useState(false);
  const [loadingStall, setLoadingStall] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [salesData, setSalesData] = useState([]);
  
  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [salesSummary, setSalesSummary] = useState({
    today: 0, week: 0, month: 0, total: 0,
    ordersToday: 0, ordersWeek: 0, ordersMonth: 0
  });
  const [reportStats, setReportStats] = useState({ pending: 0, total: 0 });
  
  // Customer History (Suki)
  const [frequentCustomers, setFrequentCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
  // Promotions state
  const [promotions, setPromotions] = useState([]);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [productsList, setProductsList] = useState([]);
  const [newPromo, setNewPromo] = useState({
    product_id: '',
    discount_type: 'percentage',
    discount_value: '',
    end_date: '',
  });
  
  // Sales Analytics
  const [bestSellingProducts, setBestSellingProducts] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Reports
  const [reportPeriod, setReportPeriod] = useState('week');
  const [reportData, setReportData] = useState([]);
  const [exporting, setExporting] = useState(false);
  
  // Pause Orders
  const [isPaused, setIsPaused] = useState(false);
  const [pausing, setPausing] = useState(false);
  
  // Rating Insights Stats
  const [ratingStats, setRatingStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    positivePercentage: 0,
    ratedProducts: 0
  });
  
 // Improved Propose Change state
const [proposeModalVisible, setProposeModalVisible] = useState(false);
const [selectedOrder, setSelectedOrder] = useState(null);
const [selectedItemId, setSelectedItemId] = useState(null);
const [proposedUnit, setProposedUnit] = useState('');
const [proposedQuantity, setProposedQuantity] = useState('');
const [proposalNotes, setProposalNotes] = useState('');
const [availableUnits, setAvailableUnits] = useState([]);
const [unitPrices, setUnitPrices] = useState({});
const [submittingProposal, setSubmittingProposal] = useState(false);
  
  // Order tab state
  const [orderStatusTab, setOrderStatusTab] = useState('pending');

  // Fetch stall
  useEffect(() => {
    if (user) fetchStall();
  }, [user]);

  const fetchStall = async () => {
    try {
      setLoadingStall(true);
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .eq('vendor_id', user?.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setStall(data);
    } catch (error) {
      console.error('Error fetching stall:', error);
    } finally {
      setLoadingStall(false);
    }
  };

  // Add this function - Stall Image Upload using ImgBB
  const uploadStallImage = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please grant gallery permissions to upload stall image');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.8,
  });

  if (!result.canceled) {
    setUploadingStallImage(true);
    try {
      const uri = result.assets[0].uri;
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const formData = new FormData();
      formData.append('image', base64);
      
      const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
        params: { key: IMGBB_API_KEY },
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const stallImageUrl = uploadResponse.data.data.url;
      console.log('✅ Stall image uploaded:', stallImageUrl);
      
      const { error } = await supabase
        .from('stalls')
        .update({ image_url: stallImageUrl })
        .eq('id', stall.id);
      
      if (error) throw error;
      
      setStallImageError(false);
      await fetchStall();
      Alert.alert('Success', 'Stall image updated!');
      
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploadingStallImage(false);
    }
  }
};
// Add this function - Vendor Avatar Upload using ImgBB

const uploadVendorAvatar = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please grant gallery permissions to upload profile picture');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (!result.canceled) {
    setUploadingAvatar(true);
    try {
      const uri = result.assets[0].uri;
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const formData = new FormData();
      formData.append('image', base64);
      
      const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
        params: { key: IMGBB_API_KEY },
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const avatarUrl = uploadResponse.data.data.url;
      console.log('✅ Vendor avatar uploaded:', avatarUrl);
      
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Refresh stall data to update profile info
      await fetchStall();
      
      Alert.alert('Success', 'Profile picture updated!');
      
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploadingAvatar(false);
    }
  }
};

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoadingNotifications(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setNotifications(data || []);
      
      const unreadCount = data?.filter(n => !n.is_read).length || 0;
      setNotificationUnreadCount(unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  }, [user]);

  const markNotificationRead = async (notificationId) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setNotificationUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setNotificationUnreadCount(0);
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Error marking all read:', error);
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const fetchReportStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('vendor_reports')
        .select('status')
        .eq('vendor_id', user.id);
      if (error) throw error;
      const pending = data?.filter(r => r.status === 'pending').length || 0;
      setReportStats({ pending, total: data?.length || 0 });
    } catch (error) {
      console.error('Error fetching report stats:', error);
    }
  }, [user]);


  const fetchAvailableProducts = useCallback(async () => {
  if (!stall?.id) return;
  const { data } = await supabase
    .from('products')
    .select('id, name, price, unit')
    .eq('stall_id', stall.id)
    .eq('is_available', true);
  setAvailableProducts(data || []);
}, [stall]);

  const fetchChats = useCallback(async () => {
    if (!stall?.id) return;
    try {
      setLoadingChats(true);
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`*, customer:customer_id (id, full_name, email)`)
        .eq('stall_id', stall.id)
        .order('updated_at', { ascending: false });
      if (convError) throw convError;
      if (!conversations || conversations.length === 0) {
        setChats([]);
        setUnreadCount(0);
        setLoadingChats(false);
        return;
      }
      const processedChats = conversations.map((conv) => {
        const customerData = conv.customer;
        const customerName = customerData?.full_name ||
          customerData?.email?.split('@')[0] ||
          `Customer_${conv.customer_id?.slice(-4)}`;
        return {
          id: conv.id,
          customer_id: conv.customer_id,
          customer_name: customerName,
          last_message: conv.last_message || 'No messages yet',
          last_message_time: conv.last_message_time,
          unread_count: conv.vendor_unread_count || 0,
          updated_at: conv.updated_at,
        };
      });
      setChats(processedChats);
      const totalUnread = processedChats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoadingChats(false);
    }
  }, [stall]);

  const fetchSalesData = useCallback(async () => {
    if (!stall?.id) return;
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('stall_id', stall.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: true });
      if (!orders) return;

      const startOfDay = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const now = new Date();
      const todayStart = startOfDay(now);
      const weekAgoStart = startOfDay(new Date(now));
      weekAgoStart.setDate(weekAgoStart.getDate() - 6);
      const monthAgoStart = startOfDay(new Date(now));
      monthAgoStart.setMonth(monthAgoStart.getMonth() - 1);

      const todayOrders = orders.filter(o => startOfDay(new Date(o.created_at)).getTime() === todayStart.getTime());
      const weekOrders = orders.filter(o => startOfDay(new Date(o.created_at)) >= weekAgoStart);
      const monthOrders = orders.filter(o => startOfDay(new Date(o.created_at)) >= monthAgoStart);

      setSalesSummary({
        today: todayOrders.reduce((sum, o) => sum + o.total_amount, 0),
        week: weekOrders.reduce((sum, o) => sum + o.total_amount, 0),
        month: monthOrders.reduce((sum, o) => sum + o.total_amount, 0),
        total: orders.reduce((sum, o) => sum + o.total_amount, 0),
        ordersToday: todayOrders.length,
        ordersWeek: weekOrders.length,
        ordersMonth: monthOrders.length,
      });

      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = startOfDay(date);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const dayOrders = orders.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= dayStart && orderDate < dayEnd;
        });
        const dayTotal = dayOrders.reduce((sum, o) => sum + o.total_amount, 0);
        last7Days.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sales: dayTotal,
          orders: dayOrders.length,
        });
      }
      setSalesData(last7Days);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    }
  }, [stall]);

  const {
    products,
    loading: productsLoading,
    addProduct,
    updateProduct,
    toggleAvailability,
    deleteProduct,
    refreshProducts,
  } = useVendorProducts(stall?.id);

  const {
    orders,
    loading: ordersLoading,
    orderStats,
    updateOrderStatus: originalUpdateOrderStatus,
    refreshOrders,
  } = useVendorOrders(stall?.id);

  const handleUpdateOrderStatus = async (order, newStatus) => {
    await originalUpdateOrderStatus(order, newStatus);
    await fetchSalesData();
    await refreshOrders();
  };

  const handleRequestPayment = async (order) => {
  try {
    let { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('customer_id', order.consumer_id)
      .eq('stall_id', order.stall_id)
      .maybeSingle();

    let conversationId;
    if (conversation) {
      conversationId = conversation.id;
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          customer_id: order.consumer_id,
          stall_id: order.stall_id,
          last_message: `💰 Payment request for Order #${order.order_number?.slice(-8)}`,
          last_message_time: new Date(),
          vendor_unread_count: 1,
        })
        .select()
        .single();
      if (convError) throw convError;
      conversationId = newConv.id;
    }

    if (conversationId) {
      const paymentMessage = `💳 **PAYMENT REQUEST**\n\nOrder #${order.order_number?.slice(-8)}\nTotal Amount: ₱${order.total_amount}\n\nPlease send payment to GCash: **09XX-XXX-XXXX**\n\nAfter payment, send screenshot here.`;
      
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_role: 'vendor',
        message: paymentMessage,
        is_read: false,
      });

      await supabase
        .from('conversations')
        .update({
          last_message: paymentMessage,
          last_message_time: new Date(),
          customer_unread_count: 1,
        })
        .eq('id', conversationId);
    }

    // ✅ FIX: Change to 'confirmed' instead of 'awaiting_payment'
    await originalUpdateOrderStatus(order.id, 'confirmed');
    
    Alert.alert('Success', 'Payment request sent to customer');
  } catch (error) {
    console.error('Request payment error:', error);
    Alert.alert('Error', 'Failed to send payment request');
  }
};

  const handleRejectOrder = async (orderId, reasonId, finalMessage) => {
    try {
      await originalUpdateOrderStatus(orderId, 'cancelled');
      const order = orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');

      let { data: conversation } = await supabase
        .from('conversations')
        .select('id, vendor_unread_count')
        .eq('customer_id', order.consumer_id)
        .eq('stall_id', order.stall_id)
        .maybeSingle();

      let conversationId;
      if (conversation) {
        conversationId = conversation.id;
        await supabase
          .from('conversations')
          .update({
            last_message: `❌ Order cancelled: ${finalMessage}`,
            last_message_time: new Date(),
            vendor_unread_count: (conversation.vendor_unread_count || 0) + 1,
          })
          .eq('id', conversationId);
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            customer_id: order.consumer_id,
            stall_id: order.stall_id,
            last_message: `❌ Order cancelled: ${finalMessage}`,
            last_message_time: new Date(),
            vendor_unread_count: 1,
          })
          .select()
          .single();
        if (convError) throw convError;
        conversationId = newConv.id;
      }

      const messageText = `❌ Order #${order.order_number?.slice(-8)} cancelled: ${finalMessage}`;
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_role: 'vendor',
        message: messageText,
        is_read: false,
      });

      await supabase.from('notifications').insert({
        user_id: order.consumer_id,
        title: 'Order Cancelled ❌',
        message: `Your order #${order.order_number?.slice(-8)} was cancelled. Reason: ${finalMessage}`,
        type: 'order',
        data: { order_id: order.id, type: 'cancellation' },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      await refreshOrders();
      await fetchSalesData();
      await fetchChats();
      Alert.alert('Order Rejected', 'The order has been cancelled and the customer has been notified via chat and notification.');
    } catch (error) {
      console.error('Rejection error:', error);
      Alert.alert('Error', error.message || 'Failed to reject order');
      throw error;
    }
  };

  const fetchRatingStats = useCallback(async () => {
    if (!stall?.id) return;
    try {
      const { data: ratings, error } = await supabase
        .from('ratings')
        .select('rating, product_id')
        .eq('stall_id', stall.id);

      if (error) throw error;
      if (!ratings || ratings.length === 0) {
        setRatingStats({
          averageRating: 0,
          totalReviews: 0,
          positivePercentage: 0,
          ratedProducts: 0
        });
        return;
      }

      const totalReviews = ratings.length;
      const sumRatings = ratings.reduce((acc, r) => acc + r.rating, 0);
      const averageRating = sumRatings / totalReviews;
      const positiveCount = ratings.filter(r => r.rating >= 4).length;
      const positivePercentage = (positiveCount / totalReviews) * 100;
      const uniqueProducts = new Set(ratings.map(r => r.product_id).filter(id => id));
      const ratedProducts = uniqueProducts.size;

      setRatingStats({
        averageRating: averageRating.toFixed(1),
        totalReviews,
        positivePercentage: Math.round(positivePercentage),
        ratedProducts
      });
    } catch (error) {
      console.error('Error fetching rating stats:', error);
    }
  }, [stall]);

  const fetchProductUnitPrices = useCallback(async (productId) => {
  const { data } = await supabase
    .from('products')
    .select('price, price_options, unit_options')
    .eq('id', productId)
    .single();
  
  if (data) {
    const units = data.unit_options || ['kg', '500g', '250g', 'piece'];
    const prices = data.price_options || {};
    
    // If no custom price for a unit, calculate using multiplier
    const multipliers = {
      'kg': 1, '500g': 2, '250g': 4,
      'piece': 0.25, 'bundle': 0.35, 'dozen': 2.4, 'pack': 0.8
    };
    
    units.forEach(unit => {
      if (!prices[unit]) {
        const multiplier = multipliers[unit] || 1;
        prices[unit] = data.price * multiplier;
      }
    });
    
    setAvailableUnits(units);
    setUnitPrices(prices);
  }
}, []);

  const fetchProductsForPromo = useCallback(async () => {
    if (!stall?.id) return;
    const { data } = await supabase
      .from('products')
      .select('id, name, price')
      .eq('stall_id', stall.id)
      .eq('is_available', true);
    setProductsList(data || []);
  }, [stall]);

  const fetchPromotions = useCallback(async () => {
    if (!stall?.id) return;
    const { data } = await supabase
      .from('promotions')
      .select(`*, product:product_id (id, name, price, unit)`)
      .eq('stall_id', stall.id)
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false });
    setPromotions(data || []);
  }, [stall]);

  const fetchBestSellingProducts = useCallback(async () => {
    if (!stall?.id) return;
    try {
      setAnalyticsLoading(true);
      const { data: orders } = await supabase
        .from('orders')
        .select('items')
        .eq('stall_id', stall.id)
        .eq('status', 'completed');
      
      if (!orders || orders.length === 0) return;
      
      const productSales = {};
      orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (productSales[item.id]) {
              productSales[item.id].quantity += item.quantity;
              productSales[item.id].revenue += item.price * item.quantity;
            } else {
              productSales[item.id] = {
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                revenue: item.price * item.quantity
              };
            }
          });
        }
      });
      
      const sorted = Object.values(productSales).sort((a, b) => b.quantity - a.quantity);
      setBestSellingProducts(sorted.slice(0, 5));
      
      const { data: hourlyOrders } = await supabase
        .from('orders')
        .select('created_at')
        .eq('stall_id', stall.id)
        .eq('status', 'completed');
      
      if (hourlyOrders && hourlyOrders.length > 0) {
        const hourCounts = Array(24).fill(0);
        hourlyOrders.forEach(order => {
          const hour = new Date(order.created_at).getHours();
          hourCounts[hour]++;
        });
        const peakHourData = hourCounts.map((count, hour) => ({ hour, count }));
        setPeakHours(peakHourData);
      }
    } catch (error) {
      console.error('Error fetching best sellers:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [stall]);

  const fetchFrequentCustomers = useCallback(async () => {
    if (!stall?.id) return;
    try {
      setLoadingCustomers(true);
      const { data: orders, error } = await supabase
        .from('orders')
        .select('consumer_id, profiles(full_name, email)')
        .eq('stall_id', stall.id)
        .eq('status', 'completed');

      if (error) throw error;
      if (!orders || orders.length === 0) return;

      const customerCounts = {};
      orders.forEach(order => {
        const customerId = order.consumer_id;
        if (customerCounts[customerId]) {
          customerCounts[customerId].count++;
        } else {
          customerCounts[customerId] = {
            id: customerId,
            name: order.profiles?.full_name || 'Customer',
            email: order.profiles?.email,
            count: 1
          };
        }
      });

      const sorted = Object.values(customerCounts).sort((a, b) => b.count - a.count);
      setFrequentCustomers(sorted.slice(0, 5));
    } catch (error) {
      console.error('Error fetching frequent customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  }, [stall]);

  const fetchReportData = useCallback(async () => {
    if (!stall?.id) return;
    try {
      const now = new Date();
      let startDate;
      
      if (reportPeriod === 'day') {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
      } else if (reportPeriod === 'week') {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
      }
      
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('stall_id', stall.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });
      
      setReportData(orders || []);
    } catch (error) {
      console.error('Error fetching report data:', error);
    }
  }, [stall, reportPeriod]);

  const exportToCSV = async () => {
    if (reportData.length === 0) {
      Alert.alert('No Data', 'No orders to export');
      return;
    }
    
    setExporting(true);
    try {
      const csvRows = [
        ['Order #', 'Date', 'Status', 'Total Amount', 'Items']
      ];
      
      reportData.forEach(order => {
        const items = order.items?.map(i => `${i.name} (${i.quantity})`).join(', ') || '';
        csvRows.push([
          order.order_number || order.id,
          new Date(order.created_at).toLocaleDateString(),
          order.status,
          order.total_amount,
          items
        ]);
      });
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      const fileUri = FileSystem.documentDirectory + `sales_report_${reportPeriod}_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Export Ready', 'File saved locally');
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const togglePauseOrders = async () => {
    setPausing(true);
    try {
      const newStatus = !isPaused;
      const { error } = await supabase
        .from('stalls')
        .update({ is_temporarily_closed: newStatus })
        .eq('id', stall.id);
      
      if (error) throw error;
      
      setIsPaused(newStatus);
      Alert.alert(
        newStatus ? 'Store Paused' : 'Store Open',
        newStatus 
          ? 'Customers cannot place orders. Tap "Open" to resume.'
          : 'Your store is now open for orders.'
      );
    } catch (error) {
      console.error('Error toggling pause:', error);
      Alert.alert('Error', 'Failed to update store status');
    } finally {
      setPausing(false);
    }
  };

  const getCustomerOrderCount = useCallback(async (customerId) => {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('consumer_id', customerId)
      .eq('stall_id', stall.id)
      .eq('status', 'completed');
    return count || 0;
  }, [stall]);

  const handleCreatePromotion = async () => {
    console.log('Creating promotion with data:', newPromo);
    
    if (!newPromo.product_id) {
      Alert.alert('Error', 'Please select a product');
      return;
    }
    if (!newPromo.discount_value || parseFloat(newPromo.discount_value) <= 0) {
      Alert.alert('Error', 'Please enter a valid discount value');
      return;
    }
    if (!newPromo.end_date) {
      Alert.alert('Error', 'Please enter an expiry date (YYYY-MM-DD)');
      return;
    }

    const selectedProduct = productsList.find(p => p.id === newPromo.product_id);
    if (!selectedProduct) {
      Alert.alert('Error', 'Selected product not found');
      return;
    }

    const discountValue = parseFloat(newPromo.discount_value);
    const discountType = newPromo.discount_type;
    const originalPrice = selectedProduct.price;

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(newPromo.end_date)) {
      Alert.alert('Error', 'Please use YYYY-MM-DD format (e.g., 2025-12-31)');
      return;
    }
    const endDateObj = new Date(newPromo.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (endDateObj <= today) {
      Alert.alert('Error', 'End date must be in the future');
      return;
    }

    try {
      const { error } = await supabase.from('promotions').insert({
        stall_id: stall.id,
        product_id: newPromo.product_id,
        discount_type: discountType,
        discount_value: discountValue,
        original_price: originalPrice,
        end_date: endDateObj.toISOString(),
        is_active: true,
        start_date: new Date(Date.now() - 60 * 1000).toISOString(),
      });
      if (error) throw error;

      Alert.alert('Success', 'Promotion created successfully');
      setShowPromoModal(false);
      setNewPromo({ product_id: '', discount_type: 'percentage', discount_value: '', end_date: '' });
      await fetchPromotions();
    } catch (error) {
      console.error('Create promotion error:', error);
      Alert.alert('Error', error.message || 'Failed to create promotion');
    }
  };

  const handleDeletePromotion = async (promoId) => {
    Alert.alert('Delete Promotion', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('promotions').delete().eq('id', promoId);
          if (error) Alert.alert('Error', error.message);
          else fetchPromotions();
        }
      }
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      if (stall?.id) {
        fetchSalesData();
        fetchChats();
        fetchReportStats();
        fetchPromotions();
        fetchNotifications();
        fetchProductsForPromo();
        fetchBestSellingProducts();
        fetchFrequentCustomers();
        fetchRatingStats();  
      }
    }, [stall, fetchSalesData, fetchChats, fetchReportStats, fetchPromotions, fetchNotifications, fetchProductsForPromo, fetchBestSellingProducts, fetchFrequentCustomers, fetchRatingStats])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshProducts(),
      refreshOrders(),
      fetchStall(),
      fetchSalesData(),
      fetchChats(),
      fetchReportStats(),
      fetchPromotions(),
      fetchProductsForPromo(),
      fetchBestSellingProducts(),
      fetchFrequentCustomers(),
      fetchRatingStats()
    ]);
    setRefreshing(false);
  };

  const handleAddProduct = async (productData) => {
    const success = await addProduct(productData);
    if (success) setShowAddModal(false);
  };

const handleUpdateProduct = async (productData) => {
  console.log('🔵 handleUpdateProduct - FULL DATA:', JSON.stringify(productData, null, 2));
  console.log('🔵 handleUpdateProduct - IMAGE_URL:', productData.image_url);
  
  const success = await updateProduct(editingProduct.id, productData);
  if (success) setEditingProduct(null);
};

// Add this function - it's called when user taps Edit on a product
const handleEditProduct = (product) => {
  console.log('🔵 Editing product:', product.name);
  console.log('🔵 Product image_url:', product.image_url);
  setEditingProduct(product); // This passes the product data to the modal
};

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          if (Platform.OS === 'web') window.location.href = '/';
          else navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    ]);
  };

  const openChat = async (chat) => {
    try {
      const { data: customerProfile, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', chat.customer_id)
        .single();
      if (error) throw error;
      navigation.navigate('VendorChatDetail', {
        conversationId: chat.id,
        customer: {
          id: customerProfile.id,
          name: customerProfile.full_name || chat.customer_name,
          email: customerProfile.email,
          avatar: customerProfile.avatar_url,
        }
      });
    } catch (error) {
      navigation.navigate('VendorChatDetail', {
        conversationId: chat.id,
        customer: { id: chat.customer_id, name: chat.customer_name }
      });
    }
  };

const handleProposeChange = async (order) => {
  setSelectedOrder(order);
  setSelectedItemId(null);
  setProposedUnit('');
  setProposedQuantity('');
  setProposalNotes('');
  setProposeModalVisible(true);
};

const submitProposal = async () => {
  if (!selectedOrder || !selectedItemId || !proposedUnit || !proposedQuantity) {
    Alert.alert('Error', 'Please select item, unit, and quantity');
    return;
  }
  
  setSubmittingProposal(true);
  
  try {
    const selectedItem = selectedOrder.items.find(i => i.id === selectedItemId);
    if (!selectedItem) throw new Error('Item not found');
    
    const newQuantity = parseInt(proposedQuantity);
    if (isNaN(newQuantity) || newQuantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      setSubmittingProposal(false);
      return;
    }
    
    const unitPrice = unitPrices[proposedUnit];
    if (!unitPrice) {
      Alert.alert('Error', 'Price not available for selected unit');
      setSubmittingProposal(false);
      return;
    }
    
    const oldTotal = selectedItem.price * selectedItem.quantity;
    const newTotal = unitPrice * newQuantity;
    
    // Get or create conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('customer_id', selectedOrder.consumer_id)
      .eq('stall_id', selectedOrder.stall_id)
      .maybeSingle();
    
    let conversationId;
    if (conversation) {
      conversationId = conversation.id;
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          customer_id: selectedOrder.consumer_id,
          stall_id: selectedOrder.stall_id,
          last_message: `📝 Change proposal for Order #${selectedOrder.order_number?.slice(-8)}`,
          last_message_time: new Date(),
          vendor_unread_count: 1,
        })
        .select()
        .single();
      conversationId = newConv.id;
    }
    
    const proposalData = {
      item_id: selectedItem.id,
      item_name: selectedItem.name,
      original_quantity: selectedItem.quantity,
      original_unit: selectedItem.unit,
      original_price: oldTotal,
      proposed_quantity: newQuantity,
      proposed_unit: proposedUnit,
      proposed_price: newTotal,
      price_per_unit: unitPrice,
      notes: proposalNotes,
      status: 'pending'
    };
    
    await supabase
      .from('orders')
      .update({ proposed_changes: proposalData })
      .eq('id', selectedOrder.id);
    
    // Build proposal message
    let proposalMessage = `📝 **ORDER CHANGE PROPOSAL**\n\n`;
    proposalMessage += `**Item:** ${selectedItem.name}\n`;
    proposalMessage += `**Original:** ${selectedItem.quantity} ${selectedItem.unit} (₱${oldTotal.toFixed(2)})\n`;
    proposalMessage += `**Proposed:** ${newQuantity} x ${getUnitDisplayName(proposedUnit)} at ₱${unitPrice.toFixed(2)} each\n`;
    proposalMessage += `**New Total:** ₱${newTotal.toFixed(2)}`;
    
    const difference = newTotal - oldTotal;
    if (difference > 0) {
      proposalMessage += `\n**Additional:** ₱${difference.toFixed(2)}`;
    } else if (difference < 0) {
      proposalMessage += `\n**Savings:** ₱${Math.abs(difference).toFixed(2)}`;
    }
    
    if (proposalNotes) {
      proposalMessage += `\n\n**Note from vendor:** ${proposalNotes}`;
    }
    
    proposalMessage += `\n\nDo you accept this change?`;
    
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: 'vendor',
      message: proposalMessage,
      is_read: false,
      message_type: 'proposal',
      proposal_data: proposalData
    });
    
    await supabase
      .from('conversations')
      .update({
        last_message: proposalMessage,
        last_message_time: new Date(),
        customer_unread_count: 1,
      })
      .eq('id', conversationId);
    
    Alert.alert('Proposal Sent', 'The customer will be notified to accept or reject the change');
    setProposeModalVisible(false);
    setSelectedOrder(null);
    setSelectedItemId(null);
    setProposedUnit('');
    setProposedQuantity('');
    setProposalNotes('');
    
  } catch (error) {
    console.error('Proposal error:', error);
    Alert.alert('Error', 'Failed to send proposal');
  } finally {
    setSubmittingProposal(false);
  }
};

  if (loadingStall) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading your stall...</Text>
      </SafeAreaView>
    );
  }

  if (!stall) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>🏪</Text>
        <Text style={styles.emptyTitle}>No Stall Assigned</Text>
        <Text style={styles.emptyText}>Contact administrator to get your stall registered</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ----- Helper Components -----
const WelcomeHeader = () => {
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const timeGreeting = getTimeGreeting();
  const vendorName = profile?.full_name || 'Vendor';
  const firstLetter = vendorName.charAt(0).toUpperCase();

  return (
    <View style={styles.welcomeHeader}>
      <View style={styles.welcomeTopRow}>
        <View style={styles.profileImageContainer}>
          {profile?.avatar_url ? (
            <Image 
              source={{ uri: profile.avatar_url }} 
              style={styles.profileImage}
            />
          ) : (
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              style={styles.profileAvatarFallback}
            >
              <Text style={styles.profileAvatarText}>{firstLetter}</Text>
            </LinearGradient>
          )}
        </View>
        
        <View style={styles.greetingContainer}>
          <Text style={styles.welcomeGreeting}>{timeGreeting},</Text>
          <Text style={styles.welcomeName}>{vendorName}!</Text>
          <Text style={styles.welcomeSubtext}>Here's your store performance</Text>
        </View>
        
        <View style={styles.welcomeBadge}>
          <Text style={styles.welcomeBadgeText}>Stall #{stall.stall_number}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, { backgroundColor: isPaused ? '#EF4444' : '#10B981' }]} />
          <Text style={[styles.statusText, { color: isPaused ? '#EF4444' : '#10B981' }]}>
            {isPaused ? 'Store Closed' : 'Store Open'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.pauseToggle}
          onPress={togglePauseOrders}
          disabled={pausing}
        >
          <LinearGradient
            colors={isPaused ? ['#10B981', '#059669'] : ['#DC2626', '#EF4444']}
            style={styles.pauseToggleGradient}
          >
            <Text style={styles.pauseToggleText}>
              {pausing ? '...' : (isPaused ? 'Open Store' : 'Close Store')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      
      {isPaused && (
        <Text style={styles.closedWarningMessage}>
          ⚠️ Your store is closed. Customers cannot place orders.
        </Text>
      )}
    </View>
  );
};

  const StatCard = ({ title, value, icon, gradientColors, trend, trendValue, isCurrency = false }) => {
    let displayValue = value;
    if (typeof value === 'number') {
      displayValue = isCurrency ? `₱${value.toFixed(2)}` : value.toString();
    }
    return (
      <LinearGradient colors={gradientColors} style={styles.statCardModern}>
        <Text style={styles.statIconModern}>{icon}</Text>
        <Text style={styles.statValueModern}>{displayValue}</Text>
        <Text style={styles.statLabelModern}>{title}</Text>
        {trend && (
          <View style={[styles.statTrend, trendValue > 0 ? styles.trendPositive : styles.trendNegative]}>
            <Text style={styles.statTrendText}>
              {trendValue > 0 ? '↑' : '↓'} {Math.abs(trendValue).toFixed(1)}% vs last period
            </Text>
          </View>
        )}
      </LinearGradient>
    );
  };

  // ----- Overview Tab -----
  const renderOverview = () => {
    const urgentOrder = [...(orderStats.active || [])].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))[0];
    const salesTrend = 12.5;
    const pendingTrend = -8.3;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
      >
        <WelcomeHeader />

        <View style={styles.statsGridModern}>
          <StatCard title="Today's Sales" value={salesSummary.today} icon="💰" gradientColors={['#DC2626', '#EF4444']} trend={true} trendValue={salesTrend} isCurrency={true} />
          <StatCard title="Pending Orders" value={orderStats.pending?.length || 0} icon="📋" gradientColors={['#F59E0B', '#FBBF24']} trend={true} trendValue={pendingTrend} />
          <StatCard title="Total Products" value={products.length} icon="📦" gradientColors={['#10B981', '#34D399']} trend={false} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setActiveTab('products')}>
              <LinearGradient colors={['#FEF2F2', '#FFF']} style={styles.quickActionGradient}>
                <View style={styles.quickActionIconCircle}><Text style={styles.quickActionIcon}>➕</Text></View>
                <Text style={styles.quickActionTitle}>Add Product</Text>
                <Text style={styles.quickActionDesc}>New item to your stall</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setActiveTab('orders')}>
              <LinearGradient colors={['#EFF6FF', '#FFF']} style={styles.quickActionGradient}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: '#3B82F6' }]}><Text style={styles.quickActionIcon}>📋</Text></View>
                <Text style={styles.quickActionTitle}>View Orders</Text>
                <Text style={styles.quickActionDesc}>Manage incoming orders</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setActiveTab('chats')}>
              <LinearGradient colors={['#FEF3C7', '#FFF']} style={styles.quickActionGradient}>
                <View style={[styles.quickActionIconCircle, { backgroundColor: '#F59E0B' }]}><Text style={styles.quickActionIcon}>💬</Text></View>
                <Text style={styles.quickActionTitle}>Messages</Text>
                <Text style={styles.quickActionDesc}>Customer chats</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Sales Insights</Text>
          {analyticsLoading ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              {bestSellingProducts.length > 0 && (
                <View style={styles.analyticsCard}>
                  <Text style={styles.analyticsSubtitle}>🔥 Best Selling Products</Text>
                  {bestSellingProducts.map((product, idx) => (
                    <View key={product.id} style={styles.bestSellerRow}>
                      <Text style={styles.bestSellerRank}>#{idx + 1}</Text>
                      <Text style={styles.bestSellerName}>{product.name}</Text>
                      <Text style={styles.bestSellerQty}>{product.quantity} sold</Text>
                    </View>
                  ))}
                </View>
              )}
              
              {peakHours.length > 0 && (
                <View style={styles.analyticsCard}>
                  <Text style={styles.analyticsSubtitle}>⏰ Peak Hours</Text>
                  <View style={styles.peakHoursContainer}>
                    {peakHours.filter(h => h.count > 0).slice(0, 5).map(hour => (
                      <View key={hour.hour} style={styles.peakHourBadge}>
                        <Text style={styles.peakHourText}>{hour.hour}:00</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.analyticsCard}>
                <Text style={styles.analyticsSubtitle}>⭐ Your Suki (Regulars)</Text>
                {loadingCustomers ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : frequentCustomers.length === 0 ? (
                  <Text style={styles.noCustomersText}>No regular customers yet</Text>
                ) : (
                  frequentCustomers.map((customer, idx) => (
                    <View key={customer.id} style={styles.customerRow}>
                      <View style={styles.customerRank}>
                        <Text style={styles.customerRankText}>#{idx + 1}</Text>
                      </View>
                      <View style={styles.customerInfo}>
                        <Text style={styles.customerName}>{customer.name}</Text>
                        <Text style={styles.customerOrders}>{customer.count} orders</Text>
                      </View>
                      <View style={styles.sukiBadge}>
                        <Text style={styles.sukiBadgeText}>🏆 Suki</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.ratingHeader}>
            <Text style={styles.sectionTitle}>⭐ Rating Insights</Text>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingBadgeText}>{ratingStats.averageRating} ★</Text>
            </View>
          </View>
          
          <View style={styles.ratingPreviewRow}>
            <View style={styles.ratingPreviewItem}>
              <Text style={styles.ratingPreviewValue}>{ratingStats.totalReviews}</Text>
              <Text style={styles.ratingPreviewLabel}>Reviews</Text>
            </View>
            <View style={styles.ratingDivider} />
            <View style={styles.ratingPreviewItem}>
              <Text style={styles.ratingPreviewValue}>{ratingStats.positivePercentage}%</Text>
              <Text style={styles.ratingPreviewLabel}>Positive</Text>
            </View>
            <View style={styles.ratingDivider} />
            <View style={styles.ratingPreviewItem}>
              <Text style={styles.ratingPreviewValue}>{ratingStats.ratedProducts}</Text>
              <Text style={styles.ratingPreviewLabel}>Products</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.viewRatingsButton}
            onPress={() => navigation.navigate('VendorRatings')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.viewRatingsGradient}
            >
              <Text style={styles.viewRatingsIcon}>📊</Text>
              <Text style={styles.viewRatingsText}>View Detailed Ratings</Text>
              <Text style={styles.viewRatingsArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Reports</Text>
          <View style={styles.reportsRow}>
            <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('VendorReportsList')}>
              <Text style={styles.reportBtnIcon}>📊</Text>
              <View><Text style={styles.reportBtnText}>My Reports</Text>{reportStats.total > 0 && <Text style={styles.reportBtnSubtext}>{reportStats.total} total</Text>}</View>
              {reportStats.total > 0 && <View style={styles.reportBadge}><Text style={styles.reportBadgeText}>{reportStats.total}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportBtn} onPress={() => navigation.navigate('VendorReportIssue')}>
              <Text style={styles.reportBtnIcon}>🚩</Text>
              <View><Text style={styles.reportBtnText}>Report Customer</Text><Text style={styles.reportBtnSubtext}>Submit new report</Text></View>
            </TouchableOpacity>
          </View>
          {reportStats.pending > 0 && <Text style={styles.pendingReportsText}>{reportStats.pending} report(s) pending review</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sales Overview (Last 7 Days)</Text>
          <SalesChart data={salesData} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {urgentOrder && (
            <View style={styles.urgentOrderCard}>
              <Text style={styles.urgentOrderTitle}>⚠️ Urgent Order</Text>
              <Text style={styles.urgentOrderNumber}>#{urgentOrder.order_number?.slice(-8) || urgentOrder.id.slice(-8)}</Text>
              <Text style={styles.urgentOrderStatus}>Status: {urgentOrder.status.toUpperCase()}</Text>
              <View style={styles.progressBarContainer}><View style={[styles.progressBar, { width: `${getOrderProgress(urgentOrder.status)}%` }]} /></View>
              <TouchableOpacity style={styles.updateStatusBtn} onPress={() => handleUpdateOrderStatus(urgentOrder, 'ready')}>
                <Text style={styles.updateStatusBtnText}>Mark as Ready</Text>
              </TouchableOpacity>
            </View>
          )}
          {(orderStats.active || []).slice(0, 3).map(order => (
            <OrderCard key={order.id} order={order} onUpdateStatus={handleUpdateOrderStatus} onRejectOrder={handleRejectOrder} onRequestPayment={handleRequestPayment} onProposeChange={handleProposeChange} />
          ))}
          {(orderStats.active || []).length === 0 && (
            <View style={styles.emptyStateCard}><Text style={styles.emptyStateEmoji}>📦</Text><Text style={styles.emptyStateTitle}>No orders yet</Text><Text style={styles.emptyStateText}>When customers place orders, they'll appear here</Text></View>
          )}
        </View>
      </ScrollView>
    );
  };

  // ----- Products Tab -----
  const renderProducts = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}>
      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
        <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.addGradient}><Text style={styles.addButtonText}>+ Add New Product</Text></LinearGradient>
      </TouchableOpacity>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Products ({products.length})</Text>
        {productsLoading ? <ActivityIndicator size="small" color="#DC2626" /> : products.length === 0 ? (
          <View style={styles.emptyStateCard}><Text style={styles.emptyStateEmoji}>📦</Text><Text style={styles.emptyStateTitle}>No products yet</Text><Text style={styles.emptyStateText}>Tap "Add Product" to get started</Text></View>
        ) : (
          products.map(product => <ProductCard key={product.id} product={product} onToggleAvailability={toggleAvailability} onEdit={setEditingProduct} onDelete={deleteProduct} />)
        )}
      </View>
    </ScrollView>
  );

  // ----- Orders Tab -----
// ----- Orders Tab -----
// ----- Orders Tab - CLEAN VERSION -----
// ----- Orders Tab - FULL WORKING VERSION -----
const renderOrders = () => {
  // Safe data
  const pendingOrders = orderStats?.pending || [];
  const confirmedOrders = orderStats?.confirmed || [];
  const preparingOrders = orderStats?.preparing || [];
  const readyOrders = orderStats?.ready || [];
  const completedOrders = orderStats?.completed || [];
  const cancelledOrders = orderStats?.cancelled || [];

  let currentOrders = [];
  let tabTitle = '';
  
  switch (orderStatusTab) {
    case 'pending': 
      currentOrders = pendingOrders; 
      tabTitle = 'Pending';
      break;
    case 'confirmed': 
      currentOrders = confirmedOrders; 
      tabTitle = 'Confirmed';
      break;
    case 'preparing': 
      currentOrders = preparingOrders; 
      tabTitle = 'Preparing';
      break;
    case 'ready': 
      currentOrders = readyOrders; 
      tabTitle = 'Ready';
      break;
    case 'completed': 
      currentOrders = completedOrders; 
      tabTitle = 'Completed';
      break;
    case 'cancelled': 
      currentOrders = cancelledOrders; 
      tabTitle = 'Cancelled';
      break;
    default: 
      currentOrders = pendingOrders;
      tabTitle = 'Pending';
  }

  const tabs = [
    { key: 'pending', label: 'Pending', count: pendingOrders.length, color: '#F59E0B' },
    { key: 'confirmed', label: 'Confirmed', count: confirmedOrders.length, color: '#3B82F6' },
    { key: 'preparing', label: 'Preparing', count: preparingOrders.length, color: '#8B5CF6' },
    { key: 'ready', label: 'Ready', count: readyOrders.length, color: '#10B981' },
    { key: 'completed', label: 'Completed', count: completedOrders.length, color: '#6B7280' },
    { key: 'cancelled', label: 'Cancelled', count: cancelledOrders.length, color: '#EF4444' },
  ];

  return (
    <View style={{ flex: 1 }}>
      {/* Tab Bar */}
      <View style={styles.tabsWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.orderTab, orderStatusTab === tab.key && styles.orderTabActive]}
              onPress={() => setOrderStatusTab(tab.key)}
            >
              <Text style={[styles.orderTabText, orderStatusTab === tab.key && styles.orderTabTextActive]}>
                {tab.label}
              </Text>
              {tab.count > 0 ? (
                <View style={[styles.orderTabBadge, { backgroundColor: tab.color }]}>
                  <Text style={styles.orderTabBadgeText}>{tab.count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Orders List */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tabTitle} Orders ({currentOrders.length})</Text>
          
          {ordersLoading ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : currentOrders.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateEmoji}>📭</Text>
              <Text style={styles.emptyStateTitle}>No {tabTitle.toLowerCase()} orders</Text>
              <Text style={styles.emptyStateText}>
                {orderStatusTab === 'pending' 
                  ? 'New orders will appear here' 
                  : 'Orders will appear here when status changes'}
              </Text>
            </View>
          ) : (
            currentOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onUpdateStatus={handleUpdateOrderStatus} 
                onRejectOrder={handleRejectOrder} 
                onRequestPayment={handleRequestPayment}
                onProposeChange={handleProposeChange}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

  // ----- Chats Tab -----
  const renderChats = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💬 Customer Conversations</Text>
        {loadingChats ? <ActivityIndicator size="small" color="#DC2626" style={styles.chatLoader} /> : chats.length === 0 ? (
          <View style={styles.emptyStateCard}><Text style={styles.emptyStateEmoji}>💬</Text><Text style={styles.emptyStateTitle}>No conversations yet</Text><Text style={styles.emptyStateText}>When customers message you, they'll appear here</Text></View>
        ) : (
          chats.map(chat => (
            <TouchableOpacity key={chat.id} style={styles.chatItem} onPress={() => openChat(chat)}>
              <View style={styles.chatAvatar}><Text style={styles.chatAvatarText}>{chat.customer_name?.charAt(0).toUpperCase() || '👤'}</Text></View>
              <View style={styles.chatContent}>
                <View style={styles.chatHeader}><Text style={styles.chatName}>{chat.customer_name}</Text><Text style={styles.chatTime}>{chat.last_message_time ? new Date(chat.last_message_time).toLocaleDateString() : ''}</Text></View>
                <Text style={[styles.chatMessage, chat.unread_count > 0 && styles.chatMessageUnread]} numberOfLines={1}>{chat.last_message}</Text>
              </View>
              {chat.unread_count > 0 && <View style={styles.chatBadge}><Text style={styles.chatBadgeText}>{chat.unread_count}</Text></View>}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  // ----- Promotions Tab -----
  const renderPromotions = () => {
    const renderPromoItem = ({ item: promo }) => {
      const product = promo.product;
      const isPercentage = promo.discount_type === 'percentage';
      const discountText = isPercentage ? `${promo.discount_value}% OFF` : `₱${promo.discount_value} OFF`;
      const endDate = new Date(promo.end_date).toLocaleDateString();
      return (
        <View style={styles.promoCard}>
          <View style={styles.promoCardContent}>
            <View style={styles.promoInfo}>
              <Text style={styles.promoProductName}>{product?.name}</Text>
              <Text style={styles.promoDiscount}>{discountText}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₱{promo.original_price}</Text>
                <Text style={styles.discountedPrice}>₱{promo.discounted_price}</Text>
              </View>
              <Text style={styles.promoExpiry}>Expires: {endDate}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDeletePromotion(promo.id)} style={styles.deletePromoBtn}>
              <Text style={styles.deletePromoBtnText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    };

    const renderEmptyState = () => (
      <View style={styles.emptyStateCard}>
        <Text style={styles.emptyStateEmoji}>🏷️</Text>
        <Text style={styles.emptyStateTitle}>No active promotions</Text>
        <Text style={styles.emptyStateText}>Tap "New Promo" to offer discounts</Text>
      </View>
    );

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏷️ Active Promotions</Text>
            <TouchableOpacity onPress={() => setShowPromoModal(true)}>
              <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.addPromoButton}>
                <Text style={styles.addPromoButtonText}>+ New Promo</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={promotions}
          renderItem={renderPromoItem}
          keyExtractor={item => item.id.toString()}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.promosListContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  // ----- Profile Tab -----
const renderProfile = () => {
  const firstLetter = profile?.full_name?.charAt(0).toUpperCase() || 'V';

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}>
      <View style={styles.section}>
        {/* Profile Header with Avatar Upload */}
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            onPress={uploadVendorAvatar} 
            disabled={uploadingAvatar} 
            style={styles.profileAvatarContainer}
          >
            {uploadingAvatar ? (
              <View style={styles.profileAvatarGradient}>
                <ActivityIndicator size="large" color="white" />
              </View>
            ) : profile?.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                style={styles.profileAvatarImage}
              />
            ) : (
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                style={styles.profileAvatarGradient}
              >
                <Text style={styles.avatarText}>{firstLetter}</Text>
              </LinearGradient>
            )}
            <View style={styles.editAvatarBadge}>
              <Text style={styles.editAvatarBadgeText}>📷</Text>
            </View>
          </TouchableOpacity>
          
          <Text style={styles.profileName}>{profile?.full_name || 'Vendor'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>🛍️ Vendor</Text>
          </View>
        </View>

        {/* Stall Image Section */}
        <View style={styles.stallImageSection}>
          <Text style={styles.stallImageLabel}>Stall Banner Image</Text>
          <TouchableOpacity 
            onPress={uploadStallImage} 
            disabled={uploadingStallImage} 
            style={styles.stallImageContainer}
          >
            {uploadingStallImage ? (
              <View style={styles.stallImageUploading}>
                <ActivityIndicator size="large" color="#DC2626" />
                <Text style={styles.stallImageUploadingText}>Uploading...</Text>
              </View>
            ) : stall?.image_url && !stallImageError ? (
              <Image 
                source={{ uri: stall.image_url }} 
                style={styles.stallImage}
                onError={() => setStallImageError(true)}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.stallImagePlaceholder}>
                <Text style={styles.stallImageEmoji}>🏪</Text>
                <Text style={styles.stallImagePlaceholderText}>Tap to add stall image</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stall Information */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stall Number</Text>
          <Text style={styles.infoValue}>{stall.stall_number}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Stall Name</Text>
          <Text style={styles.infoValue}>{stall.stall_name || 'Your Stall'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Section</Text>
          <Text style={styles.infoValue}>{stall.section}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total Sales</Text>
          <Text style={styles.infoValue}>₱{salesSummary.total.toFixed(2)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total Orders</Text>
          <Text style={styles.infoValue}>{salesSummary.ordersMonth}</Text>
        </View>
        
        {Platform.OS === 'web' ? (
          <button onClick={async () => { if (window.confirm('Logout?')) { await supabase.auth.signOut(); window.location.href = '/'; } }} style={{ backgroundColor: '#DC2626', color: 'white', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', width: '100%', fontSize: 16, fontWeight: '600', marginTop: 20 }}>🚪 Logout</button>
        ) : (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.logoutGradient}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};
  // ----- Notifications Tab -----
  const renderNotifications = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}>
      <View style={styles.section}>
        <View style={styles.notificationsHeader}>
          <Text style={styles.sectionTitle}>🔔 Notifications</Text>
          {notificationUnreadCount > 0 && (
            <TouchableOpacity onPress={markAllNotificationsRead}>
              <Text style={styles.markAllReadText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {loadingNotifications ? (
          <ActivityIndicator size="large" color="#DC2626" style={styles.notificationsLoader} />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateEmoji}>🔔</Text>
            <Text style={styles.emptyStateTitle}>No notifications</Text>
            <Text style={styles.emptyStateText}>You're all caught up!</Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity
              key={notification.id}
              style={[styles.notificationCard, !notification.is_read && styles.notificationUnread]}
              onPress={() => markNotificationRead(notification.id)}
            >
              <View style={styles.notificationIcon}>
                <Text style={styles.notificationIconText}>
                  {notification.type === 'order' ? '📦' : 
                   notification.type === 'price_drop' ? '📉' :
                   notification.type === 'chat' ? '💬' : '📢'}
                </Text>
              </View>
              <View style={styles.notificationContent}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>
                  {new Date(notification.created_at).toLocaleString()}
                </Text>
              </View>
              {!notification.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  // ----- Reports Tab -----
// ----- Reports Tab -----
// ----- Reports Tab -----
const renderReports = () => {
  const getTotalSales = () => {
    return (reportData || []).reduce((sum, order) => sum + (order?.total_amount || 0), 0);
  };

  const getAverageOrder = () => {
    if (reportData.length === 0) return 0;
    return getTotalSales() / reportData.length;
  };

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 Sales Reports</Text>
        
        <View style={styles.reportPeriodSelector}>
          {['day', 'week', 'month'].map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.periodButton, reportPeriod === period && styles.periodButtonActive]}
              onPress={() => setReportPeriod(period)}
            >
              <Text style={[styles.periodButtonText, reportPeriod === period && styles.periodButtonTextActive]}>
                {period === 'day' ? 'Today' : period === 'week' ? 'Week' : 'Month'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.reportStatsRow}>
          <View style={styles.reportStatCard}>
            <Text style={styles.reportStatValue}>{reportData.length}</Text>
            <Text style={styles.reportStatLabel}>Orders</Text>
          </View>
          <View style={styles.reportStatCard}>
            <Text style={styles.reportStatValue}>₱{getTotalSales().toFixed(2)}</Text>
            <Text style={styles.reportStatLabel}>Sales</Text>
          </View>
          <View style={styles.reportStatCard}>
            <Text style={styles.reportStatValue}>₱{getAverageOrder().toFixed(2)}</Text>
            <Text style={styles.reportStatLabel}>Avg Order</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.exportButton}
          onPress={exportToCSV}
          disabled={exporting}
        >
          <LinearGradient colors={['#10B981', '#059669']} style={styles.exportGradient}>
            <Text style={styles.exportButtonText}>
              {exporting ? 'Exporting...' : '📥 Export to CSV'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Order Details</Text>
        {reportData.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateEmoji}>📭</Text>
            <Text style={styles.emptyStateTitle}>No orders this period</Text>
          </View>
        ) : (
          reportData.map((order) => (
            <View key={order.id} style={styles.reportOrderItem}>
              <View style={styles.reportOrderHeader}>
                <Text style={styles.reportOrderNumber}>#{order.order_number?.slice(-8)}</Text>
                <Text style={[styles.reportOrderStatus, { color: getStatusColor(order.status) }]}>
                  {order.status}
                </Text>
              </View>
              <Text style={styles.reportOrderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
              <Text style={styles.reportOrderTotal}>₱{order.total_amount}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const renderContent = () => {
  switch (activeTab) {
    case 'overview': return renderOverview();
    case 'products': return renderProducts();
    case 'orders': return renderOrders();
    case 'chats': return renderChats();
    case 'promotions': return renderPromotions();
    case 'notifications': return renderNotifications();
    case 'reports': return renderReports();
    case 'profile': return renderProfile();
    default: return renderOverview();
  }
};

  return (
    <View style={styles.container}>
      <Header title="PalengkeHub" subtitle={stall.stall_name || 'Manage your stall'} />
      
      <View style={styles.contentArea}>
        {renderContent()}
      </View>

            <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, activeTab === 'overview' && styles.navItemActive]} onPress={() => setActiveTab('overview')}>
          <Text style={[styles.navIcon, activeTab === 'overview' && styles.navIconActive]}>📊</Text>
          <Text style={[styles.navText, activeTab === 'overview' && styles.navTextActive]}>Overview</Text>
          {activeTab === 'overview' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, activeTab === 'products' && styles.navItemActive]} onPress={() => setActiveTab('products')}>
          <Text style={[styles.navIcon, activeTab === 'products' && styles.navIconActive]}>📦</Text>
          <Text style={[styles.navText, activeTab === 'products' && styles.navTextActive]}>Products</Text>
          {activeTab === 'products' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, activeTab === 'orders' && styles.navItemActive]} onPress={() => setActiveTab('orders')}>
          <Text style={[styles.navIcon, activeTab === 'orders' && styles.navIconActive]}>📋</Text>
          <Text style={[styles.navText, activeTab === 'orders' && styles.navTextActive]}>Orders</Text>
          {orderStats.pending?.length > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{orderStats.pending.length}</Text>
            </View>
          )}
          {activeTab === 'orders' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, activeTab === 'promotions' && styles.navItemActive]} onPress={() => setActiveTab('promotions')}>
          <Text style={[styles.navIcon, activeTab === 'promotions' && styles.navIconActive]}>🏷️</Text>
          <Text style={[styles.navText, activeTab === 'promotions' && styles.navTextActive]}>Promos</Text>
          {activeTab === 'promotions' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, activeTab === 'chats' && styles.navItemActive]} onPress={() => setActiveTab('chats')}>
          <Text style={[styles.navIcon, activeTab === 'chats' && styles.navIconActive]}>💬</Text>
          <Text style={[styles.navText, activeTab === 'chats' && styles.navTextActive]}>Chats</Text>
          {unreadCount > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
          {activeTab === 'chats' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, activeTab === 'notifications' && styles.navItemActive]} onPress={() => setActiveTab('notifications')}>
          <Text style={[styles.navIcon, activeTab === 'notifications' && styles.navIconActive]}>🔔</Text>
          <Text style={[styles.navText, activeTab === 'notifications' && styles.navTextActive]}>Alerts</Text>
          {notificationUnreadCount > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}</Text>
            </View>
          )}
          {activeTab === 'notifications' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, activeTab === 'reports' && styles.navItemActive]} onPress={() => setActiveTab('reports')}>
          <Text style={[styles.navIcon, activeTab === 'reports' && styles.navIconActive]}>📊</Text>
          <Text style={[styles.navText, activeTab === 'reports' && styles.navTextActive]}>Reports</Text>
          {activeTab === 'reports' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]} onPress={() => setActiveTab('profile')}>
          <Text style={[styles.navIcon, activeTab === 'profile' && styles.navIconActive]}>👤</Text>
          <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>Profile</Text>
          {activeTab === 'profile' && <View style={styles.navActiveIndicator} />}
        </TouchableOpacity>
      </View>

      <AddProductModal visible={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddProduct} />
      <AddProductModal visible={!!editingProduct} onClose={() => setEditingProduct(null)} onSubmit={handleUpdateProduct} editingProduct={editingProduct} />
      
      {/* Partial Fulfillment Proposal Modal */}
 {/* Improved Proposal Modal */}
<Modal
  visible={proposeModalVisible}
  transparent={true}
  animationType="slide"
  onRequestClose={() => setProposeModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.modalTitle}>Propose Order Change</Text>
      <Text style={styles.modalSubtitle}>Suggest a different quantity or unit</Text>
      
      {/* Select Item to Change */}
      <Text style={styles.label}>Select Item</Text>
      {selectedOrder?.items?.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.itemSelectOption, selectedItemId === item.id && styles.itemSelectOptionActive]}
          onPress={async () => {
            setSelectedItemId(item.id);
            setProposedUnit(item.unit);
            setProposedQuantity(item.quantity.toString());
            await fetchProductUnitPrices(item.id);
          }}
        >
          <View>
            <Text style={styles.itemSelectName}>{item.name}</Text>
            <Text style={styles.itemSelectDetail}>
              {item.quantity} {item.unit} × ₱{item.price}/{item.unit} = ₱{(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
          {selectedItemId === item.id && <Text style={styles.itemSelectCheck}>✓</Text>}
        </TouchableOpacity>
      ))}

      {selectedItemId && (
        <>
          {/* Select Unit */}
          <Text style={styles.label}>Proposed Unit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
            {availableUnits.map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[styles.unitChip, proposedUnit === unit && styles.unitChipActive]}
                onPress={() => {
                  setProposedUnit(unit);
                  // Reset quantity when unit changes
                  setProposedQuantity('');
                }}
              >
                <Text style={[styles.unitChipText, proposedUnit === unit && styles.unitChipTextActive]}>
                  {unit === 'kg' ? 'Kilo (kg)' : 
                   unit === '500g' ? '500g' : 
                   unit === '250g' ? '250g' : 
                   unit === 'piece' ? 'Piece' :
                   unit === 'bundle' ? 'Bundle' :
                   unit === 'dozen' ? 'Dozen' : 'Pack'}
                </Text>
                <Text style={[styles.unitChipPrice, proposedUnit === unit && styles.unitChipPriceActive]}>
                  ₱{unitPrices[unit]?.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Proposed Quantity */}
          <Text style={styles.label}>Proposed Quantity ({proposedUnit})</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => {
                const newVal = Math.max(0, parseInt(proposedQuantity) - 1);
                setProposedQuantity(newVal.toString());
              }}
            >
              <Text style={styles.quantityBtnText}>-</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.quantityInput}
              keyboardType="numeric"
              value={proposedQuantity}
              onChangeText={setProposedQuantity}
              textAlign="center"
              placeholder="0"
            />
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => {
                const newVal = (parseInt(proposedQuantity) || 0) + 1;
                setProposedQuantity(newVal.toString());
              }}
            >
              <Text style={styles.quantityBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          
          {/* Price Preview */}
          {(() => {
            const selectedItem = selectedOrder?.items?.find(i => i.id === selectedItemId);
            const newQty = parseInt(proposedQuantity);
            const unitPrice = unitPrices[proposedUnit] || 0;
            if (selectedItem && !isNaN(newQty) && newQty > 0 && unitPrice > 0) {
              const oldTotal = selectedItem.price * selectedItem.quantity;
              const newTotal = unitPrice * newQty;
              const difference = newTotal - oldTotal;
              return (
                <View style={styles.pricePreview}>
                  <Text style={styles.pricePreviewText}>
                    Original: {selectedItem.quantity} {selectedItem.unit} = ₱{oldTotal.toFixed(2)}
                  </Text>
                  <Text style={styles.pricePreviewText}>
                    Proposed: {newQty} {proposedUnit} × ₱{unitPrice.toFixed(2)} = ₱{newTotal.toFixed(2)}
                  </Text>
                  <Text style={[styles.differenceText, difference > 0 ? styles.increaseText : styles.decreaseText]}>
                    {difference > 0 ? `+₱${difference.toFixed(2)}` : difference < 0 ? `-₱${Math.abs(difference).toFixed(2)}` : 'No change'}
                  </Text>
                </View>
              );
            }
            return null;
          })()}

          {/* Notes to Customer */}
          <Text style={styles.label}>Reason (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g., Only 500g pieces available, sorry for the inconvenience..."
            value={proposalNotes}
            onChangeText={setProposalNotes}
            multiline
            numberOfLines={3}
          />
        </>
      )}

      <View style={styles.modalButtons}>
        <TouchableOpacity style={styles.cancelModalButton} onPress={() => setProposeModalVisible(false)}>
          <Text style={styles.cancelModalText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.submitModalButton, (!selectedItemId || !proposedUnit || !proposedQuantity || submittingProposal) && styles.confirmModalDisabled]}
          onPress={submitProposal}
          disabled={!selectedItemId || !proposedUnit || !proposedQuantity || submittingProposal}
        >
          <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.submitGradient}>
            <Text style={styles.submitButtonText}>
              {submittingProposal ? 'Sending...' : 'Send Proposal'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </View>
</Modal>
      
      {/* Promotion Modal */}
      {showPromoModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Promotion</Text>
            <Text style={styles.modalSubtitle}>Select product and discount</Text>

            <Text style={styles.label}>Product</Text>
            {productsList.length === 0 ? (
              <Text style={styles.noProductsText}>No products available. Add products first.</Text>
            ) : (
              <FlatList
                data={productsList}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item: p }) => (
                  <TouchableOpacity
                    style={[styles.pickerOption, newPromo.product_id === p.id && styles.pickerOptionSelected]}
                    onPress={() => setNewPromo({...newPromo, product_id: p.id})}
                  >
                    <Text style={[styles.pickerOptionText, newPromo.product_id === p.id && styles.pickerOptionTextSelected]}>
                      {p.name} (₱{p.price})
                    </Text>
                  </TouchableOpacity>
                )}
                style={styles.pickerFlatList}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              />
            )}

            <Text style={styles.label}>Discount Type</Text>
            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.typeButton, newPromo.discount_type === 'percentage' && styles.typeButtonActive]}
                onPress={() => setNewPromo({...newPromo, discount_type: 'percentage'})}
              >
                <Text style={[styles.typeButtonText, newPromo.discount_type === 'percentage' && styles.typeButtonTextActive]}>Percentage (%)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, newPromo.discount_type === 'fixed' && styles.typeButtonActive]}
                onPress={() => setNewPromo({...newPromo, discount_type: 'fixed'})}
              >
                <Text style={[styles.typeButtonText, newPromo.discount_type === 'fixed' && styles.typeButtonTextActive]}>Fixed (₱)</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{newPromo.discount_type === 'percentage' ? 'Discount %' : 'Discount Amount (₱)'}</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g., 20"
              value={newPromo.discount_value}
              onChangeText={(text) => setNewPromo({...newPromo, discount_value: text})}
            />

            <Text style={styles.label}>Expiry Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2025-12-31"
              value={newPromo.end_date}
              onChangeText={(text) => setNewPromo({...newPromo, end_date: text})}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelModalButton} onPress={() => setShowPromoModal(false)}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitModalButton} onPress={handleCreatePromotion}>
                <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.submitGradient}>
                  <Text style={styles.submitButtonText}>Create Promo</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}


// ---- Styles ----
const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  contentArea: { flex: 1 },
  loadingText: { marginTop: 12, color: '#6B7280' },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', padding: 20 },
  backButton: { marginTop: 20, backgroundColor: '#DC2626', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  backButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  promosListContainer: { paddingHorizontal: 16, paddingBottom: 20 },

  // Welcome Header - Clean layout
  welcomeHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  welcomeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageContainer: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileAvatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  greetingContainer: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 13,
    color: '#6B7280',
  },
  welcomeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 2,
  },
  welcomeSubtext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  welcomeBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
  },
  welcomeBadgeText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 12,
  },
  welcomeBadgeSubtext: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },

  // Status Row
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pauseToggle: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  pauseToggleGradient: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pauseToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  closedWarningMessage: {
    marginTop: 12,
    fontSize: 11,
    color: '#EF4444',
    textAlign: 'center',
    backgroundColor: '#FEF3F2',
    padding: 8,
    borderRadius: 8,
  },

  // Stats
  statsGridModern: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, marginBottom: 16 },
  statCardModern: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statIconModern: { fontSize: 28, marginBottom: 8, color: '#FFF' },
  statValueModern: { fontSize: 24, fontWeight: 'bold', color: '#FFF', marginBottom: 4 },
  statLabelModern: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginBottom: 8 },
  statTrend: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  statTrendText: { fontSize: 10, color: '#FFF' },
  trendPositive: { backgroundColor: 'rgba(16,185,129,0.3)' },
  trendNegative: { backgroundColor: 'rgba(239,68,68,0.3)' },

  // Sections
  section: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  // Quick Actions
  quickActionsRow: { flexDirection: 'row', gap: 12 },
  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionGradient: { padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
  quickActionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionIcon: { fontSize: 24, color: '#FFF' },
  quickActionTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 4 },
  quickActionDesc: { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  // Reports
  reportsRow: { flexDirection: 'row', gap: 12 },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  reportBtnIcon: { fontSize: 24 },
  reportBtnText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reportBtnSubtext: { fontSize: 11, color: '#6B7280' },
  reportBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  pendingReportsText: { fontSize: 12, color: '#F59E0B', textAlign: 'center', marginTop: 8 },

  // Urgent Order
  urgentOrderCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  urgentOrderTitle: { fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 8 },
  urgentOrderNumber: { fontSize: 16, fontWeight: 'bold', color: '#78350F', marginBottom: 4 },
  urgentOrderStatus: { fontSize: 12, color: '#B45309', marginBottom: 12 },
  progressBarContainer: { height: 6, backgroundColor: '#FDE68A', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressBar: { height: '100%', backgroundColor: '#DC2626', borderRadius: 3 },
  updateStatusBtn: { backgroundColor: '#DC2626', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  updateStatusBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  // Products
  addButton: { marginHorizontal: 16, marginBottom: 16, marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  addGradient: { paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  // Chats
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatAvatarText: { fontSize: 20, fontWeight: '600', color: '#DC2626' },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  chatTime: { fontSize: 11, color: '#9CA3AF' },
  chatMessage: { fontSize: 13, color: '#6B7280' },
  chatMessageUnread: { fontWeight: '600', color: '#111827' },
  chatBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  chatBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  chatLoader: { padding: 20 },

  // Empty States
  emptyStateCard: { alignItems: 'center', padding: 40 },
  emptyStateEmoji: { fontSize: 48, marginBottom: 12, opacity: 0.5 },
  emptyStateTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  emptyStateText: { fontSize: 13, color: '#6B7280', textAlign: 'center' },

  // Profile
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  profileAvatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 40 },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  profileEmail: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  roleBadge: { backgroundColor: '#FEF3F2', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  roleText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: { fontSize: 14, color: '#6B7280' },
  infoValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  logoutButton: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
  logoutGradient: { paddingVertical: 12, alignItems: 'center' },
  logoutButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 25 : 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 5,
  },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, position: 'relative' },
  navItemActive: { backgroundColor: '#FEF3F2', borderRadius: 8, marginHorizontal: 2 },
  navIcon: { fontSize: 22, marginBottom: 3 },
  navIconActive: { transform: [{ scale: 1.1 }] },
  navText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  navTextActive: { color: '#DC2626', fontWeight: '600' },
  navBadge: {
    position: 'absolute',
    top: 0,
    right: '25%',
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  navActiveIndicator: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#DC2626', marginTop: 2 },

  // Promo card styles
  addPromoButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addPromoButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  promoCard: {
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  promoCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  promoInfo: { flex: 1 },
  promoProductName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  promoDiscount: { fontSize: 13, color: '#DC2626', fontWeight: '600', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  originalPrice: { fontSize: 12, color: '#6B7280', textDecorationLine: 'line-through' },
  discountedPrice: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
  promoExpiry: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  deletePromoBtn: { padding: 8 },
  deletePromoBtnText: { fontSize: 18 },

  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12 },
  pickerFlatList: {
    maxHeight: 200,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  pickerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerOptionSelected: { backgroundColor: '#FEE2E2' },
  pickerOptionText: { fontSize: 14, color: '#374151' },
  pickerOptionTextSelected: { color: '#DC2626', fontWeight: '500' },
  noProductsText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: 20, marginBottom: 16 },
  rowButtons: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonActive: { backgroundColor: '#DC2626' },
  typeButtonText: { fontSize: 14, color: '#374151' },
  typeButtonTextActive: { color: 'white' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelModalButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelModalText: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  submitModalButton: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  submitGradient: { paddingVertical: 12, alignItems: 'center' },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },

  // Analytics Styles
  analyticsCard: { marginBottom: 16 },
  analyticsSubtitle: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  bestSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  bestSellerRank: { width: 30, fontSize: 14, fontWeight: 'bold', color: '#DC2626' },
  bestSellerName: { flex: 1, fontSize: 14, color: '#374151' },
  bestSellerQty: { fontSize: 12, color: '#6B7280' },
  peakHoursContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  peakHourBadge: { backgroundColor: '#FEF3F2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  peakHourText: { fontSize: 12, color: '#DC2626', fontWeight: '500' },

  // Report Styles
  reportPeriodSelector: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  periodButton: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center' },
  periodButtonActive: { backgroundColor: '#DC2626' },
  periodButtonText: { fontSize: 14, color: '#6B7280' },
  periodButtonTextActive: { color: 'white' },
  reportStatsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  reportStatCard: { flex: 1, backgroundColor: '#FEF3F2', borderRadius: 12, padding: 12, alignItems: 'center' },
  reportStatValue: { fontSize: 20, fontWeight: 'bold', color: '#DC2626' },
  reportStatLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  exportButton: { borderRadius: 12, overflow: 'hidden' },
  exportGradient: { paddingVertical: 12, alignItems: 'center' },
  exportButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  reportOrderItem: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 8 },
  reportOrderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reportOrderNumber: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reportOrderStatus: { fontSize: 12, fontWeight: '500' },
  reportOrderDate: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  reportOrderTotal: { fontSize: 14, fontWeight: '700', color: '#DC2626' },

  // Notifications Styles
  notificationsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  markAllReadText: { fontSize: 12, color: '#DC2626', fontWeight: '500' },
  notificationsLoader: { paddingVertical: 40 },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    position: 'relative',
  },
  notificationUnread: { backgroundColor: '#FEF3F2', borderColor: '#FEE2E2' },
  notificationIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notificationIconText: { fontSize: 20 },
  notificationContent: { flex: 1 },
  notificationTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  notificationMessage: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  notificationTime: { fontSize: 10, color: '#9CA3AF' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626', position: 'absolute', top: 12, right: 12 },
  // Customer History (Suki) Styles
customerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#F3F4F6',
},
customerRank: {
  width: 40,
},
customerRankText: {
  fontSize: 14,
  fontWeight: 'bold',
  color: '#DC2626',
},
customerInfo: {
  flex: 1,
},
customerName: {
  fontSize: 14,
  fontWeight: '500',
  color: '#111827',
},
customerOrders: {
  fontSize: 11,
  color: '#6B7280',
  marginTop: 2,
},
sukiBadge: {
  backgroundColor: '#FEF3C7',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 20,
},
sukiBadgeText: {
  fontSize: 10,
  fontWeight: '600',
  color: '#D97706',
},
noCustomersText: {
  fontSize: 13,
  color: '#6B7280',
  textAlign: 'center',
  paddingVertical: 20,
},
// Rating Insights Styles
ratingHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
},
ratingBadge: {
  backgroundColor: '#FEF3C7',
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 20,
},
ratingBadgeText: {
  fontSize: 12,
  fontWeight: '600',
  color: '#D97706',
},
ratingPreviewRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-around',
  backgroundColor: '#F9FAFB',
  borderRadius: 12,
  padding: 12,
  marginBottom: 16,
},
ratingPreviewItem: {
  alignItems: 'center',
  flex: 1,
},
ratingPreviewValue: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#111827',
},
ratingPreviewLabel: {
  fontSize: 11,
  color: '#6B7280',
  marginTop: 2,
},
ratingDivider: {
  width: 1,
  height: 30,
  backgroundColor: '#E5E7EB',
},
viewRatingsButton: {
  borderRadius: 12,
  overflow: 'hidden',
  shadowColor: '#DC2626',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
  elevation: 3,
},
viewRatingsGradient: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 14,
  gap: 8,
},
viewRatingsIcon: {
  fontSize: 18,
  color: 'white',
},
viewRatingsText: {
  fontSize: 15,
  fontWeight: '600',
  color: 'white',
},
viewRatingsArrow: {
  fontSize: 16,
  color: 'white',
  marginLeft: 4,
},

    // Order Tabs Styles - IMPROVED
  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  orderTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    gap: 6,
  },
  orderTabActive: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  orderTabIcon: {
    fontSize: 14,
  },
  orderTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  orderTabTextActive: {
    color: '#FFFFFF',
  },
  orderTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
    minWidth: 20,
    alignItems: 'center',
  },
  orderTabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  itemSelectOption: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 12,
  backgroundColor: '#F9FAFB',
  borderRadius: 8,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: '#E5E7EB',
},
itemSelectOptionActive: {
  backgroundColor: '#FEF3F2',
  borderColor: '#DC2626',
},
itemSelectName: {
  fontSize: 14,
  fontWeight: '500',
  color: '#111827',
},
itemSelectDetail: {
  fontSize: 12,
  color: '#6B7280',
  marginTop: 2,
},
itemSelectCheck: {
  fontSize: 18,
  color: '#DC2626',
  fontWeight: 'bold',
},
quantityRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
},
quantityBtn: {
  width: 40,
  height: 40,
  backgroundColor: '#F3F4F6',
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
},
quantityBtnText: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#DC2626',
},
quantityInput: {
  flex: 1,
  height: 40,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 8,
  marginHorizontal: 8,
  fontSize: 16,
},
substituteContainer: {
  marginBottom: 16,
},
substituteScroll: {
  flexDirection: 'row',
},
substituteChip: {
  paddingHorizontal: 12,
  paddingVertical: 8,
  backgroundColor: '#F3F4F6',
  borderRadius: 20,
  marginRight: 8,
},
substituteChipActive: {
  backgroundColor: '#DC2626',
},
substituteChipText: {
  fontSize: 12,
  color: '#374151',
},
substituteChipTextActive: {
  color: 'white',
},
textArea: {
  minHeight: 80,
  textAlignVertical: 'top',
},
unitScroll: {
  flexDirection: 'row',
  marginBottom: 16,
},
unitChip: {
  paddingHorizontal: 16,
  paddingVertical: 10,
  backgroundColor: '#F3F4F6',
  borderRadius: 24,
  marginRight: 8,
  alignItems: 'center',
},
unitChipActive: {
  backgroundColor: '#DC2626',
},
unitChipText: {
  fontSize: 14,
  color: '#374151',
},
unitChipTextActive: {
  color: 'white',
},
unitChipPrice: {
  fontSize: 12,
  color: '#6B7280',
  marginTop: 2,
},
unitChipPriceActive: {
  color: 'rgba(255,255,255,0.9)',
},
itemSelectOption: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 12,
  backgroundColor: '#F9FAFB',
  borderRadius: 8,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: '#E5E7EB',
},
itemSelectOptionActive: {
  backgroundColor: '#FEF3F2',
  borderColor: '#DC2626',
},
itemSelectName: {
  fontSize: 14,
  fontWeight: '500',
  color: '#111827',
},
itemSelectDetail: {
  fontSize: 12,
  color: '#6B7280',
  marginTop: 2,
},
itemSelectCheck: {
  fontSize: 18,
  color: '#DC2626',
  fontWeight: 'bold',
},
quantityRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
},
quantityBtn: {
  width: 40,
  height: 40,
  backgroundColor: '#F3F4F6',
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
},
quantityBtnText: {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#DC2626',
},
quantityInput: {
  flex: 1,
  height: 40,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 8,
  marginHorizontal: 8,
  fontSize: 16,
},
pricePreview: {
  backgroundColor: '#FEF3F2',
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
},
pricePreviewText: {
  fontSize: 12,
  color: '#78350F',
  marginBottom: 4,
},
differenceText: {
  fontSize: 13,
  fontWeight: '600',
  marginTop: 4,
},
increaseText: {
  color: '#EF4444',
},
decreaseText: {
  color: '#10B981',
},
textArea: {
  minHeight: 80,
  textAlignVertical: 'top',
},

editAvatarBadgeText: {
  fontSize: 12,
},
profileAvatarContainer: {
  position: 'relative',
  marginBottom: 12,
},
profileAvatarImage: {
  width: 100,
  height: 100,
  borderRadius: 50,
  borderWidth: 3,
  borderColor: '#DC2626',
},
editAvatarBadge: {
  position: 'absolute',
  bottom: 0,
  right: 0,
  backgroundColor: '#DC2626',
  width: 28,
  height: 28,
  borderRadius: 14,
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: 'white',
},
editAvatarBadgeText: {
  fontSize: 14,
},
stallImageSection: {
  marginTop: 20,
  marginBottom: 20,
},
stallImageLabel: {
  fontSize: 14,
  fontWeight: '600',
  color: '#374151',
  marginBottom: 12,
},
stallImageContainer: {
  borderRadius: 16,
  overflow: 'hidden',
  backgroundColor: '#F3F4F6',
  height: 150,
},
stallImage: {
  width: '100%',
  height: 150,
  borderRadius: 16,
},
stallImagePlaceholder: {
  width: '100%',
  height: 150,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#F3F4F6',
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderStyle: 'dashed',
  borderRadius: 16,
},
stallImageEmoji: {
  fontSize: 48,
  marginBottom: 8,
},
stallImagePlaceholderText: {
  fontSize: 12,
  color: '#6B7280',
},
stallImageUploading: {
  width: '100%',
  height: 150,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#F3F4F6',
  borderRadius: 16,
},
stallImageUploadingText: {
  fontSize: 12,
  color: '#DC2626',
  marginTop: 8,
},
});