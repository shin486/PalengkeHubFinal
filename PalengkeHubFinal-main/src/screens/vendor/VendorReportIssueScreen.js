import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function VendorReportIssueScreen({ navigation, route }) {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState(route.params?.type || null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Customer selection states
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [orderId, setOrderId] = useState(route.params?.orderId || '');
  const [orderNumber, setOrderNumber] = useState(route.params?.orderNumber || '');

  // Pre-fill from route params if coming from order
  useEffect(() => {
    if (route.params?.customerId && route.params?.customerName) {
      setSelectedCustomer({
        id: route.params.customerId,
        name: route.params.customerName,
      });
    }
    if (route.params?.orderId) {
      setOrderId(route.params.orderId);
    }
    if (route.params?.orderNumber) {
      setOrderNumber(route.params.orderNumber);
    }
  }, [route.params]);

  const reportTypes = [
    { id: 'customer_behavior', label: 'Customer Behavior', icon: '👤', color: '#EF4444' },
    { id: 'order_issue', label: 'Order Issue', icon: '📋', color: '#F59E0B' },
    { id: 'payment_issue', label: 'Payment Problem', icon: '💰', color: '#3B82F6' },
    { id: 'fraud', label: 'Suspicious Activity', icon: '⚠️', color: '#8B5CF6' },
    { id: 'other', label: 'Other', icon: '📝', color: '#6B7280' },
  ];

  // Fetch customers who have ordered from this vendor
  const fetchCustomers = async () => {
    if (!user?.id) return;
    
    setLoadingCustomers(true);
    try {
      // Get stall first (vendor's stall)
      const { data: stall, error: stallError } = await supabase
        .from('stalls')
        .select('id')
        .eq('vendor_id', user.id)
        .single();

      if (stallError) {
        console.error('Stall error:', stallError);
        setLoadingCustomers(false);
        return;
      }

      if (!stall) {
        console.log('No stall found for vendor');
        setLoadingCustomers(false);
        return;
      }

      // Get unique customers from orders using consumer_id
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          consumer_id,
          profiles:consumer_id (
            id,
            full_name,
            email
          )
        `)
        .eq('stall_id', stall.id)
        .not('consumer_id', 'is', null)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Orders error:', ordersError);
        setLoadingCustomers(false);
        return;
      }

      // Deduplicate customers
      const uniqueCustomers = [];
      const seenIds = new Set();
      
      orders?.forEach(order => {
        // The profiles data might be nested or directly available
        let customer = order.profiles;
        
        // If profiles is not available, try to get from order directly
        if (!customer && order.consumer_id) {
          customer = {
            id: order.consumer_id,
            full_name: null,
            email: null,
          };
        }
        
        if (customer && customer.id && !seenIds.has(customer.id)) {
          seenIds.add(customer.id);
          uniqueCustomers.push({
            id: customer.id,
            name: customer.full_name || `Customer ${customer.id.slice(-6)}`,
            email: customer.email || 'No email',
          });
        }
      });

      // If no customers found via orders, try a different approach
      if (uniqueCustomers.length === 0) {
        // Try to get all consumers who have orders with this vendor
        const { data: consumerOrders, error: consumerError } = await supabase
          .from('orders')
          .select('consumer_id')
          .eq('stall_id', stall.id)
          .not('consumer_id', 'is', null);

        if (!consumerError && consumerOrders) {
          const uniqueConsumerIds = [...new Set(consumerOrders.map(o => o.consumer_id))];
          
          if (uniqueConsumerIds.length > 0) {
            const { data: consumerProfiles } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', uniqueConsumerIds);
            
            if (consumerProfiles) {
              consumerProfiles.forEach(profile => {
                uniqueCustomers.push({
                  id: profile.id,
                  name: profile.full_name || `Customer ${profile.id.slice(-6)}`,
                  email: profile.email || 'No email',
                });
              });
            }
          }
        }
      }

      setCustomers(uniqueCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a report type');
      return;
    }

    if (!selectedCustomer) {
      Alert.alert('Error', 'Please select a customer to report');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please describe the issue');
      return;
    }

    setLoading(true);
    try {
      const reportData = {
        vendor_id: user.id,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        report_type: selectedType,
        description: description.trim(),
        status: 'pending',
      };

      if (orderId) {
        reportData.order_id = orderId;
      }

      const { error } = await supabase.from('vendor_reports').insert(reportData);

      if (error) throw error;

      Alert.alert(
        '✅ Report Submitted',
        'Thank you for your report. Our admin team will review it.',
        [
          {
            text: 'View My Reports',
            onPress: () => navigation.navigate('VendorReportsList'),
          },
          {
            text: 'Back',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      
      // Reset form
      setSelectedType(null);
      setSelectedCustomer(null);
      setDescription('');
      setOrderId('');
      setOrderNumber('');
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderCustomerItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.customerItem,
        selectedCustomer?.id === item.id && styles.customerItemSelected,
      ]}
      onPress={() => {
        setSelectedCustomer(item);
        setCustomerModalVisible(false);
      }}
    >
      <View style={styles.customerAvatar}>
        <Text style={styles.customerAvatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{item.name}</Text>
        <Text style={styles.customerEmail}>{item.email}</Text>
      </View>
      {selectedCustomer?.id === item.id && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView>
        <LinearGradient
          colors={['#DC2626', '#EF4444']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>🚩 Report a Customer</Text>
          <Text style={styles.headerSubtitle}>
            Report problematic customer behavior or issues
          </Text>
        </LinearGradient>

        {/* Customer Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Customer *</Text>
          
          {selectedCustomer ? (
            <View style={styles.selectedCustomerContainer}>
              <View style={styles.selectedCustomerInfo}>
                <View style={styles.customerAvatarSmall}>
                  <Text style={styles.customerAvatarSmallText}>
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
                  <Text style={styles.selectedCustomerEmail}>{selectedCustomer.email}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.changeCustomerButton}
                onPress={() => {
                  setSelectedCustomer(null);
                  setCustomerModalVisible(true);
                }}
              >
                <Text style={styles.changeCustomerText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.selectCustomerButton}
              onPress={() => {
                fetchCustomers();
                setCustomerModalVisible(true);
              }}
            >
              <Text style={styles.selectCustomerIcon}>👤</Text>
              <Text style={styles.selectCustomerText}>Select a customer to report</Text>
            </TouchableOpacity>
          )}

          {/* Order ID (Optional) */}
          <TextInput
            style={[styles.input, styles.orderInput]}
            placeholder="Order ID (Optional)"
            value={orderId}
            onChangeText={setOrderId}
          />
          {orderNumber ? (
            <Text style={styles.orderNumberText}>Order #{orderNumber}</Text>
          ) : null}
        </View>

        {/* Report Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Type *</Text>
          <View style={styles.typesGrid}>
            {reportTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && styles.typeCardActive,
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text style={styles.typeLabel}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Please describe the issue in detail..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={styles.helperText}>
            Include order numbers, dates, and any supporting information
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient
            colors={['#DC2626', '#EF4444']}
            style={styles.submitGradient}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitText}>Submit Report</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            False reports may result in account action. Please only report genuine issues.
          </Text>
        </View>
      </ScrollView>

      {/* Customer Selection Modal */}
      <Modal
        visible={customerModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setCustomerModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search customers..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {loadingCustomers ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#DC2626" />
              <Text style={styles.modalLoadingText}>Loading customers...</Text>
            </View>
          ) : customers.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Text style={styles.modalEmptyIcon}>📭</Text>
              <Text style={styles.modalEmptyTitle}>No customers found</Text>
              <Text style={styles.modalEmptyText}>
                Customers who have ordered from you will appear here
              </Text>
            </View>
          ) : (
            <FlatList
              data={customers.filter(c => 
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.email.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              renderItem={renderCustomerItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.customersList}
            />
          )}
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 24,
    paddingTop: 48,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  // Customer Selection Styles
  selectCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  selectCustomerIcon: {
    fontSize: 24,
  },
  selectCustomerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  selectedCustomerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  selectedCustomerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerAvatarSmallText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  selectedCustomerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  selectedCustomerEmail: {
    fontSize: 12,
    color: '#6B7280',
  },
  changeCustomerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  changeCustomerText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  orderInput: {
    marginTop: 12,
  },
  orderNumberText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    width: '30%',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  typeCardActive: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  submitButton: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalCloseText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
  customersList: {
    paddingHorizontal: 16,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  customerItemSelected: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  customerEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    color: '#10B981',
    fontWeight: 'bold',
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  modalEmptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  modalEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});