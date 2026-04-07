import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Vibration,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../hooks/useOrders';
import StallMap from '../../components/StallMap';

const { width, height } = Dimensions.get('window');

export default function OrdersScreen({ navigation }) {
  const { isGuest } = useAuth();
  const { orders, loading, newOrderAlert, refreshOrders } = useOrders();
  const [activeTab, setActiveTab] = useState('active');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStall, setSelectedStall] = useState(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);

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
    if (!stall || !stall.section) {
      Alert.alert('Error', 'Stall location not available');
      return;
    }
    const coords = getStallCoordinates(stall.section, stall.stall_number);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}&travelmode=walking`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps');
    });
  };

  const showStallMap = (stall) => {
    if (!stall) return;
    setSelectedStall(stall);
    setMapModalVisible(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  // Show notification for new orders
  React.useEffect(() => {
    if (newOrderAlert) {
      Vibration.vibrate(200);
    }
  }, [newOrderAlert]);

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
      case 'pending': return '⏳ Pending - Waiting for vendor confirmation';
      case 'confirmed': return '✅ Confirmed - Vendor accepted your order';
      case 'preparing': return '👨‍🍳 Preparing - Vendor is preparing your items';
      case 'ready': return '🛎️ Ready for Pickup - Come pick up your order!';
      case 'completed': return '📦 Completed - Order fulfilled';
      case 'cancelled': return '❌ Cancelled';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Pending';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatPickupTime = (dateString) => {
    if (!dateString) return 'Pending';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => ['completed', 'cancelled'].includes(o.status));
  const displayOrders = activeTab === 'active' ? activeOrders : completedOrders;

  if (isGuest) {
    return (
      <View style={styles.guestContainer}>
        <Text style={styles.guestIcon}>📋</Text>
        <Text style={styles.guestTitle}>Sign in to view orders</Text>
        <Text style={styles.guestText}>
          Create an account to track your orders and order history
        </Text>
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => navigation.navigate('Login')}
        >
          <LinearGradient
            colors={['#FF6B6B', '#FF8E8E']}
            style={styles.signInGradient}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  const renderOrderCard = (order) => {
    // ✅ Safety check - provide fallback stall data
    const stall = order.stall || {
      stall_number: 'N/A',
      stall_name: 'Market Stall',
      section: 'Unknown',
      id: null
    };
    
    // ✅ Only show map if stall has valid data
    const hasValidStall = stall && stall.stall_number !== 'N/A' && stall.id;
    const stallCoords = hasValidStall 
      ? getStallCoordinates(stall.section, stall.stall_number)
      : { latitude: 13.9417, longitude: 121.1642 };
    
    return (
      <View key={order.id} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>
              Order #{order.order_number?.slice(-8) || order.id?.toString().slice(-8) || 'N/A'}
            </Text>
            <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
            <Text style={styles.statusText}>{order.status?.toUpperCase() || 'PENDING'}</Text>
          </View>
        </View>

        <View style={styles.stallInfo}>
          <Text style={styles.stallName}>
            🏪 {stall.stall_name || 'Market Stall'} {stall.stall_number !== 'N/A' ? `(#${stall.stall_number})` : ''}
          </Text>
          <Text style={styles.stallSection}>{stall.section || 'Unknown Section'}</Text>
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

        <View style={styles.pickupContainer}>
          <Text style={styles.pickupLabel}>⏰ Pickup Time:</Text>
          <Text style={styles.pickupTime}>{formatPickupTime(order.pickup_time)}</Text>
        </View>

        {order.special_instructions && (
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsLabel}>📝 Instructions:</Text>
            <Text style={styles.instructionsText}>{order.special_instructions}</Text>
          </View>
        )}

        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₱{order.total_amount}</Text>
        </View>

        {/* 🗺️ MAP SECTION - Only show for active orders with valid stall data */}
        {!['completed', 'cancelled'].includes(order.status) && hasValidStall && (
          <>
            <View style={styles.mapButtonsRow}>
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={() => showStallMap(stall)}
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
                onPress={() => openMapsDirections(stall)}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E8E']}
                  style={styles.mapGradient}
                >
                  <Text style={styles.mapButtonText}>📍 Get Directions</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {/* Map Preview */}
            <TouchableOpacity 
              style={styles.miniMapPreview}
              onPress={() => showStallMap(stall)}
              activeOpacity={0.8}
            >
              <StallMap
                latitude={stallCoords.latitude}
                longitude={stallCoords.longitude}
                stallName={stall.stall_name}
                stallNumber={stall.stall_number}
                section={stall.section}
                height={120}
                interactive={false}
              />
            </TouchableOpacity>
          </>
        )}

        {order.status === 'ready' && (
          <TouchableOpacity 
            style={styles.pickupButton}
            onPress={() => {
              Alert.alert(
                'Ready for Pickup',
                `Your order is ready! Please pick it up at:\n\n${stall.stall_name || 'Market Stall'}\nStall #${stall.stall_number || 'N/A'}\n${stall.section || 'Unknown Section'}\n\nShow this screen to the vendor.`,
                [{ text: 'OK' }]
              );
            }}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.pickupGradient}
            >
              <Text style={styles.pickupButtonText}>📦 Ready for Pickup</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {newOrderAlert && activeTab === 'active' && (
        <View style={styles.newOrderAlert}>
          <Text style={styles.newOrderAlertText}>🎉 New order placed! Check your order status below.</Text>
        </View>
      )}

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({activeOrders.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            History ({completedOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B6B']} />
        }
      >
        {displayOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'active' ? 'No Active Orders' : 'No Order History'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'active' 
                ? 'Place an order to see it here' 
                : 'Your completed orders will appear here'}
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
        ) : (
          displayOrders.map(renderOrderCard)
        )}
      </ScrollView>

      {/* 🗺️ FULL SCREEN MAP MODAL */}
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
          
          {selectedStall && selectedStall.stall_number !== 'N/A' && (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  guestIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  guestText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  signInButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  signInGradient: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  newOrderAlert: {
    backgroundColor: '#FEF3F2',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  newOrderAlertText: {
    fontSize: 13,
    color: '#FF6B6B',
    textAlign: 'center',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FEF3F2',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
  },
  orderDate: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  stallInfo: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  stallName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  stallSection: {
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
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginBottom: 12,
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
  mapButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
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
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickupButton: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pickupGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
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
  // Modal styles
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