  import React, { useState, useEffect, useRef } from 'react';
  import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Linking,
    Modal,
    Dimensions,
    Image,
  } from 'react-native';
  import * as ImagePicker from 'expo-image-picker';
  import Constants from 'expo-constants';
  import { LinearGradient } from 'expo-linear-gradient';
  import DateTimePicker from '@react-native-community/datetimepicker';
  import { supabase } from '../../../lib/supabase';
  import { useAuth } from '../../contexts/AuthContext';
  import { useCart } from '../../hooks/useCart';
  import StallMap from '../../components/StallMap';

  const { width, height } = Dimensions.get('window');

  export default function CheckoutScreen({ navigation, route }) {
    const { user } = useAuth();
    const { cart: hookCart, cartTotal: hookTotal, clearCart, refreshCart } = useCart();
    
    // ✅ Use passed cart data from navigation params
    const cart = route.params?.cart || hookCart;
    const cartTotal = route.params?.cartTotal || hookTotal;
    
    const [loading, setLoading] = useState(false);
    const [pickupTime, setPickupTime] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000));
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [selectedStall, setSelectedStall] = useState(null);
    const [mapModalVisible, setMapModalVisible] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paymongoType, setPaymongoType] = useState('gcash');
    
    // GCash direct payment states
    const [gcashModalVisible, setGcashModalVisible] = useState(false);
    const [gcashCountdown, setGcashCountdown] = useState(600); // 10 minutes in seconds
    const [gcashReferenceNumber, setGcashReferenceNumber] = useState('');
    const [gcashSubmitting, setGcashSubmitting] = useState(false);
    const [gcashOrderIds, setGcashOrderIds] = useState([]);
    const [gcashReceiptUri, setGcashReceiptUri] = useState(null);
    const [gcashReceiptUploading, setGcashReceiptUploading] = useState(false);
    const gcashTimerRef = useRef(null);

    const extra = Constants.manifest?.extra || Constants.expoConfig?.extra || {};
    const paymongoProxyUrl = extra.paymongoProxyUrl || '';
    const paymongoSuccessUrl = extra.paymongoSuccessUrl || 'palengkehub://paymongo/success';
    const paymongoFailedUrl = extra.paymongoFailedUrl || 'palengkehub://paymongo/failed';

    // Debug logs
    useEffect(() => {
      console.log('📦 CheckoutScreen - cart from params:', route.params?.cart?.length || 0);
      console.log('📦 CheckoutScreen - cart from hook:', hookCart.length);
      console.log('📦 Using cart:', cart.length, cart);
    }, []);

    // Check cart
    useEffect(() => {
      console.log('📦 CheckoutScreen - cart items:', cart.length, cart);
      
      if (!user) {
        Alert.alert('Login Required', 'Please login to checkout');
        navigation.goBack();
        return;
      }

      if (cart.length === 0) {
        Alert.alert('Empty Cart', 'Add items to your cart first');
        navigation.goBack();
        return;
      }
    }, [user, cart, navigation]);

    // Stall location mapping based on section
    const getStallCoordinates = (section, stallNumber) => {
      const baseLat = 13.9417;
      const baseLng = 121.1642;
      
      const sectionOffsets = {
        'Meat Section': { lat: 0.0008, lng: -0.0012 },
        'Vegetable Section': { lat: 0.0002, lng: -0.0008 },
        'Fish Section': { lat: -0.0003, lng: 0.0005 },
        'Fruit Section': { lat: 0.0005, lng: 0.0002 },
        'Dry Goods': { lat: -0.0001, lng: -0.0015 },
        'Poultry Section': { lat: 0.0010, lng: -0.0005 },
      };
      
      const offset = sectionOffsets[section] || { lat: 0, lng: 0 };
      const stallOffset = (parseInt(stallNumber) || 0) * 0.00002;
      
      return {
        latitude: baseLat + offset.lat + stallOffset,
        longitude: baseLng + offset.lng + stallOffset,
      };
    };

    const openMapsDirections = (stall) => {
      if (!stall) return;
      const coords = getStallCoordinates(stall.section, stall.stall_number);
      const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}&travelmode=walking`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open maps');
      });
    };

    const showStallMap = (stall) => {
      setSelectedStall(stall);
      setMapModalVisible(true);
    };

    const formatTime = (date) => {
      let hours = date.getHours();
      let minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      minutes = minutes < 10 ? '0' + minutes : minutes;
      return `${hours}:${minutes} ${ampm}`;
    };

    const formatDate = (date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };

    const paymongoDisplayName = paymongoType === 'paymaya' ? 'PayMaya' : 'GCash';

    const handlePaymongoPayment = async () => {
      if (!paymongoProxyUrl) {
        Alert.alert('Configuration Error', 'PayMongo proxy URL is not configured.');
        return;
      }

      setLoading(true);
      try {
        const payload = {
          amount: Math.round(cartTotal * 100),
          currency: 'PHP',
          type: paymongoType,
          success_url: paymongoSuccessUrl,
          failed_url: paymongoFailedUrl,
          description: `PalengkeHub order payment ₱${cartTotal.toFixed(2)}`,
        };

        const response = await fetch(`${paymongoProxyUrl}/paymongo/create-source`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
          const message = data?.error?.message || data?.error || 'Unable to create PayMongo payment source';
          throw new Error(message);
        }

        const redirectUrl = data?.data?.attributes?.redirect?.checkout_url || data?.data?.attributes?.redirect?.url;
        if (!redirectUrl) {
          throw new Error('PayMongo checkout URL is unavailable');
        }

        await Linking.openURL(redirectUrl);
      } catch (error) {
        console.error('PayMongo error:', error);
        Alert.alert('Payment Error', error.message || 'Could not start PayMongo payment.');
      } finally {
        setLoading(false);
      }
    };

    // groupByStall using correct item properties
    const groupByStall = () => {
      const grouped = {};
      cart.forEach(item => {
        const stallId = item.stall_id;
        if (!grouped[stallId]) {
          grouped[stallId] = {
            stall: {
              stall_name: item.stall_name,
              stall_number: item.stall_number,
              section: item.section,
              stall_id: stallId
            },
            items: []
          };
        }
        grouped[stallId].items.push({
          id: item.product_id || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          unit: item.unit,
        });
      });
      return grouped;
    };

    const placeOrder = async () => {
      setLoading(true);
      
      try {
        const groupedOrders = groupByStall();
        const ordersPlaced = [];
        
        for (const [stallId, data] of Object.entries(groupedOrders)) {
          const items = data.items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            unit: item.unit,
          }));
          
          const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          
          const orderNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          
          const orderData = {
            order_number: orderNumber,
            consumer_id: user.id,
            stall_id: parseInt(stallId),
            items: items,
            subtotal: subtotal,
            total_amount: subtotal,
            status: 'pending',
            pickup_time: pickupTime.toISOString(),
            special_instructions: specialInstructions || null,
            payment_method: paymentMethod === 'gcash' ? 'gcash' : paymentMethod === 'paymongo' ? 'paymongo' : 'cash',
            payment_status: paymentMethod === 'gcash' ? 'awaiting_payment' : paymentMethod === 'paymongo' ? 'pending' : 'cash_on_pickup',
          };
          
          console.log('📦 Placing order:', orderData);
          
          const { data: order, error } = await supabase
            .from('orders')
            .insert([orderData])
            .select()
            .single();
          
          if (error) {
            console.error('Supabase error:', error);
            throw error;
          }
          
          ordersPlaced.push(order);
          console.log('✅ Order placed:', order);
        }
        
        clearCart();
        
        // If GCash payment, show the 5-minute payment modal
        if (paymentMethod === 'gcash') {
          setGcashOrderIds(ordersPlaced.map(o => o.id));
          setGcashModalVisible(true);
          setGcashCountdown(600);
          setGcashReferenceNumber('');
          
          // Start countdown timer
          if (gcashTimerRef.current) clearInterval(gcashTimerRef.current);
          gcashTimerRef.current = setInterval(() => {
            setGcashCountdown(prev => {
              if (prev <= 1) {
                clearInterval(gcashTimerRef.current);
                // Auto-cancel orders when timer expires
                handleGcashTimeout(ordersPlaced.map(o => o.id));
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          return;
        }
        
        Alert.alert(
          '✅ Order Placed! 🎉',
          `Your order has been placed successfully!\n\nTotal: ₱${cartTotal.toFixed(2)}\nPickup: ${formatDate(pickupTime)} at ${formatTime(pickupTime)}`,
          [
            { 
              text: 'View Orders', 
              onPress: () => navigation.navigate('Orders')
            },
            { 
              text: 'Continue Shopping', 
              onPress: () => navigation.navigate('Home')
            }
          ]
        );
        
      } catch (error) {
        console.error('Error placing order:', error);
        Alert.alert('Error', 'Failed to place order. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Handle GCash payment timeout - cancel orders
    const handleGcashTimeout = async (orderIds) => {
      if (!orderIds || orderIds.length === 0) return;
      
      try {
        const { error } = await supabase
          .from('orders')
          .update({ status: 'cancelled', payment_status: 'expired' })
          .in('id', orderIds);
        
        if (error) console.error('Error cancelling expired orders:', error);
        
        Alert.alert(
          '⏰ Payment Time Expired',
          'Your payment window of 10 minutes has expired. Your order has been cancelled. Please place a new order if you still want to proceed.',
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
        );
      } catch (error) {
        console.error('GCash timeout error:', error);
      }
    };

    // Pick GCash receipt image
    const pickGcashReceipt = async () => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Please allow photo library access to upload your GCash receipt.');
          return;
        }
        
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaType.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.7,
        });
        
        if (!result.canceled && result.assets && result.assets[0]) {
          setGcashReceiptUri(result.assets[0].uri);
        }
      } catch (error) {
        console.error('Error picking receipt:', error);
        Alert.alert('Error', 'Failed to select receipt image.');
      }
    };

    // Upload GCash receipt to Supabase storage
    const uploadGcashReceipt = async (uri) => {
      if (!uri) return null;
      
      setGcashReceiptUploading(true);
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileName = `receipt_${Date.now()}.jpg`;
        const folder = `gcash_receipts/${user.id}`;
        
        const { data, error } = await supabase.storage
          .from('vendor_documents')
          .upload(`${folder}/${fileName}`, blob, {
            cacheControl: '3600',
            contentType: 'image/jpeg',
          });
        
        if (error) throw error;
        
        const { data: urlData } = supabase.storage
          .from('vendor_documents')
          .getPublicUrl(data.path);
        
        return urlData?.publicUrl || null;
      } catch (error) {
        console.error('Error uploading receipt:', error);
        Alert.alert('Upload Error', 'Failed to upload receipt. Please try again.');
        return null;
      } finally {
        setGcashReceiptUploading(false);
      }
    };

    // Submit GCash reference number + receipt
    const handleGcashSubmit = async () => {
      const refNumber = gcashReferenceNumber.trim();
      if (!refNumber) {
        Alert.alert('Missing Reference Number', 'Please enter the GCash reference number from your payment.');
        return;
      }
      
      if (refNumber.length < 6) {
        Alert.alert('Invalid Reference Number', 'The GCash reference number should be at least 6 characters.');
        return;
      }
      
      if (!gcashReceiptUri) {
        Alert.alert('Missing Receipt', 'Please upload a screenshot of your GCash receipt.');
        return;
      }
      
      setGcashSubmitting(true);
      try {
        // Upload receipt first
        const receiptUrl = await uploadGcashReceipt(gcashReceiptUri);
        if (!receiptUrl) {
          setGcashSubmitting(false);
          return;
        }
        
        // Update all orders with the reference number and receipt
        const { error } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'paid',
            payment_reference: refNumber,
            payment_receipt_url: receiptUrl,
            paid_at: new Date().toISOString(),
          })
          .in('id', gcashOrderIds);
        
        if (error) throw error;
        
        // Stop the timer
        if (gcashTimerRef.current) clearInterval(gcashTimerRef.current);
        
        setGcashModalVisible(false);
        
        Alert.alert(
          '✅ Payment Submitted! 🎉',
          'Your GCash reference number and receipt have been submitted. The vendor will verify your payment and confirm your order.',
          [
            { 
              text: 'View Orders', 
              onPress: () => navigation.navigate('Orders')
            }
          ]
        );
      } catch (error) {
        console.error('Error submitting GCash reference:', error);
        Alert.alert('Error', 'Failed to submit payment reference. Please try again.');
      } finally {
        setGcashSubmitting(false);
      }
    };

    // Format countdown as MM:SS
    const formatCountdown = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const onDateChange = (event, selectedDate) => {
      setShowDatePicker(false);
      if (selectedDate) {
        const newDate = new Date(selectedDate);
        newDate.setHours(pickupTime.getHours());
        newDate.setMinutes(pickupTime.getMinutes());
        setPickupTime(newDate);
      }
    };

    const onTimeChange = (event, selectedTime) => {
      setShowTimePicker(false);
      if (selectedTime) {
        const newTime = new Date(pickupTime);
        newTime.setHours(selectedTime.getHours());
        newTime.setMinutes(selectedTime.getMinutes());
        setPickupTime(newTime);
      }
    };

    const groupedOrders = groupByStall();

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.backContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Back to Cart</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {Object.entries(groupedOrders).length === 0 ? (
            <Text style={styles.emptyOrderText}>No items in order</Text>
          ) : (
            Object.entries(groupedOrders).map(([stallId, data]) => {
              const stallCoords = getStallCoordinates(data.stall?.section, data.stall?.stall_number);
              
              return (
                <View key={stallId} style={styles.stallSection}>
                  <Text style={styles.stallName}>{data.stall?.stall_name || 'Market Stall'}</Text>
                  <Text style={styles.stallNumber}>Stall #{data.stall?.stall_number}</Text>
                  <Text style={styles.stallSectionText}>{data.stall?.section}</Text>
                  
                  <View style={styles.productsList}>
                    {data.items.map((item, index) => (
                      <View key={index} style={styles.orderItem}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                        <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                  
                  <View style={styles.stallSubtotal}>
                    <Text style={styles.stallSubtotalLabel}>Stall Total:</Text>
                    <Text style={styles.stallSubtotalAmount}>
                      ₱{data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                    </Text>
                  </View>
                  
                  <View style={styles.mapButtonsRow}>
                    <TouchableOpacity 
                      style={styles.mapButton}
                      onPress={() => showStallMap(data.stall)}
                    >
                      <LinearGradient
                        colors={['#4CAF50', '#45A049']}
                        style={styles.mapGradient}
                      >
                        <Text style={styles.mapButtonText}>🗺️ View Map</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.directionsButton}
                      onPress={() => openMapsDirections(data.stall)}
                    >
                      <LinearGradient
                        colors={['#FF6B6B', '#FF8E8E']}
                        style={styles.mapGradient}
                      >
                        <Text style={styles.mapButtonText}>📍 Get Directions</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.miniMapPreview}
                    onPress={() => showStallMap(data.stall)}
                    activeOpacity={0.8}
                  >
                    <StallMap
                      latitude={stallCoords.latitude}
                      longitude={stallCoords.longitude}
                      stallName={data.stall?.stall_name}
                      stallNumber={data.stall?.stall_number}
                      section={data.stall?.section}
                      height={120}
                      interactive={false}
                    />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>₱{cartTotal.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Time</Text>
          
          <View style={styles.pickupRow}>
            <TouchableOpacity 
              style={[styles.pickupCard, styles.pickupCardLeft]}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.pickupIconContainer}>
                <Text style={styles.pickupIcon}>📅</Text>
              </View>
              <View style={styles.pickupInfo}>
                <Text style={styles.pickupLabel}>Date</Text>
                <Text style={styles.pickupDateTime}>{formatDate(pickupTime)}</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.pickupCard, styles.pickupCardRight]}
              onPress={() => setShowTimePicker(true)}
            >
              <View style={styles.pickupIconContainer}>
                <Text style={styles.pickupIcon}>⏰</Text>
              </View>
              <View style={styles.pickupInfo}>
                <Text style={styles.pickupLabel}>Time</Text>
                <Text style={styles.pickupDateTime}>{formatTime(pickupTime)}</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <View style={styles.pickupNote}>
            <Text style={styles.pickupNoteText}>⏰ Please arrive within 15 minutes</Text>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={pickupTime}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={onDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={pickupTime}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentOptionRow}>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('cash')}
              activeOpacity={0.8}
            >
              <Text style={[styles.paymentOptionLabel, paymentMethod === 'cash' && styles.paymentOptionLabelActive]}>Cash on Pickup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'gcash' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('gcash')}
              activeOpacity={0.8}
            >
              <Text style={[styles.paymentOptionLabel, paymentMethod === 'gcash' && styles.paymentOptionLabelActive]}>GCash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'paymongo' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('paymongo')}
              activeOpacity={0.8}
            >
              <Text style={[styles.paymentOptionLabel, paymentMethod === 'paymongo' && styles.paymentOptionLabelActive]}>PayMongo</Text>
            </TouchableOpacity>
          </View>

          {paymentMethod === 'gcash' && (
            <View style={styles.paymentTypeSection}>
              <Text style={styles.paymentTypeLabel}>💳 GCash Direct Payment</Text>
              <Text style={styles.paymentHint}>
                Pay directly to the vendor's GCash. You will have 10 minutes to complete the payment and enter your GCash reference number.
              </Text>
            </View>
          )}

          {paymentMethod === 'paymongo' && (
            <View style={styles.paymentTypeSection}>
              <Text style={styles.paymentTypeLabel}>PayMongo payment type</Text>
              <View style={styles.paymentOptionRow}>
                <TouchableOpacity
                  style={[styles.paymentOption, paymongoType === 'gcash' && styles.paymentOptionActive]}
                  onPress={() => setPaymongoType('gcash')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.paymentOptionLabel, paymongoType === 'gcash' && styles.paymentOptionLabelActive]}>GCash</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentOption, paymongoType === 'paymaya' && styles.paymentOptionActive]}
                  onPress={() => setPaymongoType('paymaya')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.paymentOptionLabel, paymongoType === 'paymaya' && styles.paymentOptionLabelActive]}>PayMaya</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.paymentHint}>You will be redirected to PayMongo to complete the {paymongoDisplayName} payment.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions</Text>
          <TextInput
            style={styles.instructionsInput}
            placeholderTextColor="#9CA3AF"
            value={specialInstructions}
            onChangeText={setSpecialInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {paymentMethod === 'cash' ? (
          <TouchableOpacity 
            style={styles.placeOrderButton}
            onPress={placeOrder}
            disabled={loading}
          >
            <LinearGradient
              colors={['#4CAF50', '#45A049']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.placeOrderGradient}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.placeOrderText}>Place Order</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : paymentMethod === 'gcash' ? (
          <TouchableOpacity 
            style={styles.placeOrderButton}
            onPress={placeOrder}
            disabled={loading}
          >
            <LinearGradient
              colors={['#007DFE', '#005BB5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.placeOrderGradient}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.placeOrderText}>Place Order & Pay via GCash</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.placeOrderButton}
            onPress={handlePaymongoPayment}
            disabled={loading}
          >
            <LinearGradient
              colors={['#2563EB', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.placeOrderGradient}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.placeOrderText}>Pay with {paymongoDisplayName}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📍 After placing your order, the vendor will prepare your items for pickup.
            Use the map to find the stall location when you arrive at the market.
          </Text>
        </View>

        {/* GCash Payment Modal with 5-minute countdown */}
        <Modal
          visible={gcashModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {}}
        >
          <View style={styles.gcashModalOverlay}>
            <View style={styles.gcashModalContent}>
              <View style={styles.gcashModalHeader}>
                <Text style={styles.gcashModalTitle}>💳 GCash Payment</Text>
                <Text style={styles.gcashModalSubtitle}>Pay directly to the vendor</Text>
              </View>

              <View style={styles.gcashTimerSection}>
                <Text style={styles.gcashTimerLabel}>⏰ Time Remaining</Text>
                <Text style={[styles.gcashTimerValue, gcashCountdown <= 60 && styles.gcashTimerUrgent]}>
                  {formatCountdown(gcashCountdown)}
                </Text>
                <Text style={styles.gcashTimerHint}>
                  Complete your payment within 10 minutes or your order will be cancelled.
                </Text>
              </View>

              <View style={styles.gcashStepsSection}>
                <Text style={styles.gcashStepsTitle}>How to pay:</Text>
                <Text style={styles.gcashStep}>1. Open your GCash app</Text>
                <Text style={styles.gcashStep}>2. Send the total amount to the vendor's GCash</Text>
                <Text style={styles.gcashStep}>3. Copy the reference number from your GCash receipt</Text>
                <Text style={styles.gcashStep}>4. Enter it below to confirm your payment</Text>
              </View>

              <View style={styles.gcashInputSection}>
                <Text style={styles.gcashInputLabel}>GCash Reference Number</Text>
                <TextInput
                  style={styles.gcashInput}
                  placeholder="e.g. 1234 5678 9012"
                  placeholderTextColor="#9CA3AF"
                  value={gcashReferenceNumber}
                  onChangeText={setGcashReferenceNumber}
                  keyboardType="numeric"
                  maxLength={20}
                />
                <Text style={styles.gcashInputHint}>
                  You can find this in your GCash app under Transaction History.
                </Text>
              </View>

              <View style={styles.gcashReceiptSection}>
                <Text style={styles.gcashInputLabel}>📸 GCash Receipt Screenshot</Text>
                <TouchableOpacity
                  style={styles.gcashReceiptButton}
                  onPress={pickGcashReceipt}
                  disabled={gcashReceiptUploading}
                >
                  {gcashReceiptUri ? (
                    <View style={styles.gcashReceiptPreviewContainer}>
                      <Image source={{ uri: gcashReceiptUri }} style={styles.gcashReceiptPreview} />
                      <Text style={styles.gcashReceiptChangeText}>Tap to change receipt</Text>
                    </View>
                  ) : (
                    <View style={styles.gcashReceiptPlaceholder}>
                      <Text style={styles.gcashReceiptIcon}>🖼️</Text>
                      <Text style={styles.gcashReceiptText}>
                        {gcashReceiptUploading ? 'Uploading...' : 'Upload Receipt Screenshot'}
                      </Text>
                      <Text style={styles.gcashReceiptHint}>
                        Take a screenshot of your GCash payment receipt
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.gcashSubmitButton}
                onPress={handleGcashSubmit}
                disabled={gcashSubmitting}
              >
                <LinearGradient
                  colors={['#007DFE', '#005BB5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gcashSubmitGradient}
                >
                  {gcashSubmitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.gcashSubmitText}>✅ Confirm Payment</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={mapModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setMapModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedStall?.stall_name || 'Stall Location'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Stall #{selectedStall?.stall_number} - {selectedStall?.section}
              </Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setMapModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕ Close</Text>
              </TouchableOpacity>
            </View>
            
            {selectedStall && (
              <StallMap
                latitude={getStallCoordinates(selectedStall.section, selectedStall.stall_number).latitude}
                longitude={getStallCoordinates(selectedStall.section, selectedStall.stall_number).longitude}
                stallName={selectedStall.stall_name}
                stallNumber={selectedStall.stall_number}
                section={selectedStall.section}
                height={height - 200}
                interactive={true}
              />
            )}
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalDirectionsButton}
                onPress={() => {
                  setMapModalVisible(false);
                  if (selectedStall) openMapsDirections(selectedStall);
                }}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E8E']}
                  style={styles.modalDirectionsGradient}
                >
                  <Text style={styles.modalDirectionsText}>📍 Get Directions</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F9FAFB',
    },
    scrollContent: {
      paddingBottom: 30,
    },
    backContainer: {
      paddingHorizontal: 16,
      paddingTop: 50,
      paddingBottom: 8,
    },
    backButton: {
      alignSelf: 'flex-start',
    },
    backText: {
      fontSize: 16,
      color: '#FF6B6B',
      fontWeight: '600',
    },
    section: {
      backgroundColor: 'white',
      margin: 16,
      marginBottom: 8,
      padding: 16,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 16,
    },
    emptyOrderText: {
      textAlign: 'center',
      color: '#6B7280',
      padding: 20,
    },
    stallSection: {
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    stallName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 4,
    },
    stallNumber: {
      fontSize: 14,
      color: '#FF6B6B',
      fontWeight: '500',
      marginBottom: 4,
    },
    stallSectionText: {
      fontSize: 13,
      color: '#6B7280',
      marginBottom: 12,
    },
    productsList: {
      marginBottom: 12,
    },
    orderItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    itemName: {
      fontSize: 14,
      color: '#111827',
      flex: 2,
    },
    itemQuantity: {
      fontSize: 14,
      color: '#6B7280',
      width: 50,
      textAlign: 'center',
    },
    itemPrice: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FF6B6B',
      width: 70,
      textAlign: 'right',
    },
    stallSubtotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 8,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: '#F3F4F6',
    },
    stallSubtotalLabel: {
      fontSize: 13,
      color: '#6B7280',
    },
    stallSubtotalAmount: {
      fontSize: 14,
      fontWeight: '600',
      color: '#FF6B6B',
    },
    mapButtonsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    mapButton: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden',
    },
    directionsButton: {
      flex: 1,
      borderRadius: 8,
      overflow: 'hidden',
    },
    mapGradient: {
      paddingVertical: 10,
      alignItems: 'center',
    },
    mapButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: 'white',
    },
    miniMapPreview: {
      marginTop: 12,
      borderRadius: 12,
      overflow: 'hidden',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
    },
    totalLabel: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827',
    },
    totalAmount: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#FF6B6B',
    },
    pickupRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    pickupCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F9FAFB',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    pickupCardLeft: {
      marginRight: 0,
    },
    pickupCardRight: {
      marginLeft: 0,
    },
    pickupIconContainer: {
      width: 40,
      height: 40,
      backgroundColor: '#FEF3F2',
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    pickupIcon: {
      fontSize: 18,
    },
    pickupInfo: {
      flex: 1,
    },
    pickupLabel: {
      fontSize: 11,
      color: '#6B7280',
      marginBottom: 2,
    },
    pickupDateTime: {
      fontSize: 14,
      fontWeight: '600',
      color: '#111827',
    },
    pickupNote: {
      marginTop: 8,
      backgroundColor: '#FEF3F2',
      padding: 10,
      borderRadius: 8,
    },
    pickupNoteText: {
      fontSize: 12,
      color: '#FF6B6B',
      textAlign: 'center',
    },
    instructionsInput: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: '#111827',
      textAlignVertical: 'top',
      minHeight: 80,
    },
    placeOrderButton: {
      marginHorizontal: 16,
      marginVertical: 16,
      borderRadius: 12,
      overflow: 'hidden',
    },
    placeOrderGradient: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    placeOrderText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    infoBox: {
      backgroundColor: '#FEF3F2',
      marginHorizontal: 16,
      marginBottom: 30,
      padding: 12,
      borderRadius: 12,
    },
    infoText: {
      fontSize: 12,
      color: '#FF6B6B',
      textAlign: 'center',
      lineHeight: 18,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: '#fff',
    },
    modalHeader: {
      paddingTop: 50,
      paddingHorizontal: 20,
      paddingBottom: 16,
      backgroundColor: '#FF6B6B',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: 'white',
    },
    modalSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.9)',
      marginTop: 4,
    },
    modalCloseButton: {
      position: 'absolute',
      top: 50,
      right: 16,
      backgroundColor: 'rgba(0,0,0,0.3)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    modalCloseText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    modalFooter: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
    },
    modalDirectionsButton: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    paymentOptionRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    paymentOption: {
      flex: 1,
      paddingVertical: 14,
      backgroundColor: '#F9FAFB',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      alignItems: 'center',
      justifyContent: 'center',
    },
    paymentOptionActive: {
      backgroundColor: '#2563EB',
      borderColor: '#2563EB',
    },
    paymentOptionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#374151',
    },
    paymentOptionLabelActive: {
      color: 'white',
    },
    paymentTypeSection: {
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      paddingTop: 12,
    },
    paymentTypeLabel: {
      fontSize: 12,
      color: '#6B7280',
      marginBottom: 8,
    },
    paymentHint: {
      fontSize: 12,
      color: '#6B7280',
      lineHeight: 18,
    },
    modalDirectionsGradient: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    modalDirectionsText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    // GCash modal styles
    gcashModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    gcashModalContent: {
      backgroundColor: 'white',
      borderRadius: 20,
      width: '100%',
      maxWidth: 400,
      padding: 20,
      maxHeight: '90%',
    },
    gcashModalHeader: {
      alignItems: 'center',
      marginBottom: 16,
    },
    gcashModalTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#007DFE',
    },
    gcashModalSubtitle: {
      fontSize: 14,
      color: '#6B7280',
      marginTop: 4,
    },
    gcashTimerSection: {
      backgroundColor: '#F0F9FF',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    gcashTimerLabel: {
      fontSize: 12,
      color: '#6B7280',
      fontWeight: '600',
    },
    gcashTimerValue: {
      fontSize: 40,
      fontWeight: 'bold',
      color: '#007DFE',
      marginVertical: 4,
    },
    gcashTimerUrgent: {
      color: '#EF4444',
    },
    gcashTimerHint: {
      fontSize: 12,
      color: '#6B7280',
      textAlign: 'center',
    },
    gcashStepsSection: {
      marginBottom: 16,
    },
    gcashStepsTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 8,
    },
    gcashStep: {
      fontSize: 13,
      color: '#4B5563',
      marginBottom: 4,
      lineHeight: 20,
    },
    gcashInputSection: {
      marginBottom: 16,
    },
    gcashInputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#111827',
      marginBottom: 8,
    },
    gcashInput: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      color: '#111827',
      backgroundColor: '#F9FAFB',
      marginBottom: 8,
    },
    gcashInputHint: {
      fontSize: 12,
      color: '#6B7280',
    },
    gcashReceiptSection: {
      marginBottom: 16,
    },
    gcashReceiptButton: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      backgroundColor: '#F9FAFB',
    },
    gcashReceiptPlaceholder: {
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gcashReceiptIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    gcashReceiptText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#007DFE',
      marginBottom: 4,
    },
    gcashReceiptHint: {
      fontSize: 12,
      color: '#6B7280',
      textAlign: 'center',
    },
    gcashReceiptPreviewContainer: {
      alignItems: 'center',
      padding: 8,
    },
    gcashReceiptPreview: {
      width: '100%',
      height: 150,
      borderRadius: 8,
      resizeMode: 'cover',
    },
    gcashReceiptChangeText: {
      fontSize: 12,
      color: '#007DFE',
      marginTop: 8,
      fontWeight: '600',
    },
    gcashSubmitButton: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    gcashSubmitGradient: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    gcashSubmitText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
