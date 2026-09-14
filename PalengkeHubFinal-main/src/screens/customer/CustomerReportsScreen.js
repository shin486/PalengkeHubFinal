// src/screens/customer/CustomerReportsScreen.js

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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/i18nContext';

export default function CustomerReportsScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user } = useAuth();
  const { t } = useI18n();

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
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('customer_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const reportList = data || [];
      setReports(reportList);
      
      setStats({
        total: reportList.length,
        pending: reportList.filter(r => r.status === 'pending').length,
        resolved: reportList.filter(r => r.status === 'resolved').length,
        reviewing: reportList.filter(r => r.status === 'reviewing').length,
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
      case 'reviewing': return '#2563EB';
      case 'resolved': return COLORS.success;
      case 'dismissed': return COLORS.text.tertiary;
      default: return COLORS.text.tertiary;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return `⏳ ${t('reports.status_pending_review', 'Pending Review')}`;
      case 'reviewing': return `🔍 ${t('reports.status_under_review', 'Under Review')}`;
      case 'resolved': return `✓ ${t('reports.status_resolved', 'Resolved')}`;
      case 'dismissed': return `✕ ${t('reports.status_dismissed', 'Dismissed')}`;
      default: return status;
    }
  };

  const getReportTypeLabel = (type) => {
    switch (type) {
      case 'product': return t('reports.type_product', 'Product Issue');
      case 'vendor': return t('reports.type_vendor', 'Vendor Problem');
      case 'order': return t('reports.type_order', 'Order Issue');
      case 'payment': return t('reports.type_payment', 'Payment Problem');
      case 'other': return t('reports.type_other', 'Other Concerns');
      default: return `${type ? type.charAt(0).toUpperCase() + type.slice(1) : ''} ${t('reports.issue_suffix', 'Issue')}`;
    }
  };

  const getReportTypeIcon = (type) => {
    switch (type) {
      case 'product': return 'cube-outline';
      case 'vendor': return 'person-outline';
      case 'order': return 'cart-outline';
      case 'payment': return 'cash-outline';
      default: return 'help-circle-outline';
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffTime = Math.abs(now - d);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return t('reports.today', 'Today');
    if (diffDays === 1) return t('reports.yesterday', 'Yesterday');
    if (diffDays < 7) return t('reports.days_ago', '%{count} days ago', { count: diffDays });
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
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
      }
    >
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.statsCard}
        >
          <Text style={styles.statsNumber}>{stats.total}</Text>
          <Text style={styles.statsLabel}>{t('reports.total_reports', 'Total Reports')}</Text>
        </LinearGradient>
        
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: COLORS.warningLight }]}>
            <Text style={[styles.statNumber, { color: COLORS.warning }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>{t('reports.pending', 'Pending')}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.gcashLight }]}>
            <Text style={[styles.statNumber, { color: '#2563EB' }]}>{stats.reviewing}</Text>
            <Text style={styles.statLabel}>{t('reports.reviewing', 'Reviewing')}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.successLight }]}>
            <Text style={[styles.statNumber, { color: COLORS.success }]}>{stats.resolved}</Text>
            <Text style={styles.statLabel}>{t('reports.resolved', 'Resolved')}</Text>
          </View>
        </View>
      </View>

      {/* New Report Button */}
      <TouchableOpacity
        style={styles.newReportButton}
        onPress={() => navigation.navigate('ReportIssue')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.newReportGradient}
        >
          <Ionicons name="flag" size={18} color="#FFFFFF" />
          <Text style={styles.newReportText}>{t('reports.report_new_issue', 'Report New Issue')}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Reports List */}
      <View style={styles.reportsSection}>
        <Text style={styles.sectionTitle}>{t('reports.your_reports', 'Your Reports')}</Text>
        
        {reports.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="mail-open-outline" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('reports.no_reports_yet', 'No Reports Yet')}</Text>
            <Text style={styles.emptyText}>
              {t('reports.no_reports_desc', "You haven't submitted any reports. If you encounter any issues, tap the button above to report them.")}
            </Text>
          </View>
        ) : (
          reports.map((report) => {
            const statusColor = getStatusColor(report.status);
            return (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={styles.reportType}>
                    <Ionicons
                      name={getReportTypeIcon(report.report_type)}
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.reportTypeText}>
                      {getReportTypeLabel(report.report_type)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {getStatusText(report.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.reportContent}>
                  <Text style={styles.reportReason}>
                    {t('reports.reason_prefix', 'Reason: ')}{report.reason}
                  </Text>
                  {report.target_name ? (
                    <Text style={styles.reportTarget}>
                      {t('reports.target_prefix', 'Target: ')}{report.target_name}
                    </Text>
                  ) : null}
                  <Text style={styles.reportDescription} numberOfLines={3}>
                    {report.description}
                  </Text>
                  {report.admin_notes ? (
                    <View style={styles.adminNote}>
                      <Text style={styles.adminNoteLabel}>{t('reports.admin_response', 'Admin Response:')}</Text>
                      <Text style={styles.adminNoteText}>{report.admin_notes}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.reportFooter}>
                  <Text style={styles.reportDate}>
                    {t('reports.submitted_prefix', 'Submitted ')}{formatDate(report.created_at)}
                  </Text>
                  {report.status === 'resolved' && (
                    <TouchableOpacity activeOpacity={0.7}>
                      <Text style={styles.feedbackLink}>{t('reports.provide_feedback', 'Provide Feedback')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.infoHeader}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
          <Text style={styles.infoTitle}>{t('reports.how_we_handle_title', 'How We Handle Reports')}</Text>
        </View>
        <Text style={styles.infoText}>
          {t('reports.how_we_handle_desc', '1. Your report is submitted to our admin team\n2. We review the issue within 24-48 hours\n3. We may contact you for additional information\n4. Once resolved, you\'ll receive a notification\n5. Your report helps us improve the platform for everyone')}
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
  scrollContent: {
    paddingBottom: 36,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  statsContainer: {
    padding: 16,
    gap: 12,
  },
  statsCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  statsNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  newReportButton: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  newReportGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  newReportText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  reportsSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 14,
  },
  emptyState: {
    backgroundColor: COLORS.surface,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  reportCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
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
    gap: 8,
    flex: 1,
  },
  reportTypeText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reportContent: {
    marginBottom: 12,
  },
  reportReason: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  reportTarget: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginBottom: 6,
  },
  reportDescription: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  adminNote: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  adminNoteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  adminNoteText: {
    fontSize: 13,
    color: COLORS.text.primary,
    lineHeight: 18,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  reportDate: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  feedbackLink: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: COLORS.accentSoft,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
});