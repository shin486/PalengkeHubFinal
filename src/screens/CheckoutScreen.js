import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../hooks/useCart';

export default function CheckoutScreen({ navigation }) {
  const { user } = useAuth();
  const { cart, cartTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);

  if (!user) {
    Alert.alert('Login Required', 'Please login to checkout');
    navigation.goBack();
    return null;
  }

  if (cart.length === 0) {
    Alert.alert('Empty Cart', 'Add items to your cart first');
    navigation.goBack();
    return null;
  }

  console.log('🛒 Cart in Checkout:', cart);

  const groupByStall = () => {
    const grouped = {};
    cart.forEach(item => {
      const stallId = item.stall_id;
      if (!grouped[stallId]) {
        grouped[stallId] = {
          stall: item.stalls,
          items: []
        };
      }
      grouped[stallId].items.push({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        unit: item.unit,
      });
    });
    return grouped;
  };

  const openDirections = (stall) => {
    const marketLat = 13.9417;
    const marketLng = 121.1642;
    const section = stall?.section || 'Meat Section';
    const url = `https://www.google.com/maps/search/?api=1&query=${marketLat},${marketLng}&query_place_id=${encodeURIComponent(`Stall ${stall.stall_number} ${section} Lipa City Public Market`)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps');
    });
  };

  const placeOrder = async () => {
    setLoading(true);
    
    try {
      const groupedOrders = groupByStall();
      const ordersPlaced = [];
      
      // Create orders for each stall
      for (const [stallId, data] of Object.entries(groupedOrders)) {
        const items = data.items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          unit: item.unit,
        }));
        
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const orderData = {
          consumer_id: user.id,
          stall_id: parseInt(stallId),
          items: items,
          subtotal: subtotal,
          total_amount: subtotal,
          status: 'pending',
          pickup_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          special_instructions: null,
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
      
      // Clear cart and show success
      clearCart();
      
      Alert.alert(
        '✅ Order Placed!',
        `Your order has been successfully placed!\n\nOrder ID: ${ordersPlaced[0]?.order_number || 'pending'}\nTotal: ₱${cartTotal.toFixed(2)}`,
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

  const groupedOrders = groupByStall();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Back Button */}
      <View style={styles.backContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back to Cart</Text>
        </TouchableOpacity>
      </View>

      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        {Object.entries(groupedOrders).map(([stallId, data]) => (
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
            
            <TouchableOpacity style={styles.directionsButton} onPress={() => openDirections(data.stall)}>
              <Text style={styles.directionsButtonText}>📍 Get Directions to Stall</Text>
            </TouchableOpacity>
          </View>
        ))}
        
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₱{cartTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* Place Order Button */}
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

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          📍 After placing your order, the vendor will prepare your items for pickup.
          You can track your order status in the Orders tab.
        </Text>
      </View>
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
  directionsButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  directionsButtonText: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '500',
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
});