import React, { useState, useEffect } from 'react';
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
} from 'react-native';
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
        <Text style={styles.sectionTitle}>Special Instructions</Text>
        <TextInput
          style={styles.instructionsInput}
          placeholder="e.g., Extra spicy, no onions, etc."
          placeholderTextColor="#9CA3AF"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
        />
      </View>

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

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          📍 After placing your order, the vendor will prepare your items for pickup.
          Use the map to find the stall location when you arrive at the market.
        </Text>
      </View>

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
  modalDirectionsGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDirectionsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});