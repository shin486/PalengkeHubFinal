// src/screens/admin/AdminDashboardScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';


const isWeb = Platform.OS === 'web';

// ✅ REPORTS SECTION COMPONENT - Moved outside to fix hooks error
const ReportsSection = () => {
  const [customerReports, setCustomerReports] = useState([]);
  const [vendorReports, setVendorReports] = useState([]);
  const [activeReportTab, setActiveReportTab] = useState('customer');
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

 const fetchReports = async () => {
  setLoadingReports(true);
  try {
    // Fetch vendor reports
    const { data: vendorData, error: vendorError } = await supabase
      .from('vendor_reports')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (vendorError) {
      Alert.alert('Error Fetching Reports', 
        `Code: ${vendorError.code}\nMessage: ${vendorError.message}\nDetails: ${vendorError.details || 'No details'}`
      );
      console.error('Vendor reports error:', vendorError);
    } else {
      console.log('Vendor reports found:', vendorData?.length);
      setVendorReports(vendorData || []);
    }
    
  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoadingReports(false);
  }
};

  useEffect(() => {
    fetchReports();
  }, []);

  const updateReport = async () => {
    if (!selectedReport) return;

    try {
      const table = activeReportTab === 'customer' ? 'customer_reports' : 'vendor_reports';
      
      const { error } = await supabase
        .from(table)
        .update({
          status: newStatus,
          admin_notes: adminNotes,
          updated_at: new Date(),
        })
        .eq('id', selectedReport.id);

      if (error) throw error;

      Alert.alert('Success', 'Report updated successfully');
      setReportModalVisible(false);
      setSelectedReport(null);
      setAdminNotes('');
      setNewStatus('');
      fetchReports();
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


  const currentReports = activeReportTab === 'customer' ? customerReports : vendorReports;
  const pendingCount = currentReports.filter(r => r.status === 'pending').length;

  const ReportCard = ({ report, type }) => (
    <TouchableOpacity
      style={styles.reportCardItem}
      onPress={() => {
        setSelectedReport(report);
        setAdminNotes(report.admin_notes || '');
        setNewStatus(report.status);
        setReportModalVisible(true);
      }}
    >
      <View style={styles.reportCardHeader}>
        <View style={styles.reportTypeTag}>
          <Text style={styles.reportTypeIcon}>{getReportTypeIcon(report.report_type)}</Text>
          <Text style={styles.reportTypeText}>
            {report.report_type?.toUpperCase().replace('_', ' ')}
          </Text>
        </View>
        <View style={[styles.reportStatusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
          <Text style={[styles.reportStatusText, { color: getStatusColor(report.status) }]}>
            {getStatusText(report.status)}
          </Text>
        </View>
      </View>

      <View style={styles.reportReporterInfo}>
        <Text style={styles.reportReporterLabel}>Reported by:</Text>
        <Text style={styles.reportReporterName}>
          {type === 'customer' 
            ? (report.profile?.full_name || 'Customer') 
            : (report.vendor?.full_name || 'Vendor')}
        </Text>
      </View>

      {report.target_name && (
        <View style={styles.reportTargetInfo}>
          <Text style={styles.reportTargetLabel}>Target:</Text>
          <Text style={styles.reportTargetName}>{report.target_name}</Text>
        </View>
      )}

      {report.customer_name && (
        <View style={styles.reportTargetInfo}>
          <Text style={styles.reportTargetLabel}>Reported Customer:</Text>
          <Text style={styles.reportTargetName}>{report.customer_name}</Text>
        </View>
      )}

      <Text style={styles.reportDescription} numberOfLines={2}>
        {report.description}
      </Text>

      <Text style={styles.reportDate}>
        {new Date(report.created_at).toLocaleDateString()} at{' '}
        {new Date(report.created_at).toLocaleTimeString()}
      </Text>

      {report.admin_notes && (
        <View style={styles.reportAdminNote}>
          <Text style={styles.reportAdminNoteLabel}>📝 Admin:</Text>
          <Text style={styles.reportAdminNoteText} numberOfLines={1}>
            {report.admin_notes}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>📋 Reports Management</Text>
        <Text style={styles.cardSubtitle}>View and manage customer & vendor reports</Text>
      </View>

      <View style={styles.reportTabs}>
        <TouchableOpacity
          style={[styles.reportTab, activeReportTab === 'customer' && styles.reportTabActive]}
          onPress={() => setActiveReportTab('customer')}
        >
          <Text style={[styles.reportTabText, activeReportTab === 'customer' && styles.reportTabTextActive]}>
            👥 Customer Reports
          </Text>
          {customerReports.filter(r => r.status === 'pending').length > 0 && (
            <View style={styles.reportTabBadge}>
              <Text style={styles.reportTabBadgeText}>
                {customerReports.filter(r => r.status === 'pending').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reportTab, activeReportTab === 'vendor' && styles.reportTabActive]}
          onPress={() => setActiveReportTab('vendor')}
        >
          <Text style={[styles.reportTabText, activeReportTab === 'vendor' && styles.reportTabTextActive]}>
            🏪 Vendor Reports
          </Text>
          {vendorReports.filter(r => r.status === 'pending').length > 0 && (
            <View style={styles.reportTabBadge}>
              <Text style={styles.reportTabBadgeText}>
                {vendorReports.filter(r => r.status === 'pending').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.reportStatsRow}>
        <View style={styles.reportStatBox}>
          <Text style={styles.reportStatNumber}>{currentReports.length}</Text>
          <Text style={styles.reportStatLabel}>Total</Text>
        </View>
        <View style={[styles.reportStatBox, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.reportStatNumber, { color: '#F59E0B' }]}>{pendingCount}</Text>
          <Text style={styles.reportStatLabel}>Pending</Text>
        </View>
        <View style={[styles.reportStatBox, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.reportStatNumber, { color: '#3B82F6' }]}>
            {currentReports.filter(r => r.status === 'reviewing').length}
          </Text>
          <Text style={styles.reportStatLabel}>Reviewing</Text>
        </View>
        <View style={[styles.reportStatBox, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.reportStatNumber, { color: '#10B981' }]}>
            {currentReports.filter(r => r.status === 'resolved').length}
          </Text>
          <Text style={styles.reportStatLabel}>Resolved</Text>
        </View>
      </View>

      {loadingReports ? (
        <View style={styles.reportLoadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.reportLoadingText}>Loading reports...</Text>
        </View>
      ) : currentReports.length === 0 ? (
        <View style={styles.reportEmptyContainer}>
          <Text style={styles.reportEmptyIcon}>📭</Text>
          <Text style={styles.reportEmptyTitle}>No Reports</Text>
          <Text style={styles.reportEmptyText}>
            No {activeReportTab} reports found
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.reportListContainer}>
          {currentReports.map(report => (
            <ReportCard 
              key={report.id} 
              report={report} 
              type={activeReportTab} 
            />
          ))}
        </ScrollView>
      )}

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reportModalContainer}>
            <Text style={styles.modalTitle}>📋 Update Report</Text>
            
            <View style={styles.reportModalSection}>
              <Text style={styles.reportModalLabel}>Description</Text>
              <Text style={styles.reportModalValue}>{selectedReport?.description}</Text>
            </View>

            <View style={styles.reportModalSection}>
              <Text style={styles.reportModalLabel}>Status</Text>
              <View style={styles.reportStatusButtons}>
                {['pending', 'reviewing', 'resolved', 'dismissed'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.reportStatusButton,
                      newStatus === status && styles.reportStatusButtonActive,
                      { backgroundColor: getStatusColor(status) + (newStatus === status ? '30' : '10') }
                    ]}
                    onPress={() => setNewStatus(status)}
                  >
                    <Text style={[
                      styles.reportStatusButtonText,
                      { color: getStatusColor(status) }
                    ]}>
                      {getStatusText(status)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.reportModalSection}>
              <Text style={styles.reportModalLabel}>Admin Notes / Response</Text>
              <TextInput
                style={styles.reportModalTextArea}
                placeholder="Add your response or notes here..."
                value={adminNotes}
                onChangeText={setAdminNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalCancel, { backgroundColor: '#F1F5F9' }]} 
                onPress={() => setReportModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: '#64748B' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSubmit, { backgroundColor: '#DC2626' }]} 
                onPress={updateReport}
              >
                <Text style={styles.modalSubmitText}>Update Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function AdminDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
// Add these with your other state declarations
const [allProducts, setAllProducts] = useState([]);
const [selectedVendorFilter, setSelectedVendorFilter] = useState('all');
const [priceWarnings, setPriceWarnings] = useState({});
// DELETE these from inside renderProducts
const [searchVendorText, setSearchVendorText] = useState('');
const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  
  // Data states
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [applications, setApplications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [violations, setViolations] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [orders, setOrders] = useState([]);
  
  // Compliance states
  const [vendors, setVendors] = useState([]);
  const [complianceLogs, setComplianceLogs] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [complianceModalVisible, setComplianceModalVisible] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  
  // Modal states
  const [announcementModal, setAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [violationModal, setViolationModal] = useState(false);
  const [violationReason, setViolationReason] = useState('');
  const [complaintModal, setComplaintModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [stallModalVisible, setStallModalVisible] = useState(false);
  const [selectedStall, setSelectedStall] = useState(null);
  const [stallAction, setStallAction] = useState(''); // 'activate' or 'deactivate'
  
  // Reminder modal states - ADD THESE
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [reminderReason, setReminderReason] = useState('');
  const [selectedReminderVendor, setSelectedReminderVendor] = useState(null);
const fetchAllProducts = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        stalls (
          id,
          stall_number,
          stall_name,
          section,
          vendor_id,
          profiles:vendor_id (full_name, email)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    setAllProducts(data || []);
  } catch (error) {
    console.error('Error fetching products:', error);
  }
};
  // Fetch all data
  const fetchAllData = async () => {
    try {
      setLoading(true);
      // Add this in fetchAllData function
await fetchAllProducts();
      const [usersCount, vendorsCount, consumersCount, pendingApps, stallsCount, ordersCount, salesData] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'consumer'),
        supabase.from('vendor_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('stalls').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total_amount').eq('status', 'completed'),
      ]);

      const totalSales = salesData.data?.reduce((sum, o) => sum + o.total_amount, 0) || 0;

      setStats({
        totalUsers: usersCount.count || 0,
        totalVendors: vendorsCount.count || 0,
        totalConsumers: consumersCount.count || 0,
        pendingApplications: pendingApps.count || 0,
        totalStalls: stallsCount.count || 0,
        totalOrders: ordersCount.count || 0,
        totalSales,
      });

      const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      setUsers(usersData || []);

      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, profiles:consumer_id (full_name)')
        .order('created_at', { ascending: false });
      setOrders(ordersData || []);

      const vendorsData = (usersData || []).filter(u => u.role === 'vendor');
      const vendorsWithStalls = await Promise.all(vendorsData.map(async (vendor) => {
        const { data: stall } = await supabase
          .from('stalls')
          .select('*')
          .eq('vendor_id', vendor.id)
          .maybeSingle();
        
        const { data: lastProductUpdate } = await supabase
          .from('products')
          .select('updated_at')
          .eq('stall_id', stall?.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const { data: lastChat } = await supabase
          .from('messages')
          .select('created_at')
          .eq('sender_id', vendor.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        return {
          ...vendor,
          stall: stall || null,
          last_price_update: lastProductUpdate?.updated_at || null,
          last_chat_response: lastChat?.created_at || null,
          compliance_score: vendor.compliance_score || 100,
        };
      }));
      setVendors(vendorsWithStalls);

      const { data: stallsData } = await supabase
        .from('stalls')
        .select('*, profiles:vendor_id (id, email, full_name)')
        .order('stall_number');
      setStalls(stallsData || []);

      const { data: appsData } = await supabase
        .from('vendor_applications')
        .select('*, profiles:applicant_id (email, full_name, phone)')
        .eq('status', 'pending')
        .order('application_date', { ascending: false });
      setApplications(appsData || []);

      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      setAnnouncements(announcementsData || []);

      const { data: violationsData } = await supabase
        .from('violations')
        .select('*, profiles:vendor_id (email, full_name)')
        .order('created_at', { ascending: false });
      setViolations(violationsData || []);

      const { data: complaintsData } = await supabase
        .from('complaints')
        .select('*, profiles:user_id (email, full_name), stalls:stall_id (stall_name, stall_number)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setComplaints(complaintsData || []);

      const { data: logsData } = await supabase
        .from('compliance_logs')
        .select('*, profiles:vendor_id (email, full_name)')
        .order('created_at', { ascending: false });
      setComplianceLogs(logsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

// ========== PDF REPORT GENERATION ==========
// ========== PDF REPORT GENERATION ==========
// ========== PDF REPORT GENERATION - TABLES ONLY ==========
// ========== PDF REPORT GENERATION - TABLES ONLY ==========
// ========== PDF REPORT GENERATION - SEPARATE WINDOW ==========
const generatePDFReport = async () => {
  try {
    // Get current date
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Calculate statistics
    const totalProducts = allProducts.length;
    const activeProducts = allProducts.filter(p => p.is_available).length;
    const inactiveProducts = totalProducts - activeProducts;
    const productsOnSale = allProducts.filter(p => p.promotion?.is_active).length;
    
    const prices = allProducts.map(p => p.price);
    const overallAvgPrice = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    
    // Get unique vendors
    const vendorsSet = new Set();
    allProducts.forEach(p => {
      const vendorName = p.stalls?.profiles?.full_name || p.stalls?.stall_name || 'Unknown';
      vendorsSet.add(vendorName);
    });
    const vendorsCount = vendorsSet.size;
    
    // Price distribution
    const priceRanges = [
      { range: 'Under ₱50', count: allProducts.filter(p => p.price < 50).length },
      { range: '₱50 - ₱100', count: allProducts.filter(p => p.price >= 50 && p.price < 100).length },
      { range: '₱100 - ₱200', count: allProducts.filter(p => p.price >= 100 && p.price < 200).length },
      { range: '₱200 - ₱500', count: allProducts.filter(p => p.price >= 200 && p.price < 500).length },
      { range: '₱500+', count: allProducts.filter(p => p.price >= 500).length },
    ];
    
    // Average Price by Category
    const normalizeCategory = (category) => {
      if (!category) return 'Uncategorized';
      return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    };
    
    const categoryMap = new Map();
    allProducts.forEach(p => {
      const category = normalizeCategory(p.category || 'Uncategorized');
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { totalPrice: 0, count: 0, products: [] });
      }
      const entry = categoryMap.get(category);
      entry.totalPrice += p.price;
      entry.count++;
      entry.products.push(p.name);
    });
    
    const categoryAverages = Array.from(categoryMap.entries()).map(([cat, data]) => ({
      category: cat,
      avgPrice: (data.totalPrice / data.count).toFixed(2),
      count: data.count,
      uniqueProducts: new Set(data.products).size
    })).sort((a, b) => parseFloat(b.avgPrice) - parseFloat(a.avgPrice));
    
    // Average Price by Product
    const productMap = new Map();
    allProducts.forEach(p => {
      if (!productMap.has(p.name)) {
        productMap.set(p.name, { prices: [], vendors: new Set(), category: p.category, unit: p.unit });
      }
      const entry = productMap.get(p.name);
      entry.prices.push(p.price);
      entry.vendors.add(p.stalls?.profiles?.full_name || 'Unknown');
    });
    
    const productAverages = Array.from(productMap.entries()).map(([name, data]) => ({
      name: name,
      avgPrice: (data.prices.reduce((a, b) => a + b, 0) / data.prices.length).toFixed(2),
      minPrice: Math.min(...data.prices),
      maxPrice: Math.max(...data.prices),
      vendorCount: data.vendors.size,
      category: data.category,
      unit: data.unit
    })).sort((a, b) => parseFloat(b.avgPrice) - parseFloat(a.avgPrice)).slice(0, 50);
    
    // Products with warnings
    const priceWarnings = allProducts.filter(p => p.price > 1000 && p.category !== 'Meat').slice(0, 30);
    
    // Complete product list (first 100)
    const productList = allProducts.slice(0, 100);
    
    // HTML for the report
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>PalengkeHub Products Report</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            padding: 20px;
            color: #333;
            background: white;
            font-size: 12px;
          }
          .report-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #DC2626;
          }
          .logo {
            font-size: 40px;
            margin-bottom: 5px;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            color: #DC2626;
          }
          .subtitle {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
          }
          .date {
            font-size: 10px;
            color: #999;
            margin-top: 6px;
          }
          .stats-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 25px;
          }
          .stat-card {
            flex: 1;
            min-width: 100px;
            background: #f8f9fa;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
            border: 1px solid #e9ecef;
          }
          .stat-value {
            font-size: 22px;
            font-weight: bold;
            color: #DC2626;
          }
          .stat-label {
            font-size: 10px;
            color: #666;
            margin-top: 5px;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin: 25px 0 12px 0;
            padding-bottom: 6px;
            border-bottom: 2px solid #DC2626;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 11px;
          }
          th {
            background-color: #DC2626;
            color: white;
            padding: 8px 6px;
            text-align: left;
            font-weight: 600;
          }
          td {
            padding: 6px;
            border-bottom: 1px solid #e9ecef;
          }
          tr:hover {
            background-color: #fef2f2;
          }
          .price-warning {
            background-color: #fef3c7;
          }
          .badge-active {
            background-color: #d1fae5;
            color: #059669;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            display: inline-block;
          }
          .badge-inactive {
            background-color: #fee2e2;
            color: #dc2626;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 10px;
            display: inline-block;
          }
          .footer {
            margin-top: 25px;
            padding-top: 12px;
            text-align: center;
            font-size: 9px;
            color: #999;
            border-top: 1px solid #e9ecef;
          }
          .text-center {
            text-align: center;
          }
          .print-button {
            background-color: #DC2626;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            border-radius: 8px;
            cursor: pointer;
            margin-bottom: 20px;
            display: block;
            width: 200px;
            text-align: center;
          }
          .print-button:hover {
            background-color: #B91C1C;
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div style="text-align: right; margin-bottom: 15px;">
            <button class="print-button no-print" onclick="window.print();">🖨️ Print / Save as PDF</button>
          </div>
          
          <div class="header">
            <div class="logo">🛒</div>
            <div class="title">PalengkeHub Products Report</div>
            <div class="subtitle">Complete Product Monitoring & Analytics</div>
            <div class="date">Generated on: ${currentDate} at ${currentTime}</div>
          </div>
          
          <!-- Summary Statistics -->
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${totalProducts}</div><div class="stat-label">Total Products</div></div>
            <div class="stat-card"><div class="stat-value">${activeProducts}</div><div class="stat-label">Active Products</div></div>
            <div class="stat-card"><div class="stat-value">₱${overallAvgPrice}</div><div class="stat-label">Average Price</div></div>
            <div class="stat-card"><div class="stat-value">${productsOnSale}</div><div class="stat-label">On Sale</div></div>
            <div class="stat-card"><div class="stat-value">${vendorsCount}</div><div class="stat-label">Active Vendors</div></div>
            <div class="stat-card"><div class="stat-value">₱${minPrice} - ₱${maxPrice}</div><div class="stat-label">Price Range</div></div>
          </div>
          
          <!-- Table 1: Price Distribution -->
          <div class="section-title">📊 1. Price Distribution</div>
          <table>
            <thead><tr><th>Price Range</th><th>Number of Products</th><th>Percentage</th></tr></thead>
            <tbody>
              ${priceRanges.map(r => `<tr><td>${r.range}</td><td>${r.count}</td><td>${totalProducts > 0 ? ((r.count / totalProducts) * 100).toFixed(1) : 0}%</td></tr>`).join('')}
            </tbody>
          </table>
          
          <!-- Table 2: Average Price by Category -->
          <div class="section-title">📂 2. Average Price by Category</div>
          <table>
            <thead><tr><th>Category</th><th>Average Price</th><th>Products Count</th><th>Unique Items</th></tr></thead>
            <tbody>
              ${categoryAverages.map(c => `<tr><td>${c.category}</td><td>₱${c.avgPrice}</td><td>${c.count}</td><td>${c.uniqueProducts}</td></tr>`).join('')}
              ${categoryAverages.length === 0 ? '<tr><td colspan="4" class="text-center">No categories found</td></tr>' : ''}
            </tbody>
          </table>
          
          <!-- Table 3: Average Price by Product -->
          <div class="section-title">📊 3. Average Price by Product</div>
          <table>
            <thead><tr><th>Product Name</th><th>Avg Price</th><th>Min Price</th><th>Max Price</th><th>Vendors</th><th>Category</th><th>Unit</th></tr></thead>
            <tbody>
              ${productAverages.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>₱${p.avgPrice}</td>
                  <td>₱${p.minPrice}</td>
                  <td>₱${p.maxPrice}</td>
                  <td>${p.vendorCount}</td>
                  <td>${p.category || 'N/A'}</td>
                  <td>${p.unit || 'N/A'}</td>
                </tr>
              `).join('')}
              ${productAverages.length === 0 ? '<tr><td colspan="7" class="text-center">No products found</td></tr>' : ''}
            </tbody>
          </table>
          
          <!-- Table 4: Price Warnings -->
          <div class="section-title">⚠️ 4. Price Warning Alerts</div>
          ${priceWarnings.length === 0 ? 
            '<p style="padding:15px;text-align:center;background:#f0fdf4;color:#059669;border-radius:8px;">✅ No price warnings found. All products are within acceptable price ranges.</p>' :
            `<table>
              <thead><tr><th>Product</th><th>Price</th><th>Category</th><th>Vendor</th><th>Status</th></tr></thead>
              <tbody>
                ${priceWarnings.map(p => `
                  <tr class="price-warning">
                    <td>${p.name}</td>
                    <td>₱${p.price}</td>
                    <td>${p.category || 'N/A'}</td>
                    <td>${p.stalls?.profiles?.full_name || p.stalls?.stall_name || 'Unknown'}</td>
                    <td>${p.is_available ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
          }
          
          <!-- Table 5: Complete Product List -->
          <div class="section-title">📋 5. Complete Product List (First ${productList.length} of ${totalProducts})</div>
          <table>
            <thead><tr><th>Product Name</th><th>Price</th><th>Unit</th><th>Category</th><th>Vendor</th><th>Status</th></tr></thead>
            <tbody>
              ${productList.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>₱${p.price}</td>
                  <td>${p.unit || 'N/A'}</td>
                  <td>${p.category || 'N/A'}</td>
                  <td>${p.stalls?.profiles?.full_name || p.stalls?.stall_name || 'Unknown'}</td>
                  <td>${p.is_available ? '<span class="badge-active">Active</span>' : '<span class="badge-inactive">Inactive</span>'}</td>
                </tr>
              `).join('')}
              ${productList.length === 0 ? '<tr><td colspan="6" class="text-center">No products found</td></tr>' : ''}
            </tbody>
          </table>
          ${totalProducts > 100 ? `<p class="text-center" style="font-size:10px; color:#999; margin-top:-10px;">* Showing first 100 of ${totalProducts} products. Full list available in the app.</p>` : ''}
          
          <div class="footer">
            <p>PalengkeHub Admin Dashboard - Confidential Report</p>
            <p>Generated on ${currentDate} | For internal use only</p>
          </div>
        </div>
        
        <script>
          // Auto-open print dialog when page loads (optional)
          // window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;
    
    // For web: Open in new window and print
    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // Optional: Auto print
      // printWindow.print();
    } else {
      // For mobile: Use expo-print
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    }
    
    Alert.alert('Success', 'Report opened in new window. Use Ctrl+P to save as PDF.');
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    Alert.alert('Error', 'Failed to generate report: ' + error.message);
  }
};
  
  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          if (isWeb) window.location.href = '/';
          else navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    ]);
  };

  const sendComplianceReminder = async (vendor, reason) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: vendor.id,
          title: '📧 Compliance Reminder',
          message: `Reminder: ${reason}`,
          type: 'announcement',
          is_read: false,
        });

      if (error) {
        console.error('Error:', error);
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('✅ Success', `Reminder sent to ${vendor?.full_name || vendor?.email}`);
        fetchAllData();
      }
      
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to send reminder');
    }
  };

  const issueComplianceWarning = async (vendor, reason) => {
    if (!reason) {
      Alert.alert('Error', 'Please provide a reason for the warning');
      return;
    }

    try {
      const newScore = Math.max(0, (vendor.compliance_score || 100) - 10);
      await supabase
        .from('profiles')
        .update({ compliance_score: newScore, compliance_warnings: (vendor.compliance_warnings || 0) + 1 })
        .eq('id', vendor.id);
      
      await supabase.from('violations').insert({
        vendor_id: vendor.id,
        reason: reason,
        issued_by: user.id,
      });
      
      await supabase.from('notifications').insert({
        user_id: vendor.id,
        title: '⚠️ Compliance Warning',
        message: `You have received a warning: ${reason}. Please comply with market rules.`,
        type: 'announcement',
      });
      
      Alert.alert('Warning Issued', `A warning has been issued to ${vendor.full_name || vendor.email}`);
      setViolationModal(false);
      setViolationReason('');
      fetchAllData();
    } catch (error) {
      Alert.alert('Error', 'Failed to issue warning');
    }
  };

  const updateUserRole = async (userId, newRole) => {
    Alert.alert('Confirm', `Change user role to ${newRole}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
          Alert.alert('Success', 'User role updated');
          fetchAllData();
        }
      }
    ]);
  };

  const deleteUser = async (userId) => {
    Alert.alert('Delete User', 'Are you sure? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('profiles').delete().eq('id', userId);
          Alert.alert('Deleted', 'User has been deleted');
          fetchAllData();
        }
      }
    ]);
  };

const toggleStallStatus = async (stallId, currentStatus) => {
  try {
    console.log('Toggling stall:', stallId, 'Current status:', currentStatus);
    
    const { error } = await supabase
      .from('stalls')
      .update({ is_active: !currentStatus })
      .eq('id', stallId);
    
    if (error) {
      console.error('Error toggling stall:', error);
      Alert.alert('Error', error.message);
      return;
    }
    
    Alert.alert('Success', `Stall ${!currentStatus ? 'activated' : 'deactivated'}`);
    fetchAllData();
  } catch (error) {
    console.error('Error:', error);
    Alert.alert('Error', 'Failed to update stall status');
  }
};

  const approveApplication = async (application) => {
    await supabase.from('vendor_applications').update({ status: 'approved', reviewed_at: new Date() }).eq('id', application.id);
    await supabase.from('profiles').update({ role: 'vendor' }).eq('id', application.applicant_id);
    Alert.alert('Success', `${application.business_name} is now a vendor`);
    fetchAllData();
  };

  const rejectApplication = async (application) => {
    await supabase.from('vendor_applications').update({ status: 'rejected', reviewed_at: new Date() }).eq('id', application.id);
    Alert.alert('Rejected', 'Application has been rejected');
    fetchAllData();
  };

  const postAnnouncement = async () => {
    if (!announcementTitle || !announcementContent) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    await supabase.from('announcements').insert({
      title: announcementTitle,
      content: announcementContent,
      created_by: user.id,
    });
    setAnnouncementModal(false);
    setAnnouncementTitle('');
    setAnnouncementContent('');
    Alert.alert('Success', 'Announcement posted');
    fetchAllData();
  };

  const deleteAnnouncement = async (id) => {
    Alert.alert('Delete', 'Remove this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', onPress: async () => {
        await supabase.from('announcements').delete().eq('id', id);
        fetchAllData();
      }}
    ]);
  };

  const resolveComplaint = async () => {
    await supabase.from('complaints').update({
      status: 'resolved',
      resolution: resolutionMessage,
      resolved_at: new Date(),
      resolved_by: user.id,
    }).eq('id', selectedComplaint.id);
    setComplaintModal(false);
    setSelectedComplaint(null);
    setResolutionMessage('');
    Alert.alert('Resolved', 'Complaint has been marked as resolved');
    fetchAllData();
  };

const confirmStallAction = (stall, action) => {
  console.log('Confirming stall action:', { stall: stall.stall_number, action });
  setSelectedStall(stall);
  setStallAction(action);
  setStallModalVisible(true);
};

const exportProductsReport = async (products) => {
  try {
    const csvRows = [
      ['Product Name', 'Price', 'Unit', 'Category', 'Vendor', 'Status', 'Image URL']
    ];
    
    products.forEach(product => {
      csvRows.push([
        product.name,
        product.price,
        product.unit,
        product.category,
        product.stalls?.profiles?.full_name || 'Unknown',
        product.is_available ? 'Active' : 'Inactive',
        product.image_url || ''
      ]);
    });
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const fileUri = FileSystem.documentDirectory + `products_report_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent);
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      Alert.alert('Export Ready', 'File saved locally');
    }
  } catch (error) {
    console.error('Export error:', error);
    Alert.alert('Error', 'Failed to export report');
  }
};

const executeStallAction = async () => {
  if (!selectedStall) {
    console.log('No selected stall');
    return;
  }
  
  const newIsActive = stallAction === 'activate';
  
  console.log('=== EXECUTING STALL ACTION ===');
  console.log('Stall ID:', selectedStall.id);
  console.log('Stall Number:', selectedStall.stall_number);
  console.log('Current is_active:', selectedStall.is_active);
  console.log('Action:', stallAction);
  console.log('New is_active value:', newIsActive);
  
  try {
    const { data, error } = await supabase
      .from('stalls')
      .update({ is_active: newIsActive })
      .eq('id', selectedStall.id)
      .select();
    
    if (error) {
      console.error('Supabase error:', error);
      Alert.alert('Error', error.message);
    } else {
      console.log('Update successful! Response:', data);
      Alert.alert('Success', `Stall #${selectedStall.stall_number} has been ${stallAction}d`);
      setStallModalVisible(false);
      setSelectedStall(null);
      
      // Refresh data
      await fetchAllData();
      
      // Double check the stall status after refresh
      const { data: checkData } = await supabase
        .from('stalls')
        .select('is_active')
        .eq('id', selectedStall.id)
        .single();
      console.log('Verified new status:', checkData);
    }
  } catch (error) {
    console.error('Error:', error);
    Alert.alert('Error', 'Failed to update stall status');
  }
};


  const printReport = (type) => {
    Alert.alert('Coming Soon', `PDF export for ${type} will be available soon.`);
  };

  const getDaysSince = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getComplianceStatus = (vendor) => {
    const priceDays = getDaysSince(vendor.last_price_update);
    const chatDays = getDaysSince(vendor.last_chat_response);
    
    let issues = [];
    if (priceDays && priceDays > 7) issues.push('Price not updated in 7+ days');
    if (chatDays && chatDays > 3) issues.push('No chat response in 3+ days');
    
    if (issues.length === 0) return { status: 'Good', color: '#10B981', issues: [] };
    if (issues.length === 1) return { status: 'Warning', color: '#F59E0B', issues };
    return { status: 'Critical', color: '#EF4444', issues };
  };

const menuItems = [
  { id: 'overview', label: 'Overview', icon: '📊', color: '#DC2626' },
  { id: 'users', label: 'Users', icon: '👥', color: '#3B82F6' },
  { id: 'vendors', label: 'Vendors', icon: '🏪', color: '#10B981' },
  { id: 'compliance', label: 'Compliance', icon: '✅', color: '#8B5CF6' },
  { id: 'applications', label: 'Applications', icon: '📋', color: '#F59E0B' },
  { id: 'stalls', label: 'Stalls', icon: '📍', color: '#EC4899' },
  { id: 'products', label: 'Products', icon: '📦', color: '#8B5CF6' }, // ✅ ADD THIS
  { id: 'announcements', label: 'Announcements', icon: '📢', color: '#8B5CF6' },
  { id: 'violations', label: 'Violations', icon: '⚠️', color: '#EF4444' },
  { id: 'complaints', label: 'Complaints', icon: '💬', color: '#EC4899' },
  { id: 'reports', label: 'Reports', icon: '📄', color: '#6B7280' },
];

const renderProducts = () => {
  // ========== Basic Statistics ==========
  const totalProducts = allProducts.length;
  const activeProducts = allProducts.filter(p => p.is_available).length;
  const inactiveProducts = totalProducts - activeProducts;
  const productsOnSale = allProducts.filter(p => p.promotion?.is_active).length;
  
  const prices = allProducts.map(p => p.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const overallAvgPrice = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : 0;
  
  const highPriceCount = allProducts.filter(p => p.price > 1000 && p.category !== 'Meat').length;
  
  // ========== Product Averages (by name) ==========
  const productPriceMap = new Map();
  allProducts.forEach(p => {
    const productName = p.name;
    if (!productPriceMap.has(productName)) {
      productPriceMap.set(productName, {
        name: productName,
        totalPrice: 0,
        count: 0,
        prices: [],
        vendors: new Set(),
        category: p.category,
        unit: p.unit
      });
    }
    const entry = productPriceMap.get(productName);
    entry.totalPrice += p.price;
    entry.count++;
    entry.prices.push(p.price);
    entry.vendors.add(p.stalls?.profiles?.full_name || p.stalls?.stall_name || 'Unknown');
  });
  
  const productAverages = Array.from(productPriceMap.values()).map(product => ({
    ...product,
    avgPrice: (product.totalPrice / product.count).toFixed(2),
    minPrice: Math.min(...product.prices),
    maxPrice: Math.max(...product.prices),
    vendorCount: product.vendors.size,
    priceSpread: Math.max(...product.prices) - Math.min(...product.prices)
  })).sort((a, b) => parseFloat(b.avgPrice) - parseFloat(a.avgPrice));
  
  // ========== Category Normalization ==========
  const normalizeCategory = (category) => {
    if (!category) return 'Uncategorized';
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  };
  
  // Calculate average price per category (with normalization)
  const categoryPriceMap = new Map();
  allProducts.forEach(p => {
    const rawCategory = p.category || 'Uncategorized';
    const category = normalizeCategory(rawCategory);
    
    if (!categoryPriceMap.has(category)) {
      categoryPriceMap.set(category, {
        category: category,
        totalPrice: 0,
        count: 0,
        products: new Set(),
        originalCategories: new Set()
      });
    }
    const entry = categoryPriceMap.get(category);
    entry.totalPrice += p.price;
    entry.count++;
    entry.products.add(p.name);
    entry.originalCategories.add(rawCategory);
  });
  
  const categoryAverages = Array.from(categoryPriceMap.values()).map(cat => ({
    ...cat,
    avgPrice: (cat.totalPrice / cat.count).toFixed(2),
    uniqueProducts: cat.products.size,
    variations: cat.originalCategories.size > 1 ? cat.originalCategories.size : 0
  })).sort((a, b) => parseFloat(b.avgPrice) - parseFloat(a.avgPrice));
  
  // ========== Category Distribution ==========
  const categoryCount = {};
  allProducts.forEach(p => {
    const normalizedCat = normalizeCategory(p.category || 'Uncategorized');
    categoryCount[normalizedCat] = (categoryCount[normalizedCat] || 0) + 1;
  });
  const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
  
  // ========== Price Distribution ==========
  const priceRanges = {
    'Under ₱50': allProducts.filter(p => p.price < 50).length,
    '₱50 - ₱100': allProducts.filter(p => p.price >= 50 && p.price < 100).length,
    '₱100 - ₱200': allProducts.filter(p => p.price >= 100 && p.price < 200).length,
    '₱200 - ₱500': allProducts.filter(p => p.price >= 200 && p.price < 500).length,
    '₱500+': allProducts.filter(p => p.price >= 500).length,
  };
  
  // ========== Vendor List ==========
  const vendorsMap = new Map();
  allProducts.forEach(p => {
    const vendorId = p.stalls?.vendor_id;
    const vendorName = p.stalls?.profiles?.full_name || p.stalls?.stall_name || 'Unknown';
    if (vendorId && !vendorsMap.has(vendorId)) {
      vendorsMap.set(vendorId, {
        id: vendorId,
        name: vendorName,
        productCount: allProducts.filter(x => x.stalls?.vendor_id === vendorId).length,
        stallName: p.stalls?.stall_name,
        stallNumber: p.stalls?.stall_number
      });
    }
  });
  
  const vendorsList = Array.from(vendorsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const filteredVendors = searchVendorText 
    ? vendorsList.filter(v => v.name.toLowerCase().includes(searchVendorText.toLowerCase()))
    : vendorsList;
  
  const selectedVendor = vendorsList.find(v => v.id === selectedVendorFilter);
  const filteredProducts = selectedVendorFilter === 'all' 
    ? allProducts 
    : allProducts.filter(p => p.stalls?.vendor_id === selectedVendorFilter);
  
  const getPriceWarning = (product) => {
    const productAvg = productAverages.find(p => p.name === product.name);
    if (productAvg && parseFloat(product.price) > parseFloat(productAvg.avgPrice) * 1.3) {
      return { warning: true, message: `30%+ above avg (₱${productAvg.avgPrice})` };
    }
    if (product.price > 1000 && product.category !== 'Meat') {
      return { warning: true, message: 'Price seems high' };
    }
    return { warning: false, message: '' };
  };
  
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* KPI Cards */}
      <View style={styles.statsGridModern}>
        <LinearGradient colors={['#6366F1', '#818CF8']} style={styles.statCardModern}>
          <View style={styles.statIconContainer}><Text style={styles.statIcon}>📦</Text></View>
          <Text style={styles.statValueModern}>{totalProducts}</Text>
          <Text style={styles.statLabelModern}>Total Products</Text>
        </LinearGradient>

        <LinearGradient colors={['#10B981', '#34D399']} style={styles.statCardModern}>
          <View style={styles.statIconContainer}><Text style={styles.statIcon}>✅</Text></View>
          <Text style={styles.statValueModern}>{activeProducts}</Text>
          <Text style={styles.statLabelModern}>Active Products</Text>
        </LinearGradient>

        <LinearGradient colors={['#F59E0B', '#FBBF24']} style={styles.statCardModern}>
          <View style={styles.statIconContainer}><Text style={styles.statIcon}>💰</Text></View>
          <Text style={styles.statValueModern}>₱{overallAvgPrice}</Text>
          <Text style={styles.statLabelModern}>Overall Avg Price</Text>
        </LinearGradient>

        <LinearGradient colors={['#EF4444', '#F87171']} style={styles.statCardModern}>
          <View style={styles.statIconContainer}><Text style={styles.statIcon}>⚠️</Text></View>
          <Text style={styles.statValueModern}>{highPriceCount}</Text>
          <Text style={styles.statLabelModern}>High Price Alerts</Text>
        </LinearGradient>
      </View>

      {/* Additional Stats */}
      <View style={styles.additionalStatsRow}>
        <View style={styles.additionalStatCard}>
          <Text style={styles.additionalStatValue}>{productsOnSale}</Text>
          <Text style={styles.additionalStatLabel}>🏷️ On Sale</Text>
        </View>
        <View style={styles.additionalStatCard}>
          <Text style={styles.additionalStatValue}>{inactiveProducts}</Text>
          <Text style={styles.additionalStatLabel}>⏸️ Inactive</Text>
        </View>
        <View style={styles.additionalStatCard}>
          <Text style={styles.additionalStatValue}>{vendorsList.length}</Text>
          <Text style={styles.additionalStatLabel}>🏪 Vendors</Text>
        </View>
        {topCategory && (
          <View style={styles.additionalStatCard}>
            <Text style={styles.additionalStatValue}>{topCategory[0]}</Text>
            <Text style={styles.additionalStatLabel}>🥇 Top Category</Text>
          </View>
        )}
      </View>

      {/* Category Average Prices Section */}
      <View style={styles.tableCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>📊 Average Price by Category</Text>
          <Text style={styles.cardSubtitle}>Compare average prices across product categories</Text>
        </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.categoryCellName]}>Category</Text>
          <Text style={[styles.headerCell, styles.categoryCellAvgPrice]}>Avg Price</Text>
          <Text style={[styles.headerCell, styles.categoryCellCount]}>Products</Text>
          <Text style={[styles.headerCell, styles.categoryCellUnique]}>Unique Items</Text>
          <Text style={[styles.headerCell, styles.categoryCellVariations]}>Variations</Text>
        </View>
        {categoryAverages.map((cat, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.rowCell, styles.categoryCellName]}>
              {cat.category}
              {cat.variations > 1 && (
                <Text style={styles.variationBadge}> (mixed case)</Text>
              )}
            </Text>
            <Text style={[styles.rowCell, styles.categoryCellAvgPrice]}>₱{cat.avgPrice}</Text>
            <Text style={[styles.rowCell, styles.categoryCellCount]}>{cat.count}</Text>
            <Text style={[styles.rowCell, styles.categoryCellUnique]}>{cat.uniqueProducts}</Text>
            <Text style={[styles.rowCell, styles.categoryCellVariations]}>
              {cat.variations > 1 ? `${cat.variations} formats` : '—'}
            </Text>
          </View>
        ))}
      </View>

      {/* Product Average Prices Section */}
      <View style={styles.tableCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>📊 Average Price by Product</Text>
          <Text style={styles.cardSubtitle}>Monitor price variations across different vendors</Text>
        </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.productCellName]}>Product</Text>
          <Text style={[styles.headerCell, styles.productCellAvgPrice]}>Avg Price</Text>
          <Text style={[styles.headerCell, styles.productCellMin]}>Min</Text>
          <Text style={[styles.headerCell, styles.productCellMax]}>Max</Text>
          <Text style={[styles.headerCell, styles.productCellSpread]}>Spread</Text>
          <Text style={[styles.headerCell, styles.productCellVendors]}>Vendors</Text>
        </View>
        <ScrollView style={styles.productAvgScroll} showsVerticalScrollIndicator={true}>
          {productAverages.slice(0, 20).map((product, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.rowCell, styles.productCellName]} numberOfLines={2}>{product.name}</Text>
              <Text style={[styles.rowCell, styles.productCellAvgPrice]}>₱{product.avgPrice}</Text>
              <Text style={[styles.rowCell, styles.productCellMin]}>₱{product.minPrice}</Text>
              <Text style={[styles.rowCell, styles.productCellMax]}>₱{product.maxPrice}</Text>
              <Text style={[
                styles.rowCell, 
                styles.productCellSpread,
                product.priceSpread > 100 ? styles.highSpread : product.priceSpread > 50 ? styles.mediumSpread : styles.lowSpread
              ]}>
                ₱{product.priceSpread}
              </Text>
              <Text style={[styles.rowCell, styles.productCellVendors]}>{product.vendorCount}</Text>
            </View>
          ))}
        </ScrollView>
        {productAverages.length > 20 && (
          <View style={styles.moreResultsRow}>
            <Text style={styles.moreResultsText}>+ {productAverages.length - 20} more products</Text>
          </View>
        )}
      </View>

      {/* Price Distribution Chart */}
      <View style={styles.tableCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>📊 Price Distribution</Text>
          <Text style={styles.cardSubtitle}>How products are priced across ranges</Text>
        </View>
        <View style={styles.priceDistributionContainer}>
          {Object.entries(priceRanges).map(([range, count]) => {
            const percentage = totalProducts > 0 ? (count / totalProducts) * 100 : 0;
            return (
              <View key={range} style={styles.distributionRow}>
                <Text style={styles.distributionLabel}>{range}</Text>
                <View style={styles.distributionBarContainer}>
                  <View style={[styles.distributionBar, { width: `${percentage}%`, backgroundColor: percentage > 30 ? '#EF4444' : percentage > 15 ? '#F59E0B' : '#10B981' }]} />
                </View>
                <Text style={styles.distributionCount}>{count}</Text>
                <Text style={styles.distributionPercent}>{percentage.toFixed(0)}%</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Products Monitoring Table */}
      <View style={styles.tableCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>📦 Products Monitoring</Text>
          <Text style={styles.cardSubtitle}>Monitor vendor products and pricing</Text>
        </View>
        
        {/* Export PDF Button */}
        <View style={styles.exportSection}>
          <TouchableOpacity 
            style={styles.exportPDFButton}
            onPress={generatePDFReport}
          >
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.exportPDFGradient}>
              <Text style={styles.exportPDFButtonText}>📄 Generate PDF Report</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        
        {/* Vendor Filter */}
        <View style={styles.advancedFilterContainer}>
          <Text style={styles.filterLabel}>Filter by Vendor:</Text>
          
          <View style={styles.currentFilterRow}>
            <View style={styles.currentFilterBadge}>
              <Text style={styles.currentFilterBadgeText}>
                {selectedVendorFilter === 'all' 
                  ? `All Vendors (${vendorsList.length})` 
                  : `${selectedVendor?.name || 'Selected Vendor'} (${selectedVendor?.productCount || 0} products)`}
              </Text>
              {selectedVendorFilter !== 'all' && (
                <TouchableOpacity onPress={() => setSelectedVendorFilter('all')} style={styles.clearFilterBtn}>
                  <Text style={styles.clearFilterBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity 
              style={styles.changeVendorBtn}
              onPress={() => setShowVendorDropdown(!showVendorDropdown)}
            >
              <Text style={styles.changeVendorBtnText}>
                {showVendorDropdown ? '▲ Hide Vendors' : '▼ Select Vendor'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Vendor Dropdown */}
          {showVendorDropdown && (
            <View style={styles.vendorDropdownContainer}>
              <View style={styles.searchInputContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search vendor by name..."
                  placeholderTextColor="#9CA3AF"
                  value={searchVendorText}
                  onChangeText={setSearchVendorText}
                />
                {searchVendorText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchVendorText('')}>
                    <Text style={styles.clearSearchIcon}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <ScrollView style={styles.vendorListScroll} showsVerticalScrollIndicator={true}>
                {filteredVendors.length === 0 ? (
                  <View style={styles.noVendorsFound}>
                    <Text style={styles.noVendorsFoundText}>No vendors found</Text>
                  </View>
                ) : (
                  filteredVendors.map(vendor => (
                    <TouchableOpacity
                      key={vendor.id}
                      style={[styles.vendorItem, selectedVendorFilter === vendor.id && styles.vendorItemActive]}
                      onPress={() => {
                        setSelectedVendorFilter(vendor.id);
                        setShowVendorDropdown(false);
                        setSearchVendorText('');
                      }}
                    >
                      <View style={styles.vendorItemLeft}>
                        <Text style={styles.vendorItemIcon}>🏪</Text>
                        <View>
                          <Text style={[styles.vendorItemName, selectedVendorFilter === vendor.id && styles.vendorItemNameActive]}>
                            {vendor.name}
                          </Text>
                          <Text style={styles.vendorItemSubtext}>
                            Stall #{vendor.stallNumber} • {vendor.productCount} products
                          </Text>
                        </View>
                      </View>
                      {selectedVendorFilter === vendor.id && (
                        <Text style={styles.vendorItemCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          )}
        </View>
        
        {/* Products Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.cellProductImage]}>Image</Text>
          <Text style={[styles.headerCell, styles.cellProductName]}>Product</Text>
          <Text style={[styles.headerCell, styles.cellProductPrice]}>Price</Text>
          <Text style={[styles.headerCell, styles.cellProductAvgPrice]}>Market Avg</Text>
          <Text style={[styles.headerCell, styles.cellProductUnit]}>Unit</Text>
          <Text style={[styles.headerCell, styles.cellProductCategory]}>Category</Text>
          <Text style={[styles.headerCell, styles.cellProductVendor]}>Vendor</Text>
          <Text style={[styles.headerCell, styles.cellProductStatus]}>Status</Text>
        </View>
        
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => {
            const warning = getPriceWarning(item);
            const productAvg = productAverages.find(p => p.name === item.name);
            return (
              <View style={[styles.tableRow, warning.warning && styles.priceWarningRow]}>
                <View style={[styles.rowCell, styles.cellProductImage]}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.productThumbnail} />
                  ) : (
                    <View style={styles.productThumbnailPlaceholder}>
                      <Text style={styles.productThumbnailEmoji}>📷</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.rowCell, styles.cellProductName]} numberOfLines={2}>{item.name}</Text>
                <View style={[styles.rowCell, styles.cellProductPrice]}>
                  <Text style={[styles.productPriceText, warning.warning && styles.priceWarningText]}>
                    ₱{item.price}
                  </Text>
                  {warning.warning && <Text style={styles.priceWarningIcon}>⚠️</Text>}
                </View>
                <Text style={[styles.rowCell, styles.cellProductAvgPrice]}>
                  {productAvg ? `₱${productAvg.avgPrice}` : '—'}
                </Text>
                <Text style={[styles.rowCell, styles.cellProductUnit]}>{item.unit}</Text>
                <Text style={[styles.rowCell, styles.cellProductCategory]}>{item.category}</Text>
                <Text style={[styles.rowCell, styles.cellProductVendor]} numberOfLines={1}>
                  {item.stalls?.profiles?.full_name || item.stalls?.stall_name || 'Unknown'}
                </Text>
                <View style={[styles.rowCell, styles.cellProductStatus]}>
                  <View style={[styles.statusBadge, item.is_available ? styles.activeBadge : styles.inactiveBadge]}>
                    <Text style={styles.statusText}>{item.is_available ? 'Active' : 'Inactive'}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
        
        {filteredProducts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Products Found</Text>
            <Text style={styles.emptyText}>No products available for the selected vendor</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

  const renderCompliance = () => (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>✅ Vendor Compliance Monitoring</Text>
        <Text style={styles.cardSubtitle}>Track price updates and chat responses</Text>
      </View>
      
      <View style={styles.complianceSummary}>
        <View style={styles.complianceStat}>
          <Text style={styles.complianceStatNumber}>
            {vendors.filter(v => getComplianceStatus(v).status === 'Good').length}
          </Text>
          <Text style={styles.complianceStatLabel}>Compliant</Text>
        </View>
        <View style={styles.complianceStat}>
          <Text style={styles.complianceStatNumber}>
            {vendors.filter(v => getComplianceStatus(v).status === 'Warning').length}
          </Text>
          <Text style={styles.complianceStatLabel}>Warning</Text>
        </View>
        <View style={styles.complianceStat}>
          <Text style={styles.complianceStatNumber}>
            {vendors.filter(v => getComplianceStatus(v).status === 'Critical').length}
          </Text>
          <Text style={styles.complianceStatLabel}>Critical</Text>
        </View>
      </View>
      
      <View style={styles.complianceTableHeader}>
        <Text style={[styles.complianceHeaderCell, styles.complianceCellVendor]}>VENDOR</Text>
        <Text style={[styles.complianceHeaderCell, styles.complianceCellUpdate]}>LAST PRICE UPDATE</Text>
        <Text style={[styles.complianceHeaderCell, styles.complianceCellChat]}>LAST CHAT</Text>
        <Text style={[styles.complianceHeaderCell, styles.complianceCellStatus]}>STATUS</Text>
        <Text style={[styles.complianceHeaderCell, styles.complianceCellActions]}>ACTIONS</Text>
      </View>
      
      {vendors.length === 0 ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text>No vendors found</Text>
        </View>
      ) : (
        vendors.map((item) => {
          const compliance = getComplianceStatus(item);
          const priceDays = getDaysSince(item.last_price_update);
          const chatDays = getDaysSince(item.last_chat_response);
          
          return (
            <View key={item.id} style={styles.complianceTableRow}>
              <Text style={[styles.complianceRowCell, styles.complianceCellVendor]} numberOfLines={1}>
                {item.full_name || item.email?.split('@')[0] || 'Unknown'}
              </Text>
              
              <View style={[styles.complianceRowCell, styles.complianceCellUpdate]}>
                <View style={styles.complianceUpdateCell}>
                  <Text style={styles.complianceUpdateText}>
                    {item.last_price_update ? `${priceDays} days ago` : 'Never'}
                  </Text>
                  {priceDays > 7 && <Text style={styles.complianceWarningIcon}>⚠️</Text>}
                </View>
              </View>
              
              <View style={[styles.complianceRowCell, styles.complianceCellChat]}>
                <View style={styles.complianceUpdateCell}>
                  <Text style={styles.complianceUpdateText}>
                    {item.last_chat_response ? `${chatDays} days ago` : 'Never'}
                  </Text>
                  {chatDays > 3 && <Text style={styles.complianceWarningIcon}>⚠️</Text>}
                </View>
              </View>
              
              <View style={[styles.complianceRowCell, styles.complianceCellStatus]}>
                <View style={[styles.complianceStatusBadge, { backgroundColor: compliance.color + '20' }]}>
                  <Text style={[styles.complianceStatusText, { color: compliance.color }]}>
                    {compliance.status}
                  </Text>
                </View>
              </View>
              
              <View style={{ width: '16%', justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity 
                    style={{ 
                      backgroundColor: '#3B82F6', 
                      paddingHorizontal: 8, 
                      paddingVertical: 5, 
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                    onPress={() => {
                      setSelectedReminderVendor(item);
                      setReminderReason('');
                      setReminderModalVisible(true);
                    }}
                  >
                    <Text style={{ fontSize: 10, color: 'white', fontWeight: '600' }}>📧 Remind</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ 
                      backgroundColor: '#F59E0B', 
                      paddingHorizontal: 8, 
                      paddingVertical: 5, 
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                    onPress={() => {
                      setSelectedVendor(item);
                      setViolationModal(true);
                    }}
                  >
                    <Text style={{ fontSize: 10, color: 'white', fontWeight: '600' }}>⚠️ Warn</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  const renderOverview = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#DC2626', '#EF4444', '#F87171']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.welcomeCard}
      >
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeEmoji}>👋</Text>
          <View>
            <Text style={styles.welcomeTitle}>Welcome back,</Text>
            <Text style={styles.welcomeName}>{profile?.full_name || 'Admin'}!</Text>
            <Text style={styles.welcomeSubtitle}>Here's what's happening with your marketplace today.</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsGridModern}>
        <LinearGradient
          colors={['#6366F1', '#818CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCardModern}
        >
          <View style={styles.statIconContainer}>
            <Text style={styles.statIcon}>👥</Text>
          </View>
          <Text style={styles.statValueModern}>{stats.totalUsers?.toLocaleString() || 0}</Text>
          <Text style={styles.statLabelModern}>Total Users</Text>
          <View style={styles.statTrend}>
            <Text style={styles.statTrendText}>+12% this month</Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={['#10B981', '#34D399']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCardModern}
        >
          <View style={styles.statIconContainer}>
            <Text style={styles.statIcon}>🏪</Text>
          </View>
          <Text style={styles.statValueModern}>{stats.totalVendors?.toLocaleString() || 0}</Text>
          <Text style={styles.statLabelModern}>Active Vendors</Text>
          <View style={styles.statTrend}>
            <Text style={styles.statTrendText}>+5 new this week</Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={['#F59E0B', '#FBBF24']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCardModern}
        >
          <View style={styles.statIconContainer}>
            <Text style={styles.statIcon}>👤</Text>
          </View>
          <Text style={styles.statValueModern}>{stats.totalConsumers?.toLocaleString() || 0}</Text>
          <Text style={styles.statLabelModern}>Total Customers</Text>
          <View style={styles.statTrend}>
            <Text style={styles.statTrendText}>Active shoppers</Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={['#8B5CF6', '#A78BFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCardModern}
        >
          <View style={styles.statIconContainer}>
            <Text style={styles.statIcon}>📍</Text>
          </View>
          <Text style={styles.statValueModern}>{stats.totalStalls?.toLocaleString() || 0}</Text>
          <Text style={styles.statLabelModern}>Market Stalls</Text>
          <View style={styles.statTrend}>
            <Text style={styles.statTrendText}>Across all sections</Text>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={['#EF4444', '#F87171']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statCardModern}
        >
          <View style={styles.statIconContainer}>
            <Text style={styles.statIcon}>📋</Text>
          </View>
          <Text style={styles.statValueModern}>{stats.pendingApplications?.toLocaleString() || 0}</Text>
          <Text style={styles.statLabelModern}>Pending Approvals</Text>
          <View style={styles.statTrend}>
            <Text style={styles.statTrendText}>Need your review</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitleModern}>⚡ Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => setActiveSection('applications')}
          >
            <View style={styles.quickActionIconBg}>
              <Text style={styles.quickActionIcon}>📝</Text>
            </View>
            <Text style={styles.quickActionTitle}>Review Vendors</Text>
            <Text style={styles.quickActionDesc}>Approve or reject applications</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => setActiveSection('announcements')}
          >
            <View style={styles.quickActionIconBg}>
              <Text style={styles.quickActionIcon}>📢</Text>
            </View>
            <Text style={styles.quickActionTitle}>Post Announcement</Text>
            <Text style={styles.quickActionDesc}>Share updates with everyone</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => setActiveSection('complaints')}
          >
            <View style={styles.quickActionIconBg}>
              <Text style={styles.quickActionIcon}>💬</Text>
            </View>
            <Text style={styles.quickActionTitle}>Resolve Issues</Text>
            <Text style={styles.quickActionDesc}>Handle customer complaints</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionCard}
            onPress={() => setActiveSection('reports')}
          >
            <View style={styles.quickActionIconBg}>
              <Text style={styles.quickActionIcon}>📊</Text>
            </View>
            <Text style={styles.quickActionTitle}>View Reports</Text>
            <Text style={styles.quickActionDesc}>Check platform activity</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.recentActivitySection}>
        <Text style={styles.sectionTitleModern}>🔄 Recent Activity</Text>
        <View style={styles.activityList}>
          <View style={styles.activityItem}>
            <View style={styles.activityIconGreen}>
              <Text style={styles.activityIconText}>✓</Text>
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>New vendor application</Text>
              <Text style={styles.activityTime}>2 hours ago</Text>
            </View>
          </View>
          <View style={styles.activityItem}>
            <View style={styles.activityIconBlue}>
              <Text style={styles.activityIconText}>📦</Text>
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>New order received</Text>
              <Text style={styles.activityTime}>5 hours ago</Text>
            </View>
          </View>
          <View style={styles.activityItem}>
            <View style={styles.activityIconYellow}>
              <Text style={styles.activityIconText}>⚠️</Text>
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Complaint reported</Text>
              <Text style={styles.activityTime}>1 day ago</Text>
            </View>
          </View>
          <View style={styles.activityItem}>
            <View style={styles.activityIconPurple}>
              <Text style={styles.activityIconText}>🏪</Text>
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>New stall registered</Text>
              <Text style={styles.activityTime}>2 days ago</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderUsers = () => (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>👥 User Management</Text>
        <Text style={styles.cardSubtitle}>Manage all platform users</Text>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.cellUser]}>User</Text>
        <Text style={[styles.headerCell, styles.cellEmail]}>Email</Text>
        <Text style={[styles.headerCell, styles.cellRole]}>Role</Text>
        <Text style={[styles.headerCell, styles.cellActions]}>Actions</Text>
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.tableRow}>
            <Text style={[styles.rowCell, styles.cellUser]} numberOfLines={1}>{item.full_name || 'N/A'}</Text>
            <Text style={[styles.rowCell, styles.cellEmail]} numberOfLines={1}>{item.email}</Text>
            <View style={styles.cellRole}>
              <View style={[styles.roleBadge, { backgroundColor: item.role === 'admin' ? '#DC2626' : item.role === 'vendor' ? '#10B981' : '#3B82F6' }]}>
                <Text style={styles.roleText}>{item.role}</Text>
              </View>
            </View>
            <View style={[styles.cellActions, styles.actionsContainer]}>
              {item.role !== 'admin' && (
                <>
                  <TouchableOpacity style={[styles.smallBtn, styles.vendorBtn]} onPress={() => updateUserRole(item.id, 'vendor')}>
                    <Text style={styles.smallBtnText}>Vendor</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, styles.consumerBtn]} onPress={() => updateUserRole(item.id, 'consumer')}>
                    <Text style={styles.smallBtnText}>Customer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, styles.deleteBtn]} onPress={() => deleteUser(item.id)}>
                    <Text style={styles.smallBtnText}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );

  const renderVendors = () => (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>🏪 Vendor Management</Text>
        <Text style={styles.cardSubtitle}>Manage vendor accounts</Text>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.cellVendorName]}>Vendor</Text>
        <Text style={[styles.headerCell, styles.cellVendorEmail]}>Email</Text>
        <Text style={[styles.headerCell, styles.cellVendorStall]}>Stall</Text>
        <Text style={[styles.headerCell, styles.cellActions]}>Actions</Text>
      </View>
      <FlatList
        data={users.filter(u => u.role === 'vendor')}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const vendorStall = stalls.find(s => s.vendor_id === item.id);
          return (
            <View style={styles.tableRow}>
              <Text style={[styles.rowCell, styles.cellVendorName]} numberOfLines={1}>{item.full_name || 'N/A'}</Text>
              <Text style={[styles.rowCell, styles.cellVendorEmail]} numberOfLines={1}>{item.email}</Text>
              <Text style={[styles.rowCell, styles.cellVendorStall]} numberOfLines={1}>{vendorStall?.stall_name || `Stall #${vendorStall?.stall_number}` || 'Not assigned'}</Text>
              <View style={[styles.cellActions, styles.actionsContainer]}>
                <TouchableOpacity style={[styles.smallBtn, styles.printBtn]} onPress={() => printReport(`Vendor Profile - ${item.full_name}`)}>
                  <Text style={styles.smallBtnText}>📄 Print</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );

  const renderApplications = () => (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>📋 Vendor Applications</Text>
        <Text style={styles.cardSubtitle}>Review pending vendor registrations</Text>
      </View>
      {applications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>No Pending Applications</Text>
          <Text style={styles.emptyText}>All vendor applications have been reviewed</Text>
        </View>
      ) : (
        applications.map(app => (
          <View key={app.id} style={styles.appCard}>
            <View style={styles.appHeader}>
              <Text style={styles.appBusinessName}>{app.business_name}</Text>
              <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Pending</Text></View>
            </View>
            <Text style={styles.appText}>👤 {app.profiles?.full_name || app.profiles?.email}</Text>
            <Text style={styles.appText}>📂 {app.category || 'N/A'}</Text>
            <Text style={styles.appText}>📅 {new Date(app.application_date).toLocaleDateString()}</Text>
            <View style={styles.appButtonRow}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => approveApplication(app)}>
                <Text style={styles.approveBtnText}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectApplication(app)}>
                <Text style={styles.rejectBtnText}>✗ Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </View>
  );

const renderStalls = () => (
  <View style={styles.tableCard}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>📍 Stall Management</Text>
      <Text style={styles.cardSubtitle}>Manage all market stalls</Text>
    </View>
    <View style={styles.tableHeader}>
      <Text style={[styles.headerCell, styles.cellStallNum]}>#</Text>
      <Text style={[styles.headerCell, styles.cellStallName]}>Name</Text>
      <Text style={[styles.headerCell, styles.cellStallSection]}>Section</Text>
      <Text style={[styles.headerCell, styles.cellStallVendor]}>Vendor</Text>
      <Text style={[styles.headerCell, styles.cellStallStatus]}>Status</Text>
      <Text style={[styles.headerCell, styles.cellStallAction]}>Action</Text>
    </View>
    <FlatList
      data={stalls}
      keyExtractor={(item) => item.id?.toString()}
      renderItem={({ item }) => (
        <View style={styles.tableRow}>
          <Text style={[styles.rowCell, styles.cellStallNum]}>{item.stall_number}</Text>
          <Text style={[styles.rowCell, styles.cellStallName]} numberOfLines={1}>
            {item.stall_name || 'Unnamed'}
          </Text>
          <Text style={[styles.rowCell, styles.cellStallSection]}>{item.section}</Text>
          <Text style={[styles.rowCell, styles.cellStallVendor]} numberOfLines={1}>
            {item.profiles?.full_name || item.profiles?.email || 'Unassigned'}
          </Text>
          <View style={styles.cellStallStatus}>
            <View style={[
              styles.statusBadge, 
              item.is_active ? styles.activeBadge : styles.inactiveBadge
            ]}>
              <Text style={styles.statusText}>
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          <View style={styles.cellStallAction}>
            <TouchableOpacity 
              style={[
                styles.smallButton, 
                item.is_active ? styles.deactivateBtn : styles.activateBtn
              ]} 
              onPress={() => confirmStallAction(item, item.is_active ? 'deactivate' : 'activate')}
            >
              <Text style={styles.smallButtonText}>
                {item.is_active ? 'Deactivate' : 'Activate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  </View>
);

  const renderOrders = () => (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>📦 Order Management</Text>
        <Text style={styles.cardSubtitle}>View all platform orders</Text>
      </View>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.cellOrderId]}>Order #</Text>
        <Text style={[styles.headerCell, styles.cellOrderCustomer]}>Customer</Text>
        <Text style={[styles.headerCell, styles.cellOrderAmount]}>Amount</Text>
        <Text style={[styles.headerCell, styles.cellOrderStatus]}>Status</Text>
        <Text style={[styles.headerCell, styles.cellOrderDate]}>Date</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.tableRow}>
            <Text style={[styles.rowCell, styles.cellOrderId]} numberOfLines={1}>{item.order_number?.slice(-8) || item.id.slice(-8)}</Text>
            <Text style={[styles.rowCell, styles.cellOrderCustomer]} numberOfLines={1}>{item.profiles?.full_name || 'N/A'}</Text>
            <Text style={[styles.rowCell, styles.cellOrderAmount]}>₱{item.total_amount}</Text>
            <View style={styles.cellOrderStatus}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={[styles.rowCell, styles.cellOrderDate]}>{formatDate(item.created_at)}</Text>
          </View>
        )}
      />
    </View>
  );

  const renderAnnouncements = () => (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>📢 Announcements</Text>
        <Text style={styles.cardSubtitle}>Post market-wide announcements</Text>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={() => setAnnouncementModal(true)}>
        <Text style={styles.addBtnText}>+ Post New Announcement</Text>
      </TouchableOpacity>
      {announcements.map(ann => (
        <View key={ann.id} style={styles.announcementCard}>
          <View style={styles.announcementHeader}>
            <Text style={styles.announcementTitle}>{ann.title}</Text>
            <TouchableOpacity onPress={() => deleteAnnouncement(ann.id)}>
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.announcementContent}>{ann.content}</Text>
          <Text style={styles.announcementDate}>{new Date(ann.created_at).toLocaleDateString()}</Text>
        </View>
      ))}
    </View>
  );

  const renderViolations = () => (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>⚠️ Vendor Violations</Text>
        <Text style={styles.cardSubtitle}>Track warnings issued to vendors</Text>
      </View>
      {violations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>No Violations Recorded</Text>
        </View>
      ) : (
        violations.map(v => (
          <View key={v.id} style={styles.violationCard}>
            <Text style={styles.violationVendor}>🏪 {v.profiles?.full_name || 'Unknown Vendor'}</Text>
            <Text style={styles.violationReason}>⚠️ {v.reason}</Text>
            <Text style={styles.violationDate}>📅 Issued: {new Date(v.created_at).toLocaleDateString()}</Text>
          </View>
        ))
      )}
    </View>
  );

  const renderComplaints = () => (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>💬 Customer Complaints</Text>
        <Text style={styles.cardSubtitle}>Resolve disputes between customers and vendors</Text>
      </View>
      {complaints.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>No Pending Complaints</Text>
        </View>
      ) : (
        complaints.map(c => (
          <View key={c.id} style={styles.complaintCard}>
            <Text style={styles.complaintTitle}>👤 {c.profiles?.full_name}</Text>
            <Text style={styles.complaintAbout}>📍 About: {c.stalls?.stall_name || 'General'}</Text>
            <Text style={styles.complaintMessage}>💬 "{c.message}"</Text>
            <TouchableOpacity style={styles.resolveBtn} onPress={() => { setSelectedComplaint(c); setComplaintModal(true); }}>
              <Text style={styles.resolveBtnText}>Resolve Complaint →</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );

  const renderReports = () => <ReportsSection />;

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      );
    }
    switch (activeSection) {
      case 'overview': return renderOverview();
      case 'users': return renderUsers();
      case 'products': return renderProducts();
      case 'vendors': return renderVendors();
      case 'compliance': return renderCompliance();
      case 'applications': return renderApplications();
      case 'stalls': return renderStalls();
      case 'orders': return renderOrders();
      case 'announcements': return renderAnnouncements();
      case 'violations': return renderViolations();
      case 'complaints': return renderComplaints();
      case 'reports': return renderReports();
      default: return renderOverview();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#DC2626" />
      
      <View style={[styles.sidebar, sidebarCollapsed && styles.sidebarCollapsed]}>
        <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>🛒</Text>
          {!sidebarCollapsed && <Text style={styles.logoText}>PalengkeHub</Text>}
        </LinearGradient>

        {isWeb && (
          <TouchableOpacity style={styles.collapseBtn} onPress={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <Text style={styles.collapseIcon}>{sidebarCollapsed ? '→' : '←'}</Text>
          </TouchableOpacity>
        )}

        <ScrollView 
          style={styles.navScrollView}
          contentContainerStyle={styles.navScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, activeSection === item.id && styles.navItemActive]}
              onPress={() => setActiveSection(item.id)}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              {!sidebarCollapsed && (
                <View style={styles.navTextContainer}>
                  <Text style={[styles.navLabel, activeSection === item.id && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                  {activeSection === item.id && (
                    <View style={[styles.navIndicator, { backgroundColor: item.color }]} />
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.userSection}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>👤</Text>
          </View>
          {!sidebarCollapsed && (
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>{profile?.full_name || 'Admin'}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
            </View>
          )}
          
          {isWeb ? (
            <button
              onClick={async () => {
                const confirmLogout = window.confirm('Are you sure you want to logout?');
                if (confirmLogout) {
                  await supabase.auth.signOut();
                  window.location.href = '/';
                }
              }}
              style={{
                backgroundColor: '#DC2626',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                marginLeft: 'auto',
              }}
            >
              🚪 Logout
            </button>
          ) : (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutIcon}>🚪</Text>
              {!sidebarCollapsed && <Text style={styles.logoutText}>Logout</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.mainContent, sidebarCollapsed && styles.mainContentExpanded]}>
        <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.header}>
          <View style={styles.headerLeft}>
            {!isWeb && (
              <TouchableOpacity onPress={() => setSidebarCollapsed(!sidebarCollapsed)} style={styles.menuBtn}>
                <Text style={styles.menuIcon}>☰</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>{menuItems.find(m => m.id === activeSection)?.label || 'Dashboard'}</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Text style={styles.refreshIcon}>⟳</Text>
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={isWeb ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
        >
          {renderContent()}
        </ScrollView>
      </View>

      {/* Announcement Modal */}
      <Modal visible={announcementModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>📢 New Announcement</Text>
            <TextInput style={styles.modalInput} placeholder="Announcement Title" placeholderTextColor="#9CA3AF" value={announcementTitle} onChangeText={setAnnouncementTitle} />
            <TextInput style={[styles.modalInput, styles.textArea]} placeholder="Announcement Content" placeholderTextColor="#9CA3AF" value={announcementContent} onChangeText={setAnnouncementContent} multiline numberOfLines={4} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setAnnouncementModal(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={postAnnouncement}><Text style={styles.modalSubmitText}>Post</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Violation Modal */}
      <Modal visible={violationModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>⚠️ Issue Warning</Text>
            <Text style={styles.modalSubtitle}>Vendor: {selectedVendor?.full_name}</Text>
            <TextInput style={[styles.modalInput, styles.textArea]} placeholder="Reason for violation" placeholderTextColor="#9CA3AF" value={violationReason} onChangeText={setViolationReason} multiline numberOfLines={3} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setViolationModal(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmit, styles.warningSubmit]} onPress={() => issueComplianceWarning(selectedVendor, violationReason)}><Text style={styles.modalSubmitText}>Issue Warning</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Complaint Modal */}
      <Modal visible={complaintModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>💬 Resolve Complaint</Text>
            <Text style={styles.modalSubtitle}>Complaint: {selectedComplaint?.message}</Text>
            <TextInput style={[styles.modalInput, styles.textArea]} placeholder="Resolution message" placeholderTextColor="#9CA3AF" value={resolutionMessage} onChangeText={setResolutionMessage} multiline numberOfLines={3} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setComplaintModal(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={resolveComplaint}><Text style={styles.modalSubmitText}>Mark Resolved</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={stallModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStallModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {stallAction === 'activate' ? '✅ Activate Stall' : '⚠️ Deactivate Stall'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Stall #{selectedStall?.stall_number} - {selectedStall?.stall_name || 'Unnamed'}
            </Text>
            <Text style={{ textAlign: 'center', marginBottom: 20, color: '#64748B' }}>
              Are you sure you want to {stallAction} this stall?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancel} 
                onPress={() => setStallModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSubmit, stallAction === 'activate' ? { backgroundColor: '#10B981' } : { backgroundColor: '#EF4444' }]} 
                onPress={executeStallAction}
              >
                <Text style={styles.modalSubmitText}>
                  {stallAction === 'activate' ? 'Activate' : 'Deactivate'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reminderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReminderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxWidth: 500 }]}>
            <Text style={styles.modalTitle}>📧 Send Compliance Reminder</Text>
            <Text style={styles.modalSubtitle}>
              Vendor: {selectedReminderVendor?.full_name || selectedReminderVendor?.email}
            </Text>
            
            <Text style={[styles.modalLabel, { marginTop: 10 }]}>Reminder Reason</Text>
            <TextInput
              style={[styles.modalInput, styles.textArea]}
              placeholder="Enter reason for this reminder..."
              placeholderTextColor="#9CA3AF"
              value={reminderReason}
              onChangeText={setReminderReason}
              multiline
              numberOfLines={4}
            />
            <Text style={styles.reminderHint}>
              This message will be sent to the vendor as a notification
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancel} 
                onPress={() => {
                  setReminderModalVisible(false);
                  setReminderReason('');
                  setSelectedReminderVendor(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSubmit, !reminderReason.trim() && { opacity: 0.5 }]} 
                onPress={() => {
                  if (reminderReason.trim()) {
                    setReminderModalVisible(false);
                    sendComplianceReminder(selectedReminderVendor, reminderReason);
                    setReminderReason('');
                    setSelectedReminderVendor(null);
                  }
                }}
                disabled={!reminderReason.trim()}
              >
                <Text style={styles.modalSubmitText}>Send Reminder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#F8FAFC' },
  
  sidebar: { 
    position: Platform.OS === 'web' ? 'fixed' : 'absolute', 
    left: 0, 
    top: 0, 
    bottom: 0, 
    width: 280, 
    backgroundColor: 'white', 
    borderRightWidth: 1, 
    borderRightColor: '#E2E8F0', 
    zIndex: 100, 
    elevation: 5,
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarCollapsed: { width: 80 },
  
  logoContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    gap: 12, 
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  logoEmoji: { fontSize: 28 },
  logoText: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: 'white',
    letterSpacing: 0.5,
  },
  
  collapseBtn: { 
    position: 'absolute', 
    right: -12, 
    top: 80, 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: '#DC2626', 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4,
    zIndex: 101,
  },
  collapseIcon: { fontSize: 12, color: 'white', fontWeight: 'bold' },
  
  navScrollView: { flex: 1 },
  navScrollContent: { paddingTop: 16, paddingBottom: 16, paddingHorizontal: 12 },
  
  navItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 12, 
    marginBottom: 4,
    borderRadius: 12, 
    gap: 12,
  },
  navItemActive: { 
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  navIcon: { fontSize: 20, width: 32, textAlign: 'center' },
  navTextContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navLabel: { fontSize: 14, fontWeight: '500', color: '#64748B' },
  navLabelActive: { color: '#DC2626', fontWeight: '600' },
  navIndicator: { width: 3, height: 20, borderRadius: 2 },
  
  reportTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reportTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  reportTabActive: {
    backgroundColor: '#FEF2F2',
  },
  reportTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  reportTabTextActive: {
    color: '#DC2626',
  },
  reportTabBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  reportTabBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  reportStatsRow: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reportStatBox: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  reportStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  reportStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  reportListContainer: {
    maxHeight: 500,
    padding: 20,
  },
  reportCardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  reportTypeIcon: {
    fontSize: 12,
  },
  reportTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  reportStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reportStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reportReporterInfo: {
    marginBottom: 8,
  },
  reportReporterLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  reportReporterName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
  },
  reportTargetInfo: {
    marginBottom: 8,
  },
  reportTargetLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  reportTargetName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
  },
  reportDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
  },
  reportDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 8,
  },
  reportAdminNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  reportAdminNoteLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  reportAdminNoteText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  reportLoadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  reportLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  reportEmptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  reportEmptyIcon: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.5,
  },
  reportEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  reportEmptyText: {
    fontSize: 13,
    color: '#64748B',
  },
  reportModalContainer: {
    width: Platform.OS === 'web' ? 550 : '90%',
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  reportModalSection: {
    marginBottom: 20,
  },
  reportModalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  reportModalValue: {
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    lineHeight: 20,
  },
  reportModalTextArea: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FAFAFA',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reportStatusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reportStatusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportStatusButtonActive: {
    borderColor: 'transparent',
  },
  reportStatusButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },

  userSection: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderTopWidth: 1, 
    borderTopColor: '#E2E8F0', 
    gap: 12,
    flexShrink: 0,
    backgroundColor: 'white',
  },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  userAvatarText: { fontSize: 18 },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  userEmail: { fontSize: 11, color: '#64748B', marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FEF2F2' },
  logoutIcon: { fontSize: 16 },
  logoutText: { fontSize: 12, color: '#DC2626', fontWeight: '500' },

  mainContent: { flex: 1, marginLeft: Platform.OS === 'web' ? 280 : 0 },
  mainContentExpanded: { marginLeft: Platform.OS === 'web' ? 80 : 0 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 32, 
    paddingVertical: 20, 
    borderBottomLeftRadius: 24, 
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  menuBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  menuIcon: { fontSize: 20, color: 'white' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', letterSpacing: 0.5 },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  refreshIcon: { fontSize: 18, color: 'white' },
  content: { flex: 1 },
  contentContainer: { padding: 32, paddingBottom: 48 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 60 },
  loadingText: { marginTop: 16, fontSize: 14, color: '#64748B', fontWeight: '500' },

  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 20, 
    marginBottom: 32 
  },
  welcomeCard: {
    borderRadius: 24,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  welcomeContent: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  welcomeEmoji: { fontSize: 48 },
  welcomeTitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  welcomeName: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  welcomeSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  statsGridModern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCardModern: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 220 : '45%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIcon: { fontSize: 24 },
  statValueModern: { fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  statLabelModern: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 8 },
  statTrend: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statTrendText: { fontSize: 10, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },

  quickActionsSection: { marginBottom: 24 },
  sectionTitleModern: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 16, letterSpacing: -0.3 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickActionCard: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 200 : '45%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickActionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionIcon: { fontSize: 28 },
  quickActionTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  quickActionDesc: { fontSize: 11, color: '#64748B', textAlign: 'center' },

  recentActivitySection: { marginBottom: 24 },
  activityList: {
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  activityIconGreen: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconBlue: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconYellow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconPurple: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIconText: { fontSize: 18 },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '500', color: '#1E293B', marginBottom: 2 },
  activityTime: { fontSize: 11, color: '#94A3B8' },
  
  statCard: { 
    flex: 1, 
    minWidth: Platform.OS === 'web' ? 200 : '45%', 
    backgroundColor: 'white', 
    borderRadius: 24, 
    padding: 24, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statValue: { fontSize: 32, fontWeight: 'bold', color: '#1E293B', marginBottom: 8 },
  statLabel: { fontSize: 13, color: '#64748B', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },

  tableCard: { 
    backgroundColor: 'white', 
    borderRadius: 24, 
    overflow: 'hidden', 
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: { padding: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FAFAFA' },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', letterSpacing: -0.3 },
  cardSubtitle: { fontSize: 14, color: '#64748B', marginTop: 6, fontWeight: '400' },
  tableHeader: { 
    flexDirection: 'row', 
    backgroundColor: '#F8FAFC', 
    paddingVertical: 14, 
    paddingHorizontal: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0' 
  },
  headerCell: { fontSize: 12, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F8FAFC',
  },
  rowCell: { fontSize: 14, color: '#334155', fontWeight: '500' },
  
  cellUser: { width: '20%' },
  cellEmail: { width: '30%' },
  cellRole: { width: '15%' },
  cellActions: { width: '35%' },
  cellVendor: { width: '25%' },
  cellLastUpdate: { width: '20%' },
  cellLastChat: { width: '20%' },
  cellStatus: { width: '15%' },
  cellVendorName: { width: '25%' },
  cellVendorEmail: { width: '30%' },
  cellVendorStall: { width: '25%' },
  cellStallNum: { width: '10%' },
  cellStallName: { width: '25%' },
  cellStallSection: { width: '20%' },
  cellStallVendor: { width: '25%' },
  cellStallStatus: { width: '12%' },
  cellStallAction: { 
  width: '12%',
  justifyContent: 'center',
  alignItems: 'center'
},

smallButton: { 
  paddingHorizontal: 16,
  paddingVertical: 6, 
  borderRadius: 8,
  minWidth: 85,
  alignItems: 'center',
  justifyContent: 'center'
},
activateBtn: { 
  backgroundColor: '#10B981' 
},
deactivateBtn: { 
  backgroundColor: '#EF4444' 
},
smallButtonText: { 
  fontSize: 11, 
  color: 'white', 
  fontWeight: '600',
  textAlign: 'center'
},
  cellOrderId: { width: '20%' },
  cellOrderCustomer: { width: '30%' },
  cellOrderAmount: { width: '15%' },
  cellOrderStatus: { width: '20%' },
  cellOrderDate: { width: '15%' },
  
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start' },
  roleText: { fontSize: 11, fontWeight: '600', color: 'white', letterSpacing: 0.3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '600', color: 'white', letterSpacing: 0.3 },
  activeBadge: { backgroundColor: '#D1FAE5' },
  inactiveBadge: { backgroundColor: '#FEE2E2' },
  actionsContainer: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  vendorBtn: { backgroundColor: '#10B981' },
  consumerBtn: { backgroundColor: '#3B82F6' },
  deleteBtn: { backgroundColor: '#EF4444' },
  printBtn: { backgroundColor: '#6B7280' },
  smallBtnText: { fontSize: 11, color: 'white', fontWeight: '600', letterSpacing: 0.3 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  activateBtn: { backgroundColor: '#10B981' },
  deactivateBtn: { backgroundColor: '#EF4444' },
  smallButtonText: { fontSize: 11, color: 'white', fontWeight: '600', letterSpacing: 0.3 },

  complianceSummary: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FAFAFA' },
  complianceStat: { alignItems: 'center' },
  complianceStatNumber: { fontSize: 28, fontWeight: 'bold', color: '#DC2626' },
  complianceStatLabel: { fontSize: 12, color: '#64748B', marginTop: 6, fontWeight: '500' },
  updateCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updateText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  warningIcon: { fontSize: 14 },
  complianceBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start' },
  complianceBadgeText: { fontSize: 11, fontWeight: '600' },
  complianceActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-start' },
  reminderBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  reminderBtnText: { fontSize: 11, color: 'white', fontWeight: '600', letterSpacing: 0.3 },
  warningComplianceBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  warningBtnText: { fontSize: 11, color: 'white', fontWeight: '600', letterSpacing: 0.3 },
  
  complianceTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  complianceHeaderCell: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  complianceTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  complianceRowCell: {
    fontSize: 13,
    color: '#334155',
  },
  complianceCellVendor: { width: '25%', paddingRight: 8 },
  complianceCellUpdate: { width: '22%', paddingRight: 8 },
  complianceCellChat: { width: '22%', paddingRight: 8 },
  complianceCellStatus: { width: '15%', paddingRight: 8 },
  complianceCellActions: { width: '16%' },
  complianceUpdateCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  complianceUpdateText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  complianceWarningIcon: { fontSize: 12 },
  complianceStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  complianceStatusText: { fontSize: 11, fontWeight: '600' },
  complianceActionsContainer: { flexDirection: 'row', gap: 8 },
  complianceRemindBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  complianceRemindBtnText: { fontSize: 10, color: 'white', fontWeight: '600' },
  complianceWarnBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  complianceWarnBtnText: { fontSize: 10, color: 'white', fontWeight: '600' },

  reminderHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },

  emptyContainer: { alignItems: 'center', padding: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 20, opacity: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1E293B', marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#64748B' },
  appCard: { backgroundColor: '#FAFAFA', borderRadius: 20, padding: 20, marginBottom: 16, marginHorizontal: 20, marginTop: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  appBusinessName: { fontSize: 17, fontWeight: 'bold', color: '#1E293B' },
  pendingBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  pendingBadgeText: { fontSize: 11, fontWeight: '600', color: '#F59E0B' },
  appText: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  appButtonRow: { flexDirection: 'row', gap: 14, marginTop: 16 },
  approveBtn: { flex: 1, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  approveBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  rejectBtn: { flex: 1, backgroundColor: '#EF4444', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  rejectBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },

  addBtn: { backgroundColor: '#DC2626', margin: 20, paddingVertical: 14, borderRadius: 14, alignItems: 'center', shadowColor: '#DC2626', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  addBtnText: { color: 'white', fontWeight: '600', fontSize: 15, letterSpacing: 0.5 },
  announcementCard: { backgroundColor: '#FAFAFA', borderRadius: 20, padding: 20, marginBottom: 16, marginHorizontal: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  announcementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  announcementTitle: { fontSize: 17, fontWeight: 'bold', color: '#1E293B' },
  deleteIcon: { fontSize: 18, color: '#94A3B8' },
  announcementContent: { fontSize: 14, color: '#475569', marginBottom: 10, lineHeight: 22 },
  announcementDate: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },

  violationCard: { backgroundColor: '#FEF3C7', borderRadius: 20, padding: 20, marginBottom: 16, marginHorizontal: 20, borderWidth: 1, borderColor: '#FDE68A' },
  violationVendor: { fontSize: 16, fontWeight: 'bold', color: '#92400E', marginBottom: 6 },
  violationReason: { fontSize: 14, color: '#78350F', marginBottom: 6 },
  violationDate: { fontSize: 11, color: '#B45309', fontWeight: '500' },

  complaintCard: { backgroundColor: '#FEE2E2', borderRadius: 20, padding: 20, marginBottom: 16, marginHorizontal: 20, borderWidth: 1, borderColor: '#FECACA' },
  complaintTitle: { fontSize: 16, fontWeight: 'bold', color: '#991B1B', marginBottom: 6 },
  complaintAbout: { fontSize: 13, color: '#7F1D1D', marginBottom: 6 },
  complaintMessage: { fontSize: 14, color: '#B91C1C', fontStyle: 'italic', marginBottom: 14, lineHeight: 20 },
  resolveBtn: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  resolveBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },

  reportBtn: { backgroundColor: '#F8FAFC', padding: 18, borderRadius: 16, marginBottom: 14, marginHorizontal: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  reportBtnText: { fontSize: 15, color: '#475569', fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', backdropFilter: Platform.OS === 'web' ? 'blur(4px)' : undefined },
  modalContainer: { width: Platform.OS === 'web' ? 500 : '85%', backgroundColor: 'white', borderRadius: 32, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 40, elevation: 10 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 20, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, marginBottom: 14, fontSize: 14, color: '#1E293B', backgroundColor: '#FAFAFA' },
  textArea: { height: 120, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 20 },
  modalCancel: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#F1F5F9', borderRadius: 12 },
  modalCancelText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  modalSubmit: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#DC2626', borderRadius: 12 },
  warningSubmit: { backgroundColor: '#F59E0B' },
  modalSubmitText: { color: 'white', fontWeight: '600', fontSize: 14 },
  // Add these to your styles
cellProductImage: { width: '10%' },
cellProductName: { width: '20%' },
cellProductPrice: { width: '12%' },
cellProductUnit: { width: '10%' },
cellProductCategory: { width: '15%' },
cellProductVendor: { width: '18%' },
cellProductStatus: { width: '10%' },
cellProductAction: { width: '10%' },

productThumbnail: {
  width: 40,
  height: 40,
  borderRadius: 8,
  backgroundColor: '#F3F4F6',
},
productThumbnailPlaceholder: {
  width: 40,
  height: 40,
  borderRadius: 8,
  backgroundColor: '#F3F4F6',
  justifyContent: 'center',
  alignItems: 'center',
},
productThumbnailEmoji: {
  fontSize: 20,
},
productPriceText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#DC2626',
},
priceWarningRow: {
  backgroundColor: '#FEF3C7',
},
priceWarningText: {
  color: '#F59E0B',
},
priceWarningIcon: {
  fontSize: 12,
  marginLeft: 4,
},
viewProductBtn: {
  backgroundColor: '#3B82F6',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
},
viewProductBtnText: {
  fontSize: 11,
  color: 'white',
  fontWeight: '600',
},
filterContainer: {
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#F1F5F9',
  backgroundColor: '#FAFAFA',
},
filterLabel: {
  fontSize: 13,
  fontWeight: '600',
  color: '#64748B',
  marginBottom: 12,
},
filterScroll: {
  flexDirection: 'row',
},
filterChip: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 20,
  backgroundColor: '#F1F5F9',
  marginRight: 8,
},
filterChipActive: {
  backgroundColor: '#DC2626',
},
filterChipText: {
  fontSize: 13,
  color: '#64748B',
},
filterChipTextActive: {
  color: 'white',
},

additionalStatsRow: {
  flexDirection: 'row',
  gap: 12,
  marginBottom: 24,
  flexWrap: 'wrap',
},
additionalStatCard: {
  flex: 1,
  minWidth: Platform.OS === 'web' ? 180 : '45%',
  backgroundColor: 'white',
  borderRadius: 16,
  padding: 16,
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
  borderWidth: 1,
  borderColor: '#F1F5F9',
},
additionalStatValue: {
  fontSize: 24,
  fontWeight: 'bold',
  color: '#1E293B',
  marginBottom: 4,
},
additionalStatLabel: {
  fontSize: 12,
  color: '#64748B',
  fontWeight: '500',
},
exportSection: {
  padding: 16,
  alignItems: 'flex-end',
  borderBottomWidth: 1,
  borderBottomColor: '#F1F5F9',
},
exportButton: {
  borderRadius: 8,
  overflow: 'hidden',
},
exportGradient: {
  paddingHorizontal: 20,
  paddingVertical: 10,
  alignItems: 'center',
},
exportButtonText: {
  color: 'white',
  fontSize: 13,
  fontWeight: '600',
},
// Advanced Filter Styles
advancedFilterContainer: {
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#F1F5F9',
  backgroundColor: '#FAFAFA',
},
currentFilterRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
},
currentFilterBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FEF3F2',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 20,
  flex: 1,
  marginRight: 12,
  justifyContent: 'space-between',
},
currentFilterBadgeText: {
  fontSize: 13,
  color: '#DC2626',
  fontWeight: '500',
},
clearFilterBtn: {
  width: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: '#DC2626',
  justifyContent: 'center',
  alignItems: 'center',
},
clearFilterBtnText: {
  fontSize: 12,
  color: 'white',
  fontWeight: 'bold',
},
changeVendorBtn: {
  backgroundColor: '#F1F5F9',
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 20,
},
changeVendorBtnText: {
  fontSize: 12,
  color: '#64748B',
  fontWeight: '500',
},
vendorDropdownContainer: {
  marginTop: 12,
  backgroundColor: 'white',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  overflow: 'hidden',
},
searchInputContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#F1F5F9',
  backgroundColor: '#F8FAFC',
},
searchIcon: {
  fontSize: 14,
  marginRight: 8,
  color: '#94A3B8',
},
searchInput: {
  flex: 1,
  fontSize: 14,
  color: '#1E293B',
  padding: 0,
},
clearSearchIcon: {
  fontSize: 14,
  color: '#94A3B8',
  padding: 4,
},
quickFiltersRow: {
  flexDirection: 'row',
  padding: 12,
  gap: 8,
  borderBottomWidth: 1,
  borderBottomColor: '#F1F5F9',
},
quickFilterChip: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 16,
  backgroundColor: '#F1F5F9',
},
quickFilterChipActive: {
  backgroundColor: '#DC2626',
},
quickFilterText: {
  fontSize: 12,
  color: '#64748B',
},
quickFilterTextActive: {
  color: 'white',
},
vendorListScroll: {
  maxHeight: 300,
},
vendorItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#F1F5F9',
},
vendorItemActive: {
  backgroundColor: '#FEF3F2',
},
vendorItemLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},
vendorItemIcon: {
  fontSize: 20,
},
vendorItemName: {
  fontSize: 14,
  fontWeight: '500',
  color: '#1E293B',
},
vendorItemNameActive: {
  color: '#DC2626',
},
vendorItemSubtext: {
  fontSize: 11,
  color: '#94A3B8',
  marginTop: 2,
},
vendorItemCheck: {
  fontSize: 16,
  color: '#DC2626',
  fontWeight: 'bold',
},
noVendorsFound: {
  padding: 40,
  alignItems: 'center',
},
noVendorsFoundText: {
  fontSize: 14,
  color: '#94A3B8',
},
resultsCountRow: {
  padding: 12,
  alignItems: 'center',
  borderTopWidth: 1,
  borderTopColor: '#F1F5F9',
  backgroundColor: '#F8FAFC',
},
resultsCountText: {
  fontSize: 12,
  color: '#64748B',
},
// Category table styles
categoryCellName: { width: '40%' },
categoryCellAvgPrice: { width: '20%' },
categoryCellCount: { width: '20%' },
categoryCellUnique: { width: '20%' },

// Product average styles
productCellName: { width: '30%' },
productCellAvgPrice: { width: '15%' },
productCellMin: { width: '12%' },
productCellMax: { width: '12%' },
productCellSpread: { width: '15%' },
productCellVendors: { width: '16%' },
highSpread: { color: '#EF4444', fontWeight: 'bold' },
mediumSpread: { color: '#F59E0B' },
lowSpread: { color: '#10B981' },

// Product avg scroll
productAvgScroll: { maxHeight: 400 },
moreResultsRow: { padding: 16, alignItems: 'center', backgroundColor: '#F8FAFC' },
moreResultsText: { fontSize: 12, color: '#64748B' },

// Price distribution styles
priceDistributionContainer: { padding: 16 },
distributionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
distributionLabel: { width: 80, fontSize: 12, color: '#64748B' },
distributionBarContainer: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
distributionBar: { height: '100%', borderRadius: 4 },
distributionCount: { width: 40, fontSize: 12, color: '#1E293B', textAlign: 'right' },
distributionPercent: { width: 40, fontSize: 12, color: '#64748B', textAlign: 'right' },

// Additional column for market avg
cellProductAvgPrice: { width: '12%' },

// Category table styles
categoryCellName: { width: '40%' },
categoryCellAvgPrice: { width: '20%' },
categoryCellCount: { width: '15%' },
categoryCellUnique: { width: '15%' },
categoryCellVariations: { width: '10%' },
variationBadge: { fontSize: 10, color: '#F59E0B', marginLeft: 4, fontStyle: 'italic' },

// Product average styles
productCellName: { width: '30%' },
productCellAvgPrice: { width: '15%' },
productCellMin: { width: '12%' },
productCellMax: { width: '12%' },
productCellSpread: { width: '15%' },
productCellVendors: { width: '16%' },
highSpread: { color: '#EF4444', fontWeight: 'bold' },
mediumSpread: { color: '#F59E0B' },
lowSpread: { color: '#10B981' },
productAvgScroll: { maxHeight: 400 },
moreResultsRow: { padding: 16, alignItems: 'center', backgroundColor: '#F8FAFC' },
moreResultsText: { fontSize: 12, color: '#64748B' },

// Price distribution styles
priceDistributionContainer: { padding: 16 },
distributionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
distributionLabel: { width: 80, fontSize: 12, color: '#64748B' },
distributionBarContainer: { flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
distributionBar: { height: '100%', borderRadius: 4 },
distributionCount: { width: 40, fontSize: 12, color: '#1E293B', textAlign: 'right' },
distributionPercent: { width: 40, fontSize: 12, color: '#64748B', textAlign: 'right' },

// Additional column for market avg
cellProductAvgPrice: { width: '12%' },
// PDF Export Styles
exportSection: {
  padding: 16,
  alignItems: 'flex-end',
  borderBottomWidth: 1,
  borderBottomColor: '#F1F5F9',
},
exportPDFButton: {
  borderRadius: 10,
  overflow: 'hidden',
},
exportPDFGradient: {
  paddingHorizontal: 20,
  paddingVertical: 10,
  alignItems: 'center',
  flexDirection: 'row',
  gap: 8,
},
exportPDFButtonText: {
  color: 'white',
  fontSize: 14,
  fontWeight: '600',
},
});

// Helper functions
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

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};