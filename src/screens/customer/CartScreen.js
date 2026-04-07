import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useCart } from '../../hooks/useCart';

export default function CartScreen({ navigation }) {
  const { cart, cartTotal, updateQuantity, removeItem, clearCart, refreshCart } = useCart();
  const [refreshing, setRefreshing] = useState(false);

  // Refresh cart when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 CartScreen focused, refreshing cart...');
      refreshCart();
      return () => {};
    }, [refreshCart])
  );

  // Refresh on mount
  useEffect(() => {
    refreshCart();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCart();
    setRefreshing(false);
  };

  const updateItemQuantity = (item, change) => {
    const newQuantity = (item.quantity || 1) + change;
    if (newQuantity <= 0) {
      Alert.alert(
        'Remove Item',
        `Remove ${item.name} from cart?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', onPress: () => removeItem(item.product_id) }
        ]
      );
    } else {
      updateQuantity(item.product_id, newQuantity);
    }
  };

  if (cart.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyText}>
          Add items from the market to get started
        </Text>
        <TouchableOpacity 
          style={styles.shopButton}
          onPress={() => navigation.navigate('Home')}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E8E']}
            style={styles.shopGradient}
          >
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

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
          },
          items: []
        };
      }
      grouped[stallId].items.push(item);
    });
    return grouped;
  };

  const groupedCart = groupByStall();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B6B']} />
        }
      >
        {Object.entries(groupedCart).map(([stallId, data]) => (
          <View key={stallId} style={styles.stallSection}>
            <View style={styles.stallHeader}>
              <Text style={styles.stallName}>
                {data.stall?.stall_name || 'Market Stall'}
              </Text>
              <Text style={styles.stallNumber}>Stall #{data.stall?.stall_number}</Text>
            </View>
            
            {data.items.map((item) => (
              <View key={item.product_id} style={styles.cartItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₱{item.price} / {item.unit}</Text>
                </View>
                
                <View style={styles.quantityControls}>
                  <TouchableOpacity 
                    style={styles.quantityButton}
                    onPress={() => updateItemQuantity(item, -1)}
                  >
                    <Text style={styles.quantityButtonText}>-</Text>
                  </TouchableOpacity>
                  
                  <Text style={styles.quantityText}>{item.quantity || 1}</Text>
                  
                  <TouchableOpacity 
                    style={styles.quantityButton}
                    onPress={() => updateItemQuantity(item, 1)}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </TouchableOpacity>
                  
                  <Text style={styles.itemTotal}>
                    ₱{((item.quantity || 1) * item.price).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
            
            <View style={styles.stallTotal}>
              <Text style={styles.stallTotalLabel}>Stall Total:</Text>
              <Text style={styles.stallTotalAmount}>
                ₱{data.items.reduce((sum, item) => sum + ((item.quantity || 1) * item.price), 0).toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
        
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₱{cartTotal.toFixed(2)}</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.clearCartButton}
          onPress={() => {
            Alert.alert(
              'Clear Cart',
              'Are you sure you want to remove all items?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', onPress: clearCart, style: 'destructive' }
              ]
            );
          }}
        >
          <Text style={styles.clearCartText}>Clear Cart</Text>
        </TouchableOpacity>
      </ScrollView>
      
      <View style={styles.footer}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerTotalLabel}>Total:</Text>
          <Text style={styles.footerTotalAmount}>₱{cartTotal.toFixed(2)}</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.checkoutButton}
          onPress={() => {
            console.log('🚀 Navigating to Checkout with cart:', cart);
            console.log('📦 Cart items count:', cart.length);
            console.log('💰 Cart total:', cartTotal);
            
            // Pass cart data directly to Checkout
            navigation.navigate('Checkout', { 
              cart: cart, 
              cartTotal: cartTotal 
            });
          }}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E8E']}
            style={styles.checkoutGradient}
          >
            <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  shopButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  shopGradient: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  shopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  stallSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stallHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stallName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  stallNumber: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 2,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemInfo: {
    flex: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  itemPrice: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    minWidth: 30,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    minWidth: 70,
    textAlign: 'right',
  },
  stallTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  stallTotalLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  stallTotalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  totalSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  clearCartButton: {
    alignItems: 'center',
    padding: 12,
  },
  clearCartText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  footer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  footerTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  footerTotalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  checkoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkoutGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});