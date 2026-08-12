// src/screens/admin/AdminStallDetailsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';

const AdminStallDetailsScreen = ({ navigation, route }) => {
  const { stallId } = route.params;
  const [loading, setLoading] = useState(true);
  const [stall, setStall] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [violations, setViolations] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);

  useEffect(() => {
    fetchStallDetails();
  }, [stallId]);

  const fetchStallDetails = async () => {
    try {
      setLoading(true);

      const { data: stallData, error: stallError } = await supabase
        .from('stalls')
        .select('*')
        .eq('id', stallId)
        .single();

      if (stallError) throw stallError;
      setStall(stallData);

      if (stallData?.vendor_id) {
        const { data: vendorData, error: vendorError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, avatar_url')
          .eq('id', stallData.vendor_id)
          .single();

        if (!vendorError) {
          setVendor(vendorData);
        }
      }

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false });
      setProducts(productsData || []);

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false })
        .limit(20);
      setOrders(ordersData || []);

      const { data: violationsData } = await supabase
        .from('violations')
        .select('*')
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false })
        .limit(10);
      setViolations(violationsData || []);

      const { data: complaintsData } = await supabase
        .from('complaints')
        .select('*')
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false })
        .limit(10);
      setComplaints(complaintsData || []);

      const { data: priceHistoryData } = await supabase
        .from('price_history')
        .select('*')
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false })
        .limit(10);
      setPriceHistory(priceHistoryData || []);
    } catch (error) {
      console.error('Error fetching stall details:', error);
      Alert.alert('Error', 'Failed to load stall details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (isActive) => {
    if (isActive) {
      return { text: 'Active', color: '#10B981', bgColor: '#D1FAE5' };
    }
    return { text: 'Inactive', color: '#EF4444', bgColor: '#FEE2E2' };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateStats = () => {
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    const totalRevenue = orders
      .filter(o => o.status === 'completed')
      .reduce((sum, order) => sum + (order.total_amount || 0), 0);
    return { totalOrders, completedOrders, totalRevenue };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      case 'preparing':
        return '#8B5CF6';
      case 'ready':
        return '#14B8A6';
      case 'confirmed':
        return '#3B82F6';
      default:
        return '#F59E0B';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading stall details...</Text>
      </SafeAreaView>
    );
  }

  if (!stall) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Stall not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const stats = calculateStats();
  const status = getStatusBadge(stall.is_active);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <Header 
        title={stall.stall_name || 'Stall Details'}
        subtitle={`Stall #${stall.stall_number} • ${stall.section || 'Unassigned'}`}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerContent}>
            <View style={styles.headerIconContainer}>
              <MaterialIcons name="storefront" size={40} color="#DC2626" />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerStallName}>{stall.stall_name || 'Unnamed Stall'}</Text>
              <Text style={styles.headerStallNumber}>Stall #{stall.stall_number || 'N/A'}</Text>
              <View style={[styles.headerStatusBadge, { backgroundColor: status.bgColor }]}>
                <Text style={[styles.headerStatusText, { color: status.color }]}>{status.text}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Basic Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <MaterialIcons name="info" size={20} color="#DC2626" />
            </View>
            <Text style={styles.sectionTitle}>Basic Information</Text>
          </View>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoItemLabel}>Stall ID</Text>
            </View>
            <Text style={styles.infoItemValue}>{stall.id.slice(0, 8)}...</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoItemLabel}>Section</Text>
            </View>
            <Text style={styles.infoItemValue}>{stall.section || 'Unassigned'}</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoItemLabel}>Registered</Text>
            </View>
            <Text style={styles.infoItemValue}>{formatDate(stall.created_at)}</Text>
            {stall.approved_at && (
              <>
                <View style={styles.infoItem}>
                  <Text style={styles.infoItemLabel}>Approved</Text>
                </View>
                <Text style={styles.infoItemValue}>{formatDate(stall.approved_at)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Vendor Information Section */}
        {vendor && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <MaterialIcons name="person" size={20} color="#DC2626" />
              </View>
              <Text style={styles.sectionTitle}>Vendor Information</Text>
            </View>
            <View style={styles.vendorCard}>
              <View style={styles.vendorAvatarContainer}>
                <View style={styles.vendorAvatar}>
                  <MaterialIcons name="person" size={32} color="#DC2626" />
                </View>
              </View>
              <View style={styles.vendorDetailsContainer}>
                <Text style={styles.vendorName}>{vendor.full_name || 'N/A'}</Text>
                <View style={styles.vendorContactRow}>
                  <MaterialIcons name="email" size={16} color="#6B7280" />
                  <Text style={styles.vendorContactText}>{vendor.email || 'N/A'}</Text>
                </View>
                {vendor.phone && (
                  <View style={styles.vendorContactRow}>
                    <MaterialIcons name="phone" size={16} color="#6B7280" />
                    <Text style={styles.vendorContactText}>{vendor.phone}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Location Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <MaterialIcons name="location-on" size={20} color="#DC2626" />
            </View>
            <Text style={styles.sectionTitle}>Location</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.locationItem}>
              <View style={styles.locationIconContainer}>
                <MaterialIcons name="category" size={20} color="#DC2626" />
              </View>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Market Section</Text>
                <Text style={styles.locationValue}>{stall.section || 'Unassigned'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.locationItem}>
              <View style={styles.locationIconContainer}>
                <MaterialIcons name="pin-drop" size={20} color="#DC2626" />
              </View>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Stall Number</Text>
                <Text style={styles.locationValue}>Stall #{stall.stall_number || 'N/A'}</Text>
              </View>
            </View>
            {stall.latitude && stall.longitude && (
              <>
                <View style={styles.divider} />
                <View style={styles.locationItem}>
                  <View style={styles.locationIconContainer}>
                    <MaterialIcons name="map" size={20} color="#DC2626" />
                  </View>
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>Coordinates</Text>
                    <Text style={styles.locationValue}>
                      {stall.latitude.toFixed(6)}, {stall.longitude.toFixed(6)}
                    </Text>
                  </View>
                </View>
              </>
            )}
            {stall.location_notes && (
              <>
                <View style={styles.divider} />
                <View style={styles.locationItem}>
                  <View style={styles.locationIconContainer}>
                    <MaterialIcons name="notes" size={20} color="#DC2626" />
                  </View>
                  <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>Notes</Text>
                    <Text style={styles.locationValue}>{stall.location_notes}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Business Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <MaterialIcons name="store" size={20} color="#DC2626" />
            </View>
            <Text style={styles.sectionTitle}>Business Information</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.businessStatRow}>
              <View style={styles.businessStatItem}>
                <MaterialIcons name="inventory" size={28} color="#DC2626" />
                <Text style={styles.businessStatValue}>{products.length}</Text>
                <Text style={styles.businessStatLabel}>Products</Text>
              </View>
            </View>
            {stall.description && (
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionLabel}>Description</Text>
                <Text style={styles.descriptionText}>{stall.description}</Text>
              </View>
            )}
          </View>

          {/* Products List */}
          {products.length > 0 && (
            <View style={styles.productsContainer}>
              <Text style={styles.productsTitle}>Products ({products.length})</Text>
              {products.map((product) => (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <View style={[styles.productAvailabilityBadge, { backgroundColor: product.is_available ? '#D1FAE5' : '#FEE2E2' }]}>
                      <Text style={[styles.productAvailabilityText, { color: product.is_available ? '#10B981' : '#EF4444' }]}>
                        {product.is_available ? 'Available' : 'Unavailable'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.productCategory}>{product.category || 'Uncategorized'}</Text>
                  <View style={styles.productPriceRow}>
                    <Text style={styles.productPriceLabel}>Price:</Text>
                    <Text style={styles.productPriceValue}>{formatCurrency(product.price)} / {product.unit}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Performance Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <MaterialIcons name="trending-up" size={20} color="#DC2626" />
            </View>
            <Text style={styles.sectionTitle}>Performance</Text>
          </View>
          <View style={styles.performanceGrid}>
            <View style={styles.performanceCard}>
              <View style={styles.performanceIconContainer}>
                <MaterialIcons name="shopping-cart" size={28} color="#DC2626" />
              </View>
              <Text style={styles.performanceValue}>{stats.totalOrders}</Text>
              <Text style={styles.performanceLabel}>Total Orders</Text>
            </View>
            <View style={styles.performanceCard}>
              <View style={[styles.performanceIconContainer, { backgroundColor: '#D1FAE5' }]}>
                <MaterialIcons name="check-circle" size={28} color="#10B981" />
              </View>
              <Text style={styles.performanceValue}>{stats.completedOrders}</Text>
              <Text style={styles.performanceLabel}>Completed</Text>
            </View>
            <View style={styles.performanceCard}>
              <View style={[styles.performanceIconContainer, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="payments" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.performanceValue}>{formatCurrency(stats.totalRevenue)}</Text>
              <Text style={styles.performanceLabel}>Revenue</Text>
            </View>
          </View>

          {/* Recent Transactions */}
          {orders.length > 0 && (
            <View style={styles.transactionsContainer}>
              <Text style={styles.transactionsTitle}>Recent Transactions</Text>
              {orders.slice(0, 10).map((order) => (
                <View key={order.id} style={styles.transactionCard}>
                  <View style={styles.transactionHeader}>
                    <View style={styles.transactionLeft}>
                      <Text style={styles.transactionId}>Order #{order.id.slice(0, 8)}</Text>
                      <Text style={styles.transactionDate}>{formatDate(order.created_at)}</Text>
                    </View>
                    <View style={styles.transactionRight}>
                      <Text style={styles.transactionAmount}>{formatCurrency(order.total_amount)}</Text>
                      <View style={[styles.transactionStatusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                        <Text style={styles.transactionStatusText}>{order.status || 'Pending'}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* History Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <MaterialIcons name="history" size={20} color="#DC2626" />
            </View>
            <Text style={styles.sectionTitle}>History</Text>
          </View>

          {/* Price History */}
          {priceHistory.length > 0 && (
            <View style={styles.historyCard}>
              <View style={styles.historyCardHeader}>
                <MaterialIcons name="attach-money" size={20} color="#DC2626" />
                <Text style={styles.historyCardTitle}>Price History</Text>
              </View>
              {priceHistory.map((record, index) => (
                <View key={index} style={styles.historyItem}>
                  <View style={styles.historyContent}>
                    <Text style={styles.historyProduct}>{record.product_name || 'Product'}</Text>
                    <Text style={styles.historyDate}>{formatDate(record.created_at)}</Text>
                  </View>
                  <View style={styles.priceChangeContainer}>
                    <Text style={styles.priceOld}>{formatCurrency(record.old_price)}</Text>
                    <MaterialIcons name="arrow-forward" size={16} color="#6B7280" />
                    <Text style={styles.priceNew}>{formatCurrency(record.new_price)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Violations */}
          {violations.length > 0 && (
            <View style={styles.historyCard}>
              <View style={styles.historyCardHeader}>
                <MaterialIcons name="warning" size={20} color="#EF4444" />
                <Text style={[styles.historyCardTitle, { color: '#EF4444' }]}>Violations ({violations.length})</Text>
              </View>
              {violations.map((violation, index) => (
                <View key={index} style={styles.violationCard}>
                  <View style={styles.violationHeader}>
                    <Text style={styles.violationType}>{violation.violation_type || 'Violation'}</Text>
                    <Text style={styles.violationDate}>{formatDate(violation.created_at)}</Text>
                  </View>
                  <Text style={styles.violationReason}>{violation.reason || 'No reason provided'}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Complaints */}
          {complaints.length > 0 && (
            <View style={styles.historyCard}>
              <View style={styles.historyCardHeader}>
                <MaterialIcons name="chat-bubble-outline" size={20} color="#F59E0B" />
                <Text style={[styles.historyCardTitle, { color: '#F59E0B' }]}>Complaints ({complaints.length})</Text>
              </View>
              {complaints.map((complaint, index) => (
                <View key={index} style={styles.complaintCard}>
                  <View style={styles.complaintHeader}>
                    <Text style={styles.complaintType}>{complaint.complaint_type || 'Complaint'}</Text>
                    <Text style={styles.complaintDate}>{formatDate(complaint.created_at)}</Text>
                  </View>
                  <Text style={styles.complaintReason}>{complaint.reason || 'No reason provided'}</Text>
                </View>
              ))}
            </View>
          )}

          {/* No History Message */}
          {violations.length === 0 && complaints.length === 0 && priceHistory.length === 0 && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <MaterialIcons name="check-circle" size={48} color="#10B981" />
              </View>
              <Text style={styles.emptyText}>No violations, complaints, or price history</Text>
              <Text style={styles.emptySubtext}>This stall has a clean record</Text>
            </View>
          )}
        </View>

        {/* Activity Timeline */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <MaterialIcons name="timeline" size={20} color="#DC2626" />
            </View>
            <Text style={styles.sectionTitle}>Activity Timeline</Text>
          </View>
          <View style={styles.timelineContainer}>
            {orders.slice(0, 10).map((order, index) => (
              <View key={order.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { borderColor: getStatusColor(order.status) }]}>
                    <View style={[styles.timelineDotInner, { backgroundColor: getStatusColor(order.status) }]} />
                  </View>
                  {index < Math.min(orders.length, 10) - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineTitle}>Order #{order.id.slice(0, 8)}</Text>
                    <View style={[styles.timelineStatusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                      <Text style={styles.timelineStatusText}>{order.status || 'Pending'}</Text>
                    </View>
                  </View>
                  <Text style={styles.timelineAmount}>{formatCurrency(order.total_amount)}</Text>
                  <Text style={styles.timelineDate}>{formatDate(order.created_at)}</Text>
                </View>
              </View>
            ))}
            {orders.length === 0 && (
              <View style={styles.emptyCard}>
                <MaterialIcons name="inbox" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No activity yet</Text>
                <Text style={styles.emptySubtext}>Activity will appear here when orders are placed</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

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
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#DC2626',
    borderRadius: 12,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerStallName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerStallNumber: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  headerStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  headerStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoGrid: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoItem: {
    marginBottom: 4,
  },
  infoItemLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  infoItemValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 12,
  },
  vendorCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vendorAvatarContainer: {
    marginRight: 4,
  },
  vendorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorDetailsContainer: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  vendorContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  vendorContactText: {
    fontSize: 14,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  businessStatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  businessStatItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  businessStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  businessStatLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  descriptionContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  descriptionLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  productsContainer: {
    marginTop: 12,
  },
  productsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  productAvailabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  productAvailabilityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  productCategory: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productPriceLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  productPriceValue: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '700',
  },
  performanceGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  performanceCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  performanceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  performanceLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  transactionsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  transactionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  transactionCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
  },
  transactionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  historyContent: {
    flex: 1,
  },
  historyProduct: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  priceChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceOld: {
    fontSize: 13,
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  priceNew: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  violationCard: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  violationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  violationType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  violationReason: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  complaintCard: {
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  complaintType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  complaintReason: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIconContainer: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  timelineContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  timelineLeft: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  timelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  timelineStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timelineStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  timelineAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default AdminStallDetailsScreen;