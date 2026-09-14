// src/screens/vendor/VendorReportIssueScreen.js
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContext';
import {
  useVendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
} from '../../theme/vendorTheme';

export default function VendorReportIssueScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const vendorColors = useVendorColors();
  const styles = useMemo(() => createStyles(vendorColors), [vendorColors]);

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

  const reportTypes = useMemo(() => [
    { id: 'customer_behavior', labelKey: 'type_customer_behavior', defaultLabel: 'Customer Behavior', icon: 'person-outline' },
    { id: 'order_issue', labelKey: 'type_order_issue', defaultLabel: 'Order Issue', icon: 'receipt-outline' },
    { id: 'payment_issue', labelKey: 'type_payment_issue', defaultLabel: 'Payment Problem', icon: 'card-outline' },
    { id: 'fraud', labelKey: 'type_fraud', defaultLabel: 'Suspicious Activity', icon: 'alert-circle-outline' },
    { id: 'other', labelKey: 'type_other', defaultLabel: 'Other', icon: 'create-outline' },
  ], []);

  // Fetch customers who have ordered from this vendor via get_my_stall_customers RPC
  const fetchCustomers = async () => {
    if (!user?.id) return;

    setLoadingCustomers(true);
    try {
      const { data, error } = await supabase.rpc('get_my_stall_customers');

      if (error) {
        console.error('get_my_stall_customers error:', error);
        setLoadingCustomers(false);
        return;
      }

      const uniqueCustomers = (data || []).map((customer) => ({
        id: customer.id,
        name: customer.full_name || `Customer ${customer.id.slice(-6)}`,
        email: customer.email || 'No email',
      }));

      setCustomers(uniqueCustomers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      if (Platform.OS === 'web') {
        window.alert(t('vendor_report_issue.alert_load_customers_failed', 'Failed to load customers'));
      } else {
        Alert.alert(
          t('vendor_report_issue.alert_error_title', 'Error'),
          t('vendor_report_issue.alert_load_customers_failed', 'Failed to load customers')
        );
      }
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      if (Platform.OS === 'web') {
        window.alert(t('vendor_report_issue.alert_select_type', 'Please select a report type'));
      } else {
        Alert.alert(
          t('vendor_report_issue.alert_error_title', 'Error'),
          t('vendor_report_issue.alert_select_type', 'Please select a report type')
        );
      }
      return;
    }

    if (!selectedCustomer) {
      if (Platform.OS === 'web') {
        window.alert(t('vendor_report_issue.alert_select_customer', 'Please select a customer to report'));
      } else {
        Alert.alert(
          t('vendor_report_issue.alert_error_title', 'Error'),
          t('vendor_report_issue.alert_select_customer', 'Please select a customer to report')
        );
      }
      return;
    }

    if (!description.trim()) {
      if (Platform.OS === 'web') {
        window.alert(t('vendor_report_issue.alert_describe_issue', 'Please describe the issue'));
      } else {
        Alert.alert(
          t('vendor_report_issue.alert_error_title', 'Error'),
          t('vendor_report_issue.alert_describe_issue', 'Please describe the issue')
        );
      }
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

      if (Platform.OS === 'web') {
        window.alert(t('vendor_report_issue.alert_success_message', 'Thank you for your report. Our admin team will review it.'));
        navigation.goBack();
      } else {
        Alert.alert(
          t('vendor_report_issue.alert_success_title', 'Report Submitted'),
          t('vendor_report_issue.alert_success_message', 'Thank you for your report. Our admin team will review it.'),
          [
            {
              text: t('vendor_report_issue.alert_view_reports', 'View My Reports'),
              onPress: () => navigation.navigate('VendorReportsList'),
            },
            {
              text: t('common.ok', 'OK'),
              style: 'cancel',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }

      // Reset form
      setSelectedType(null);
      setSelectedCustomer(null);
      setDescription('');
      setOrderId('');
      setOrderNumber('');
    } catch (error) {
      console.error('Error submitting report:', error);
      if (Platform.OS === 'web') {
        window.alert(t('vendor_report_issue.alert_failed', 'Failed to submit report. Please try again.'));
      } else {
        Alert.alert(
          t('vendor_report_issue.alert_error_title', 'Error'),
          t('vendor_report_issue.alert_failed', 'Failed to submit report. Please try again.')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const renderCustomerItem = ({ item }) => {
    const isSelected = selectedCustomer?.id === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.customerItem,
          isSelected && styles.customerItemSelected,
        ]}
        onPress={() => {
          setSelectedCustomer(item);
          setCustomerModalVisible(false);
        }}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.customerAvatar,
            { backgroundColor: isSelected ? vendorColors.primary : vendorColors.accentSoft },
          ]}
        >
          <Text
            style={[
              styles.customerAvatarText,
              { color: isSelected ? '#FFFFFF' : vendorColors.primary },
            ]}
          >
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
            {item.name}
          </Text>
          <Text style={[styles.customerEmail, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
            {item.email}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={22} color={vendorColors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Standard Unified Header with Back Button */}
      <Header
        title={t('vendor_report_issue.title', 'Report a Customer')}
        subtitle={t('vendor_report_issue.subtitle', 'Report problematic customer behavior or issues')}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer Selection Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: vendorColors.accentSoft }]}>
              <Ionicons name="person-outline" size={18} color={vendorColors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
              {t('vendor_report_issue.select_customer', 'Select Customer')}
              <Text style={styles.requiredAsterisk}> *</Text>
            </Text>
          </View>

          {selectedCustomer ? (
            <View style={styles.selectedCustomerCard}>
              <View style={styles.selectedCustomerLeft}>
                <View style={[styles.customerAvatarSmall, { backgroundColor: vendorColors.accentSoft }]}>
                  <Text style={[styles.customerAvatarSmallText, { color: vendorColors.primary }]}>
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.selectedCustomerDetails}>
                  <Text style={[styles.selectedCustomerName, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                    {selectedCustomer.name}
                  </Text>
                  <Text style={[styles.selectedCustomerEmail, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                    {selectedCustomer.email}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.changeCustomerButton}
                onPress={() => {
                  fetchCustomers();
                  setCustomerModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.changeCustomerText}>
                  {t('vendor_report_issue.change_customer', 'Change')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.selectCustomerButton}
              onPress={() => {
                fetchCustomers();
                setCustomerModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.selectCustomerLeft}>
                <View style={[styles.customerPlaceholderIcon, { backgroundColor: vendorColors.accentSoft }]}>
                  <Ionicons name="person-search-outline" size={20} color={vendorColors.primary} />
                </View>
                <Text style={[styles.selectCustomerText, { color: vendorColors.isDark ? '#C8B6A6' : '#7C6758' }]}>
                  {t('vendor_report_issue.select_customer_placeholder', 'Select a customer to report')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={vendorColors.isDark ? '#C8B6A6' : '#7C6758'} />
            </TouchableOpacity>
          )}

          {/* Order ID Input (Optional) */}
          <View style={styles.orderIdContainer}>
            <Text style={[styles.inputLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
              {t('vendor_report_issue.order_id_label', 'Order ID (Optional)')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: vendorColors.surfaceAlt,
                  color: vendorColors.isDark ? '#FFFFFF' : '#261006',
                  borderColor: vendorColors.border,
                },
              ]}
              placeholder={t('vendor_report_issue.order_id_placeholder', 'e.g. 12345 or tap to enter')}
              placeholderTextColor={vendorColors.isDark ? '#8A7263' : '#A89282'}
              value={orderId}
              onChangeText={setOrderId}
            />
            {orderNumber ? (
              <View style={styles.orderNumberBadge}>
                <Ionicons name="receipt-outline" size={14} color={vendorColors.primary} />
                <Text style={[styles.orderNumberText, { color: vendorColors.primary }]}>
                  {t('vendor_report_issue.order_number', 'Order #%{number}', { number: orderNumber })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Report Type Selection Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: vendorColors.accentSoft }]}>
              <Ionicons name="alert-circle-outline" size={18} color={vendorColors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
              {t('vendor_report_issue.report_type', 'Report Type')}
              <Text style={styles.requiredAsterisk}> *</Text>
            </Text>
          </View>

          <View style={styles.typesGrid}>
            {reportTypes.map((type) => {
              const isSelected = selectedType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeCard,
                    {
                      backgroundColor: isSelected
                        ? (vendorColors.isDark ? '#3A2415' : '#FFF3E8')
                        : vendorColors.surfaceAlt,
                      borderColor: isSelected ? vendorColors.primary : vendorColors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                    type.id === 'other' && styles.typeCardFull,
                  ]}
                  onPress={() => setSelectedType(type.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.typeIconCircle,
                      {
                        backgroundColor: isSelected
                          ? vendorColors.primary
                          : (vendorColors.isDark ? '#2B1B10' : '#F5E7D5'),
                      },
                    ]}
                  >
                    <Ionicons
                      name={type.icon}
                      size={20}
                      color={isSelected ? '#FFFFFF' : vendorColors.primary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.typeLabel,
                      {
                        color: isSelected
                          ? (vendorColors.isDark ? '#FFFFFF' : '#261006')
                          : (vendorColors.isDark ? '#E2D3C4' : '#5B4436'),
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {t('vendor_report_issue.' + type.labelKey, type.defaultLabel)}
                  </Text>
                  {isSelected && (
                    <View style={styles.selectedCheckCircle}>
                      <Ionicons name="checkmark" size={12} color={vendorColors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: vendorColors.accentSoft }]}>
              <Ionicons name="document-text-outline" size={18} color={vendorColors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
              {t('vendor_report_issue.description', 'Description')}
              <Text style={styles.requiredAsterisk}> *</Text>
            </Text>
          </View>

          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: vendorColors.surfaceAlt,
                color: vendorColors.isDark ? '#FFFFFF' : '#261006',
                borderColor: vendorColors.border,
              },
            ]}
            placeholder={t('vendor_report_issue.description_placeholder', 'Please describe the issue in detail...')}
            placeholderTextColor={vendorColors.isDark ? '#8A7263' : '#A89282'}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={[styles.helperText, { color: vendorColors.isDark ? '#C8B6A6' : '#7C6758' }]}>
            {t('vendor_report_issue.description_helper', 'Include order numbers, dates, and any supporting information')}
          </Text>
        </View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: vendorColors.primary },
              loading && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.submitContent}>
                <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitText}>
                  {t('vendor_report_issue.submit_button', 'Submit Report')}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Note */}
        <View
          style={[
            styles.infoNote,
            {
              backgroundColor: vendorColors.isDark ? '#1F2937' : '#EFF6FF',
              borderColor: vendorColors.isDark ? '#374151' : '#BFDBFE',
            },
          ]}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color={vendorColors.info} style={styles.infoIcon} />
          <Text style={[styles.infoText, { color: vendorColors.isDark ? '#D1D5DB' : '#1E40AF' }]}>
            {t('vendor_report_issue.info_note', 'False reports may result in account action. Please only report genuine issues.')}
          </Text>
        </View>
      </ScrollView>

      {/* Customer Selection Modal */}
      <Modal
        visible={customerModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                {t('vendor_report_issue.modal_title', 'Select Customer')}
              </Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setCustomerModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={vendorColors.isDark ? '#FFFFFF' : '#261006'} />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={vendorColors.isDark ? '#C8B6A6' : '#7C6758'} />
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: vendorColors.isDark ? '#FFFFFF' : '#261006',
                  },
                ]}
                placeholder={t('vendor_report_issue.modal_search_placeholder', 'Search customers...')}
                placeholderTextColor={vendorColors.isDark ? '#8A7263' : '#A89282'}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={vendorColors.isDark ? '#C8B6A6' : '#7C6758'} />
                </TouchableOpacity>
              )}
            </View>

            {/* Content List */}
            {loadingCustomers ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={vendorColors.primary} />
                <Text style={[styles.modalLoadingText, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                  {t('vendor_report_issue.modal_loading', 'Loading customers...')}
                </Text>
              </View>
            ) : customers.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="people-outline" size={48} color={vendorColors.isDark ? '#8A7263' : '#C8B6A6'} />
                <Text style={[styles.modalEmptyTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                  {t('vendor_report_issue.modal_empty_title', 'No customers found')}
                </Text>
                <Text style={[styles.modalEmptyText, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                  {t('vendor_report_issue.modal_empty_message', 'Customers who have ordered from you will appear here')}
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
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (vendorColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: vendorColors.background,
    },
    scrollContent: {
      paddingBottom: vendorSpacing.xxl,
    },
    section: {
      backgroundColor: vendorColors.surface,
      marginHorizontal: vendorSpacing.lg,
      marginTop: vendorSpacing.md,
      padding: vendorSpacing.lg,
      borderRadius: vendorBorderRadius.xl,
      borderWidth: 1,
      borderColor: vendorColors.border,
      ...vendorShadows.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: vendorSpacing.md,
    },
    sectionIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      flex: 1,
    },
    requiredAsterisk: {
      color: vendorColors.danger || '#EF4444',
      fontWeight: '700',
    },
    // Customer Selection
    selectCustomerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: vendorColors.surfaceAlt,
      padding: vendorSpacing.md,
      borderRadius: vendorBorderRadius.lg,
      borderWidth: 1,
      borderColor: vendorColors.border,
    },
    selectCustomerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    customerPlaceholderIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    selectCustomerText: {
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    selectedCustomerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: vendorColors.surfaceAlt,
      padding: vendorSpacing.md,
      borderRadius: vendorBorderRadius.lg,
      borderWidth: 1,
      borderColor: vendorColors.border,
    },
    selectedCustomerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    customerAvatarSmall: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
    },
    customerAvatarSmallText: {
      fontSize: 18,
      fontWeight: '700',
    },
    selectedCustomerDetails: {
      flex: 1,
    },
    selectedCustomerName: {
      fontSize: 15,
      fontWeight: '700',
    },
    selectedCustomerEmail: {
      fontSize: 12,
      marginTop: 2,
    },
    changeCustomerButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: vendorColors.primary,
      borderRadius: vendorBorderRadius.md,
    },
    changeCustomerText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    // Order ID Input
    orderIdContainer: {
      marginTop: vendorSpacing.md,
      paddingTop: vendorSpacing.md,
      borderTopWidth: 1,
      borderTopColor: vendorColors.border,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 6,
    },
    input: {
      borderRadius: vendorBorderRadius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      borderWidth: 1,
    },
    orderNumberBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    orderNumberText: {
      fontSize: 12,
      fontWeight: '600',
    },
    // Report Types Grid
    typesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    typeCard: {
      width: '48%',
      padding: 12,
      borderRadius: vendorBorderRadius.lg,
      alignItems: 'center',
      position: 'relative',
    },
    typeCardFull: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    typeIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    typeLabel: {
      fontSize: 12,
      textAlign: 'center',
    },
    selectedCheckCircle: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: vendorColors.isDark ? '#382214' : '#FFF5EB',
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Description
    textArea: {
      borderRadius: vendorBorderRadius.md,
      padding: 14,
      fontSize: 14,
      minHeight: 120,
      borderWidth: 1,
    },
    helperText: {
      fontSize: 12,
      marginTop: 8,
      lineHeight: 16,
    },
    // Submit Button
    submitContainer: {
      marginHorizontal: vendorSpacing.lg,
      marginTop: vendorSpacing.lg,
    },
    submitButton: {
      borderRadius: vendorBorderRadius.full,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      ...vendorShadows.md,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    submitText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    // Info Note
    infoNote: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: vendorSpacing.lg,
      marginTop: vendorSpacing.md,
      marginBottom: vendorSpacing.lg,
      padding: vendorSpacing.md,
      borderRadius: vendorBorderRadius.lg,
      borderWidth: 1,
      gap: 12,
    },
    infoIcon: {
      fontSize: 20,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: vendorColors.surface,
      borderTopLeftRadius: vendorBorderRadius.xl,
      borderTopRightRadius: vendorBorderRadius.xl,
      maxHeight: '85%',
      minHeight: '60%',
      paddingBottom: vendorSpacing.xxl,
      borderWidth: 1,
      borderColor: vendorColors.border,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: vendorSpacing.lg,
      paddingVertical: vendorSpacing.md,
      borderBottomWidth: 1,
      borderBottomColor: vendorColors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    modalCloseButton: {
      padding: 4,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: vendorColors.surfaceAlt,
      marginHorizontal: vendorSpacing.lg,
      marginVertical: vendorSpacing.md,
      paddingHorizontal: 12,
      borderRadius: vendorBorderRadius.md,
      borderWidth: 1,
      borderColor: vendorColors.border,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      paddingLeft: 8,
      fontSize: 14,
    },
    customersList: {
      paddingHorizontal: vendorSpacing.lg,
    },
    customerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: vendorColors.surfaceAlt,
      padding: vendorSpacing.md,
      borderRadius: vendorBorderRadius.md,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: vendorColors.border,
    },
    customerItemSelected: {
      borderColor: vendorColors.primary,
      backgroundColor: vendorColors.isDark ? '#3A2415' : '#FFF3E8',
      borderWidth: 2,
    },
    customerAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    customerAvatarText: {
      fontSize: 18,
      fontWeight: '700',
    },
    customerInfo: {
      flex: 1,
    },
    customerName: {
      fontSize: 15,
      fontWeight: '700',
    },
    customerEmail: {
      fontSize: 12,
      marginTop: 2,
    },
    modalLoading: {
      padding: vendorSpacing.xxl,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalLoadingText: {
      marginTop: 12,
      fontSize: 14,
    },
    modalEmpty: {
      padding: vendorSpacing.xxl,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalEmptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 6,
    },
    modalEmptyText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
