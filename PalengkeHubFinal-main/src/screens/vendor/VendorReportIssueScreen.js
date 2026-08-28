import React, { useState, useEffect, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';

export default function VendorReportIssueScreen({ navigation, route }) {
  const { user } = useAuth();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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

  // Each report type keeps its own distinct category color (not the brand
  // color) so they stay visually distinguishable from one another.
  const reportTypes = [
    { id: 'customer_behavior', label: 'Customer Behavior', icon: 'person', color: '#EF4444' },
    { id: 'order_issue', label: 'Order Issue', icon: 'clipboard', color: '#F59E0B' },
    { id: 'payment_issue', label: 'Payment Problem', icon: 'cash', color: '#3B82F6' },
    { id: 'fraud', label: 'Suspicious Activity', icon: 'warning', color: '#8B5CF6' },
    { id: 'other', label: 'Other', icon: 'create', color: '#6B7280' },
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
        'Report Submitted',
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
          colors={[COLORS.primary, COLORS.primaryLight]}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Report a Customer</Text>
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
              <Ionicons name="person" size={20} color={COLORS.text.quaternary} style={styles.selectCustomerIcon} />
              <Text style={styles.selectCustomerText}>Select a customer to report</Text>
            </TouchableOpacity>
          )}

          {/* Order ID (Optional) */}
          <TextInput
            style={[styles.input, styles.orderInput]}
            placeholder="Order ID (Optional)"
            placeholderTextColor={COLORS.text.quaternary}
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
                <Ionicons name={type.icon} size={24} color={selectedType === type.id ? COLORS.text.inverse : COLORS.primary} />
                <Text style={[styles.typeLabel, selectedType === type.id && styles.typeLabelActive]}>{type.label}</Text>
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
            placeholderTextColor={COLORS.text.quaternary}
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
            colors={[COLORS.primary, COLORS.primaryLight]}
            style={styles.submitGradient}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text.inverse} />
            ) : (
              <Text style={styles.submitText}>Submit Report</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.info} style={styles.infoIcon} />
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
            <Ionicons name="search" size={18} color={COLORS.text.quaternary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search customers..."
              placeholderTextColor={COLORS.text.quaternary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {loadingCustomers ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.modalLoadingText}>Loading customers...</Text>
            </View>
          ) : customers.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Ionicons name="mail-open-outline" size={48} color={COLORS.text.quaternary} />
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

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    color: COLORS.text.inverse,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  section: {
    backgroundColor: COLORS.surface,
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
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  // Customer Selection Styles
  selectCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSecondary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  selectCustomerIcon: {
    fontSize: 24,
  },
  selectCustomerText: {
    fontSize: 14,
    color: COLORS.text.tertiary,
  },
  selectedCustomerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.successLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.success,
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
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerAvatarSmallText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.inverse,
  },
  selectedCustomerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  selectedCustomerEmail: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  changeCustomerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  changeCustomerText: {
    fontSize: 12,
    color: COLORS.text.inverse,
    fontWeight: '500',
  },
  orderInput: {
    marginTop: 12,
  },
  orderNumberText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginTop: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    width: '30%',
    backgroundColor: COLORS.surfaceSecondary,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  typeCardActive: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  typeLabelActive: {
    color: COLORS.text.inverse,
  },
  textArea: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text.primary,
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
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
    color: COLORS.text.inverse,
    fontSize: 18,
    fontWeight: '600',
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: COLORS.infoLight,
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
    color: COLORS.info,
    lineHeight: 18,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.primary,
  },
  modalCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalCloseText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text.primary,
  },
  customersList: {
    paddingHorizontal: 16,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  customerItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.accentSoft,
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.inverse,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  customerEmail: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    color: COLORS.text.tertiary,
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
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  modalEmptyText: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
});
