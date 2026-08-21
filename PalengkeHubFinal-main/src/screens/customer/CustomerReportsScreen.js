import { useColors } from '../../contexts/ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function CustomerReportsScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user } = useAuth();
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
        .from('customer_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReports(data || []);
      
      // Calculate stats
      const stats = {
        total: data?.length || 0,
        pending: data?.filter(r => r.status === 'pending').length || 0,
        resolved: data?.filter(r => r.status === 'resolved').length || 0,
        reviewing: data?.filter(r => r.status === 'reviewing').length || 0,
      };
      setStats(stats);
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
      case 'reviewing': return '#3B82F6';
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

  const getReportTypeIcon = (type) => {
    switch (type) {
      case 'product': return 'cube-outline';
      case 'vendor': return 'storefront-outline';
      case 'order': return 'receipt-outline';
      case 'payment': return 'card-outline';
      default: return 'document-text-outline';
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statsCard}
        >
          <Text style={styles.statsNumber}>{stats.total}</Text>
          <Text style={styles.statsLabel}>Total Reports</Text>
        </LinearGradient>
        
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: COLORS.warningLight }]}>
            <Text style={[styles.statNumber, { color: COLORS.warning }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.gcashLight }]}>
            <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{stats.reviewing}</Text>
            <Text style={styles.statLabel}>Reviewing</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.successLight }]}>
            <Text style={[styles.statNumber, { color: COLORS.success }]}>{stats.resolved}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>
      </View>

      {/* New Report Button */}
      <TouchableOpacity
        style={styles.newReportButton}
        onPress={() => navigation.navigate('ReportIssue')}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.newReportGradient}
        >
          <Ionicons name="flag-outline" size={20} color="#FFFFFF" />
          <Text style={styles.newReportText}>Report New Issue</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Reports List */}
      <View style={styles.reportsSection}>
        <Text style={styles.sectionTitle}>Your Reports</Text>
        
        {reports.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-open-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Reports Yet</Text>
            <Text style={styles.emptyText}>
              You haven't submitted any reports. If you encounter any issues, tap the button above to report them.
            </Text>
          </View>
        ) : (
          reports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <View style={styles.reportType}>
                  <Ionicons name={getReportTypeIcon(report.report_type)} size={20} color={COLORS.primary} />
                  <Text style={styles.reportTypeText}>
                    {report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} Issue
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                    {getStatusText(report.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.reportContent}>
                <Text style={styles.reportReason}>Reason: {report.reason}</Text>
                {report.target_name && (
                  <Text style={styles.reportTarget}>Target: {report.target_name}</Text>
                )}
                <Text style={styles.reportDescription} numberOfLines={2}>
                  {report.description}
                </Text>
                {report.admin_notes && (
                  <View style={styles.adminNote}>
                    <Text style={styles.adminNoteLabel}>Admin Response:</Text>
                    <Text style={styles.adminNoteText}>{report.admin_notes}</Text>
                  </View>
                )}
              </View>

              <View style={styles.reportFooter}>
                <Text style={styles.reportDate}>Submitted {formatDate(report.created_at)}</Text>
                {report.status === 'resolved' && (
                  <TouchableOpacity>
                    <Text style={styles.feedbackLink}>Provide Feedback</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How We Handle Reports</Text>
        <Text style={styles.infoText}>
          1. Your report is submitted to our admin team {'\n'}
          2. We review the issue within 24-48 hours {'\n'}
          3. We may contact you for additional information {'\n'}
          4. Once resolved, you'll receive a notification {'\n'}
          5. Your report helps us improve the platform for everyone
        </Text>
      </View>
    </ScrollView>
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
  },
  statsContainer: {
    padding: 16,
    gap: 12,
  },
  statsCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.text.inverse,
  },
  statsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  newReportButton: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  newReportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  newReportIcon: {
    fontSize: 20,
  },
  newReportText: {
    color: COLORS.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  reportsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: COLORS.card,
    padding: 32,
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
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.shadowDark,
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
  reportType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportTypeIcon: {
    fontSize: 16,
  },
  reportTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportContent: {
    marginBottom: 12,
  },
  reportReason: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.secondary,
    marginBottom: 6,
  },
  reportTarget: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    marginBottom: 6,
  },
  reportDescription: {
    fontSize: 14,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  adminNote: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 8,
  },
  adminNoteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  adminNoteText: {
    fontSize: 13,
    color: COLORS.text.primary,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reportDate: {
    fontSize: 12,
    color: COLORS.text.quaternary,
  },
  feedbackLink: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: COLORS.warningLight,
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.warning,
    lineHeight: 20,
  },
});