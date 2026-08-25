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
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

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
  const [exporting, setExporting] = useState(false);

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

  const generateCSV = (reports, type) => {
    const headers = ['ID', 'Type', 'Status', 'Description', 'Date', 'Reporter', 'Admin Notes'];
    const rows = reports.map(report => [
      report.id,
      report.report_type || type,
      report.status,
      `"${(report.description || '').replace(/"/g, '""')}"`,
      new Date(report.created_at).toLocaleString(),
      type === 'customer' 
        ? (report.profile?.full_name || report.user_id)
        : (report.vendor?.full_name || report.vendor_id),
      `"${(report.admin_notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return csvContent;
  };

  const exportToCSV = async () => {
    try {
      setExporting(true);
      const reports = activeTab === 'customer' ? customerReports : vendorReports;
      
      if (reports.length === 0) {
        Alert.alert('No Data', 'There are no reports to export');
        return;
      }

      const csvContent = generateCSV(reports, activeTab);
      const fileName = `${activeTab}_reports_${new Date().toISOString().split('T')[0]}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const shareOptions = {
        mimeType: 'text/csv',
        dialogTitle: `Export ${activeTab} reports as CSV`,
        UTI: 'public.comma-separated-values-text',
      };

      await Sharing.shareAsync(fileUri, shareOptions);
      Alert.alert('Success', 'CSV file exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export CSV file');
    } finally {
      setExporting(false);
    }
  };

  const generatePrintableHTML = (reports, type) => {
    const statusColors = {
      pending: '#F59E0B',
      reviewing: '#3B82F6',
      resolved: '#10B981',
      dismissed: '#6B7280'
    };

    const rows = reports.map(report => `
      <tr>
        <td>${report.id.slice(0, 8)}</td>
        <td>${(report.report_type || 'N/A').toUpperCase()}</td>
        <td><span style="background-color: ${statusColors[report.status] || '#6B7280'}20; color: ${statusColors[report.status] || '#6B7280'}; padding: 4px 8px; border-radius: 4px; font-weight: 600;">${report.status.toUpperCase()}</span></td>
        <td>${report.description || 'N/A'}</td>
        <td>${new Date(report.created_at).toLocaleString()}</td>
        <td>${type === 'customer' ? (report.profile?.full_name || 'N/A') : (report.vendor?.full_name || 'N/A')}</td>
        <td>${report.admin_notes || 'N/A'}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${type === 'customer' ? 'Customer' : 'Vendor'} Reports</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          h1 { color: #DC2626; border-bottom: 3px solid #DC2626; padding-bottom: 10px; }
          .info { margin-bottom: 20px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #DC2626; color: white; padding: 12px; text-align: left; font-weight: 600; }
          td { padding: 10px; border-bottom: 1px solid #E5E7EB; }
          tr:hover { background-color: #F9FAFB; }
          .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #E5E7EB; color: #666; font-size: 12px; }
          @media print {
            body { margin: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>${type === 'customer' ? 'Customer' : 'Vendor'} Reports</h1>
        <div class="info">
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Reports:</strong> ${reports.length}</p>
          <p><strong>Pending:</strong> ${reports.filter(r => r.status === 'pending').length}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Description</th>
              <th>Date</th>
              <th>Reporter</th>
              <th>Admin Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="footer">
          <p>PalengkeHub Admin Panel - Lipa City Public Market</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background-color: #DC2626; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
          Print / Save as PDF
        </button>
      </body>
      </html>
    `;
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);
      const reports = activeTab === 'customer' ? customerReports : vendorReports;
      
      if (reports.length === 0) {
        Alert.alert('No Data', 'There are no reports to export');
        return;
      }

      // Generate professional HTML for PDF
      const htmlContent = generatePrintableHTML(reports, activeTab);
      
      // Use expo-print to generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Share the PDF file
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Export ${activeTab} reports as PDF`,
        UTI: 'com.adobe.pdf',
      });

      Alert.alert('Success', 'PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Error', 'Failed to export PDF: ' + error.message);
    } finally {
      setExporting(false);
    }
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
      case 'pending': return 'Pending';
      case 'reviewing': return 'Reviewing';
      case 'resolved': return 'Resolved';
      case 'dismissed': return 'Dismissed';
      default: return status;
    }
  };

  const getReportTypeIcon = (type) => {
    const icons = {
      product: 'inventory',
      vendor: 'store',
      order: 'receipt',
      payment: 'payment',
      customer_behavior: 'person',
      order_issue: 'receipt',
      payment_issue: 'payment',
      fraud: 'warning',
      other: 'description',
    };
    return icons[type] || 'description';
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
          <Text style={styles.adminNotePreviewLabel}> Admin:</Text>
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
          <Text style={styles.adminNotePreviewLabel}> Admin:</Text>
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
      
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#C62828" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Reports Management</Text>
          <Text style={styles.headerSubtitle}>
            {activeTab === 'customer' ? 'Customer' : 'Vendor'} Reports - {pendingCount} pending
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <MaterialIcons name="refresh" size={22} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'customer' && styles.tabActive]}
          onPress={() => setActiveTab('customer')}
        >
          <MaterialIcons name="people" size={18} color={activeTab === 'customer' ? '#DC2626' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'customer' && styles.tabTextActive]}>
            Customer Reports
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
          <MaterialIcons name="store" size={18} color={activeTab === 'vendor' ? '#DC2626' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'vendor' && styles.tabTextActive]}>
            Vendor Reports
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

      {/* Export Buttons */}
      <View style={styles.exportContainer}>
        <TouchableOpacity 
          style={[styles.exportButton, styles.exportCSVButton]}
          onPress={exportToCSV}
          disabled={exporting}
        >
          <MaterialIcons name="download" size={18} color="white" />
          <Text style={styles.exportButtonText}>Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.exportButton, styles.exportPDFButton]}
          onPress={exportToPDF}
          disabled={exporting}
        >
          <MaterialIcons name="picture-as-pdf" size={18} color="white" />
          <Text style={styles.exportButtonText}>Export PDF</Text>
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
            <MaterialIcons name="inbox" size={48} color="#D1D5DB" />
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
              <Text style={styles.modalCloseText}> Close</Text>
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
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
  exportContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportCSVButton: {
    backgroundColor: '#10B981',
  },
  exportPDFButton: {
    backgroundColor: '#DC2626',
  },
  exportButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
