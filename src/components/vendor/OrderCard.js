import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const OrderCard = ({ order, onUpdateStatus }) => {
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

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '⏳ Pending';
      case 'confirmed': return '✅ Confirmed';
      case 'preparing': return '👨‍🍳 Preparing';
      case 'ready': return '🛎️ Ready for Pickup';
      case 'completed': return '📦 Completed';
      case 'cancelled': return '❌ Cancelled';
      default: return status;
    }
  };

  const getNextStatus = (status) => {
    const flow = {
      pending: { status: 'confirmed', label: 'Confirm Order' },
      confirmed: { status: 'preparing', label: 'Start Preparing' },
      preparing: { status: 'ready', label: 'Mark Ready' },
      ready: { status: 'completed', label: 'Complete Order' },
    };
    return flow[status];
  };

  const nextStep = getNextStatus(order.status);
  const canUpdate = nextStep && order.status !== 'completed' && order.status !== 'cancelled';

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>Order #{order.order_number?.slice(-8) || order.id.slice(-8)}</Text>
          <Text style={styles.orderTime}>{formatDate(order.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
        </View>
      </View>
      
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>👤 {order.profiles?.full_name || 'Customer'}</Text>
        {order.profiles?.phone && (
          <Text style={styles.customerPhone}>📞 {order.profiles.phone}</Text>
        )}
      </View>
      
      <View style={styles.itemsContainer}>
        {order.items?.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemName}>
              {item.quantity}x {item.name}
            </Text>
            <Text style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}
      </View>
      
      {order.special_instructions && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsLabel}>📝 Special Instructions:</Text>
          <Text style={styles.instructionsText}>{order.special_instructions}</Text>
        </View>
      )}
      
      <View style={styles.pickupContainer}>
        <Text style={styles.pickupLabel}>⏰ Pickup Time:</Text>
        <Text style={styles.pickupTime}>{formatTime(order.pickup_time)}</Text>
      </View>
      
      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₱{order.total_amount}</Text>
        </View>
        
        {canUpdate && (
          <TouchableOpacity 
            style={styles.updateButton}
            onPress={() => onUpdateStatus(order.id, nextStep.status)}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF8E8E']}
              style={styles.updateGradient}
            >
              <Text style={styles.updateText}>{nextStep.label}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        {order.status === 'cancelled' && (
          <View style={styles.cancelledBadge}>
            <Text style={styles.cancelledText}>Order Cancelled</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  orderTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  customerInfo: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  customerPhone: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  itemsContainer: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemName: {
    fontSize: 13,
    color: '#374151',
    flex: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FF6B6B',
  },
  instructionsContainer: {
    backgroundColor: '#FEF3F2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  instructionsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 12,
    color: '#374151',
  },
  pickupContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  pickupLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  pickupTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  updateButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  updateGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  updateText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  cancelledBadge: {
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelledText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
});