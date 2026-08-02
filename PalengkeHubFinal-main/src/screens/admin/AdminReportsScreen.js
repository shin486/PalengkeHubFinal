import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';

export default function AdminReportsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('customer'); // 'customer' or 'vendor'
  const [customerReports, setCustomerReports] = useState([]);
  const [vendorReports, setVendorReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    fetchAllReports();
  }, []);

  const fetchAllReports = async () => {
    try {
      setLoading(true);
      
      // Fetch customer reports with user info
      const { data: customerData, error: customerError } = await supabase
        .from('customer_reports')
        .select(`
          *,
          profile:user_id (
            id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (customerError) throw customerError;

      // Fetch vendor reports with vendor info
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendor_reports')
        .select(`
          *,
          vendor:vendor_id (
            id,
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (vendorError) throw vendorError;

      setCustomerReports(customerData || []);
      setVendorReports(vendorData || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllReports();
  };

  const handleUpdateReport = async () => {
    if (!selectedReport) return;

    try {
      const table = activeTab === 'customer' ? 'customer_reports' : 'vendor_reports';
      
      const updates = {
        status: newStatus,
        admin_notes: adminNotes,
        updated_at: new Date(),
      };

      const { error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', selectedReport.id);

      if (error) throw error;

      Alert.alert('Success', 'Report updated successfully');
      setModalVisible(false);
      setSelectedReport(null);
      setAdminNotes('');
      setNewStatus('');
      fetchAllReports();
    } catch (error) {
      console.error('Error updating report:', error);
      Alert.alert('Error', 'Failed to update report');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'reviewing': return '#3B82F6';
      case 'resolved': return '#10B981';
      case 'dismissed': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '⏳ Pending';
      case 'reviewing': return '🔍 Reviewing';
      case 'resolved': return '✅ Resolved';
      case 'dismissed': return '❌ Dismissed';
      default: return status;
    }
  };

  const getReportTypeIcon = (type) => {
    const icons = {
      product: '🚫',
      vendor: '🏪',
      order: '📋',
      payment: '💰',
      customer_behavior: '👤',
      order_issue: '📋',
      payment_issue: '💰',
      fraud: '⚠️',
      other: '📝',
    };
    return icons[type] || '📝';
  };

  const renderCustomerReportCard = (report) => (
    <TouchableOpacity
      key={report.id}
      style={styles.reportCard}
      onPress={() => {
        setSelectedReport(report);
        setAdminNotes(report.admin_notes || '');
        setNewStatus(report.status);
        setModalVisible(true);
      }}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportTypeContainer}>
          <Text style={styles.reportIcon}>{getReportTypeIcon(report.report_type)}</Text>
          <Text style={styles.reportType}>
            {report.report_type?.toUpperCase()} Report
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
            {getStatusText(report.status)}
          </Text>
        </View>
      </View>

      <View style={styles.reporterInfo}>
        <Text style={styles.reporterLabel}>Reported by:</Text>
        <Text style={styles.reporterName}>
          {report.profile?.full_name || 'User'} ({report.profile?.email || report.user_id})
        </Text>
      </View>

      {report.target_name && (
        <View style={styles.targetInfo}>
          <Text style={styles.targetLabel}>Target:</Text>
          <Text style={styles.targetName}>{report.target_name}</Text>
        </View>
      )}

      <Text style={styles.reportReason}>Reason: {report.reason || 'N/A'}</Text>
      
      <Text style={styles.reportDescription} numberOfLines={3}>
        {report.description}
      </Text>

      <Text style={styles.reportDate}>
        {new Date(report.created_at).toLocaleDateString()} at{' '}
        {new Date(report.created_at).toLocaleTimeString()}
      </Text>

      {report.admin_notes && (
        <View style={styles.adminNotePreview}>
          <Text style={styles.adminNotePreviewLabel}>📝 Admin:</Text>
          <Text style={styles.adminNotePreviewText} numberOfLines={1}>
            {report.admin_notes}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderVendorReportCard = (report) => (
    <TouchableOpacity
      key={report.id}
      style={styles.reportCard}
      onPress={() => {
        setSelectedReport(report);
        setAdminNotes(report.admin_notes || '');
        setNewStatus(report.status);
        setModalVisible(true);
      }}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportTypeContainer}>
          <Text style={styles.reportIcon}>{getReportTypeIcon(report.report_type)}</Text>
          <Text style={styles.reportType}>
            VENDOR REPORT - {report.report_type?.toUpperCase()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
            {getStatusText(report.status)}
          </Text>
        </View>
      </View>

      <View style={styles.reporterInfo}>
        <Text style={styles.reporterLabel}>Reported by Vendor:</Text>
        <Text style={styles.reporterName}>
          {report.vendor?.full_name || 'Vendor'} ({report.vendor?.email || report.vendor_id})
        </Text>
      </View>

      {report.customer_name && (
        <View style={styles.targetInfo}>
          <Text style={styles.targetLabel}>Reported Customer:</Text>
          <Text style={styles.targetName}>{report.customer_name}</Text>
        </View>
      )}

      {report.order_id && (
        <View style={styles.targetInfo}>
          <Text style={styles.targetLabel}>Order ID:</Text>
          <Text style={styles.targetName}>{report.order_id}</Text>
        </View>
      )}

      <Text style={styles.reportDescription} numberOfLines={3}>
        {report.description}
      </Text>

      <Text style={styles.reportDate}>
        {new Date(report.created_at).toLocaleDateString()} at{' '}
        {new Date(report.created_at).toLocaleTimeString()}
      </Text>

      {report.admin_notes && (
        <View style={styles.adminNotePreview}>
          <Text style={styles.adminNotePreviewLabel}>📝 Admin:</Text>
          <Text style={styles.adminNotePreviewText} numberOfLines={1}>
            {report.admin_notes}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </SafeAreaView>
    );
  }

  const pendingCount = activeTab === 'customer' 
    ? customerReports.filter(r => r.status === 'pending').length
    : vendorReports.filter(r => r.status === 'pending').length;

  const currentReports = activeTab === 'customer' ? customerReports : vendorReports;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <Header 
        title="📋 Reports Management"
        subtitle={`${activeTab === 'customer' ? 'Customer' : 'Vendor'} Reports - ${pendingCount} pending`}
      />

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'customer' && styles.tabActive]}
          onPress={() => setActiveTab('customer')}
        >
          <Text style={[styles.tabText, activeTab === 'customer' && styles.tabTextActive]}>
            👥 Customer Reports
          </Text>
          {customerReports.filter(r => r.status === 'pending').length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {customerReports.filter(r => r.status === 'pending').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'vendor' && styles.tabActive]}
          onPress={() => setActiveTab('vendor')}
        >
          <Text style={[styles.tabText, activeTab === 'vendor' && styles.tabTextActive]}>
            🏪 Vendor Reports
          </Text>
          {vendorReports.filter(r => r.status === 'pending').length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {vendorReports.filter(r => r.status === 'pending').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />
        }
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{currentReports.length}</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]}>
              {currentReports.filter(r => r.status === 'pending').length}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
            <Text style={[styles.statNumber, { color: '#3B82F6' }]}>
              {currentReports.filter(r => r.status === 'reviewing').length}
            </Text>
            <Text style={styles.statLabel}>Reviewing</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>
              {currentReports.filter(r => r.status === 'resolved').length}
            </Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {currentReports.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No Reports</Text>
            <Text style={styles.emptyText}>
              No {activeTab} reports found
            </Text>
          </View>
        ) : (
          <View style={styles.reportsList}>
            {activeTab === 'customer'
              ? customerReports.map(renderCustomerReportCard)
              : vendorReports.map(renderVendorReportCard)
            }
          </View>
        )}
      </ScrollView>

      {/* Update Report Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Update Report</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Report ID</Text>
              <Text style={styles.modalValue}>{selectedReport?.id}</Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Description</Text>
              <Text style={styles.modalValue}>{selectedReport?.description}</Text>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Status</Text>
              <View style={styles.statusButtons}>
                {['pending', 'reviewing', 'resolved', 'dismissed'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusButton,
                      newStatus === status && styles.statusButtonActive,
                      { backgroundColor: getStatusColor(status) + (newStatus === status ? '30' : '10') }
                    ]}
                    onPress={() => setNewStatus(status)}
                  >
                    <Text style={[
                      styles.statusButtonText,
                      { color: getStatusColor(status) }
                    ]}>
                      {getStatusText(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Admin Notes / Response</Text>
              <TextInput
                style={styles.modalTextArea}
                placeholder="Add your response or notes here..."
                value={adminNotes}
                onChangeText={setAdminNotes}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity style={styles.updateButton} onPress={handleUpdateReport}>
              <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.updateGradient}>
                <Text style={styles.updateButtonText}>Update Report</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    position: 'relative',
  },
  tabActive: {
    backgroundColor: '#FEF2F2',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#DC2626',
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  reportsList: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  reportIcon: {
    fontSize: 14,
  },
  reportType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reporterInfo: {
    marginBottom: 8,
  },
  reporterLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  reporterName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  targetInfo: {
    marginBottom: 8,
  },
  targetLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  targetName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  reportReason: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  reportDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  reportDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  adminNotePreview: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminNotePreviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  adminNotePreviewText: {
    fontSize: 11,
    color: '#6B7280',
    flex: 1,
  },
  emptyState: {
    backgroundColor: 'white',
    margin: 16,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
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
  modalCloseText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  modalContent: {
    padding: 16,
  },
  modalSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 14,
    color: '#111827',
  },
  modalTextArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusButtonActive: {
    borderColor: 'transparent',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  updateButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 32,
  },
  updateGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});