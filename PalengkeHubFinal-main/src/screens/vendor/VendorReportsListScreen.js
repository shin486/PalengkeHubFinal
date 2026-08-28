import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { Header } from '../../components/Header';

export default function VendorReportsListScreen({ navigation }) {
  const { user } = useAuth();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    reviewing: 0,
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_reports')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);

      // Calculate stats
      setStats({
        total: data?.length || 0,
        pending: data?.filter(r => r.status === 'pending').length || 0,
        resolved: data?.filter(r => r.status === 'resolved').length || 0,
        reviewing: data?.filter(r => r.status === 'reviewing').length || 0,
      });
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'reviewing': return COLORS.info;
      case 'resolved': return COLORS.success;
      case 'dismissed': return COLORS.text.tertiary;
      default: return COLORS.text.tertiary;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'reviewing': return 'Under Review';
      case 'resolved': return 'Resolved';
      case 'dismissed': return 'Dismissed';
      default: return status;
    }
  };

  const getReportIcon = (type) => {
    switch (type) {
      case 'customer_behavior': return 'person';
      case 'order_issue': return 'clipboard';
      case 'payment_issue': return 'cash';
      case 'fraud': return 'warning';
      default: return 'create';
    }
  };

  const getReportLabel = (type) => {
    switch (type) {
      case 'customer_behavior': return 'Customer Behavior';
      case 'order_issue': return 'Order Issue';
      case 'payment_issue': return 'Payment Problem';
      case 'fraud': return 'Suspicious Activity';
      default: return 'Other';
    }
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now - d);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.background} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={COLORS.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.background} />

      <Header
        title="Customer Reports"
        subtitle="Track your reported issues"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: COLORS.warningLight }]}>
            <Text style={[styles.statNumber, { color: COLORS.warning }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: COLORS.infoLight }]}>
            <Text style={[styles.statNumber, { color: COLORS.info }]}>{stats.reviewing}</Text>
            <Text style={styles.statLabel}>Reviewing</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: COLORS.successLight }]}>
            <Text style={[styles.statNumber, { color: COLORS.success }]}>{stats.resolved}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {/* New Report Button */}
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => navigation.navigate('VendorReportIssue')}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.newButtonGradient}
          >
            <Ionicons name="flag" size={16} color={COLORS.text.inverse} style={styles.newButtonIcon} />
            <Text style={styles.newButtonText}>Report New Issue</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Reports List */}
        <View style={styles.reportsSection}>
          <Text style={styles.sectionTitle}>All Reports</Text>

          {reports.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-open-outline" size={48} color={COLORS.text.quaternary} />
              <Text style={styles.emptyTitle}>No Reports Yet</Text>
              <Text style={styles.emptyText}>
                You haven't submitted any customer reports. Tap the button above to report an issue.
              </Text>
            </View>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.reportTypeContainer}>
                    <Text style={styles.reportIcon}>{getReportIcon(report.report_type)}</Text>
                    <Text style={styles.reportType}>
                      {getReportLabel(report.report_type)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                      {getStatusText(report.status)}
                    </Text>
                  </View>
                </View>

                {report.customer_name && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer:</Text>
                    <Text style={styles.detailValue}>{report.customer_name}</Text>
                  </View>
                )}

                {report.order_id && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Order ID:</Text>
                    <Text style={styles.detailValue}>{report.order_id}</Text>
                  </View>
                )}

                <Text style={styles.reportDescription}>{report.description}</Text>

                <View style={styles.reportFooter}>
                  <Text style={styles.reportDate}>
                    Submitted {formatDate(report.created_at)}
                  </Text>
                </View>

                {report.admin_notes && (
                  <View style={styles.adminNote}>
                    <Text style={styles.adminNoteLabel}>Admin Response:</Text>
                    <Text style={styles.adminNoteText}>{report.admin_notes}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Customer Reports</Text>
          <Text style={styles.infoText}>
            • Reports are confidential and only visible to admin{'\n'}
            • Our team reviews each report within 24-48 hours{'\n'}
            • False reports may result in account action{'\n'}
            • You'll be notified when your report is resolved
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.text.tertiary,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: COLORS.surface,
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
    color: COLORS.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    marginTop: 4,
  },
  newButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  newButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  newButtonIcon: {
    fontSize: 18,
    color: COLORS.text.inverse,
  },
  newButtonText: {
    color: COLORS.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  reportsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: COLORS.surface,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  reportCard: {
    backgroundColor: COLORS.surface,
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
    flexWrap: 'wrap',
    gap: 8,
  },
  reportTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  reportIcon: {
    fontSize: 14,
  },
  reportType: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
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
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text.tertiary,
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  reportDescription: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  reportDate: {
    fontSize: 11,
    color: COLORS.text.quaternary,
  },
  adminNote: {
    marginTop: 8,
    padding: 12,
    backgroundColor: COLORS.successLight,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  adminNoteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: 4,
  },
  adminNoteText: {
    fontSize: 13,
    color: COLORS.success,
    lineHeight: 18,
  },
  infoSection: {
    backgroundColor: COLORS.warningLight,
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.warning,
    lineHeight: 18,
  },
});
