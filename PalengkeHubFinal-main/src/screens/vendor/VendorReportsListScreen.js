// src/screens/vendor/VendorReportsListScreen.js
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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContext';
import {
  useVendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
} from '../../theme/vendorTheme';
import { Header } from '../../components/Header';

export default function VendorReportsListScreen({ navigation }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const vendorColors = useVendorColors();
  const styles = useMemo(() => createStyles(vendorColors), [vendorColors]);

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

  const getStatusBg = (status) => {
    switch (status) {
      case 'pending': return vendorColors.warningLight || '#33270D';
      case 'reviewing': return vendorColors.infoLight || '#152833';
      case 'resolved': return vendorColors.successLight || '#28331A';
      case 'dismissed': return vendorColors.isDark ? '#2E211A' : '#F3F4F6';
      default: return vendorColors.isDark ? '#2E211A' : '#F3F4F6';
    }
  };

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'pending': return vendorColors.warning || '#F59E0B';
      case 'reviewing': return vendorColors.info || '#3B82F6';
      case 'resolved': return vendorColors.success || '#10B981';
      case 'dismissed': return vendorColors.isDark ? '#C8B6A6' : '#6B7280';
      default: return vendorColors.isDark ? '#C8B6A6' : '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return t('vendor_reports_list.status_pending', 'Pending Review');
      case 'reviewing': return t('vendor_reports_list.status_reviewing', 'Under Review');
      case 'resolved': return t('vendor_reports_list.status_resolved', 'Resolved');
      case 'dismissed': return t('vendor_reports_list.status_dismissed', 'Dismissed');
      default: return status;
    }
  };

  const getReportIconName = (type) => {
    switch (type) {
      case 'customer_behavior': return 'person-outline';
      case 'order_issue': return 'receipt-outline';
      case 'payment_issue': return 'card-outline';
      case 'fraud': return 'alert-circle-outline';
      default: return 'create-outline';
    }
  };

  const getReportLabel = (type) => {
    switch (type) {
      case 'customer_behavior': return t('vendor_report_issue.type_customer_behavior', 'Customer Behavior');
      case 'order_issue': return t('vendor_report_issue.type_order_issue', 'Order Issue');
      case 'payment_issue': return t('vendor_report_issue.type_payment_issue', 'Payment Problem');
      case 'fraud': return t('vendor_report_issue.type_fraud', 'Suspicious Activity');
      default: return t('vendor_report_issue.type_other', 'Other');
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    try {
      const d = new Date(date);
      const now = new Date();
      const diffTime = Math.abs(now - d);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return t('vendor_reports_list.date_today', 'Today');
      if (diffDays === 1) return t('vendor_reports_list.date_yesterday', 'Yesterday');
      if (diffDays < 7) return t('vendor_reports_list.days_ago', '%{count} days ago', { count: diffDays });
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle={vendorColors.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={vendorColors.background} />
        <ActivityIndicator size="large" color={vendorColors.primary} />
        <Text style={[styles.loadingText, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
          {t('vendor_reports_list.loading_reports', 'Loading reports...')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={vendorColors.statusBar === 'dark' ? 'dark-content' : 'light-content'} backgroundColor={vendorColors.background} />

      <Header
        title={t('vendor_reports_list.title', 'Customer Reports')}
        subtitle={t('vendor_reports_list.subtitle', 'Track your reported issues')}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[vendorColors.primary]}
            tintColor={vendorColors.primary}
          />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
              {stats.total}
            </Text>
            <Text style={[styles.statLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
              {t('vendor_reports_list.total_reports', 'Total Reports')}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: vendorColors.isDark ? '#2B2110' : '#FEF3C7', borderColor: vendorColors.warning }]}>
            <Text style={[styles.statNumber, { color: vendorColors.warning }]}>
              {stats.pending}
            </Text>
            <Text style={[styles.statLabel, { color: vendorColors.isDark ? '#FDE68A' : '#92400E' }]}>
              {t('vendor_reports_list.pending', 'Pending')}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: vendorColors.isDark ? '#152433' : '#E0F2FE', borderColor: vendorColors.info }]}>
            <Text style={[styles.statNumber, { color: vendorColors.info }]}>
              {stats.reviewing}
            </Text>
            <Text style={[styles.statLabel, { color: vendorColors.isDark ? '#BAE6FD' : '#075985' }]}>
              {t('vendor_reports_list.reviewing', 'Reviewing')}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: vendorColors.isDark ? '#1B2C1A' : '#DCFCE7', borderColor: vendorColors.success }]}>
            <Text style={[styles.statNumber, { color: vendorColors.success }]}>
              {stats.resolved}
            </Text>
            <Text style={[styles.statLabel, { color: vendorColors.isDark ? '#BBF7D0' : '#166534' }]}>
              {t('vendor_reports_list.resolved', 'Resolved')}
            </Text>
          </View>
        </View>

        {/* New Report Button */}
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => navigation.navigate('VendorReportIssue')}
          activeOpacity={0.8}
        >
          <View style={[styles.newButtonContent, { backgroundColor: vendorColors.primary }]}>
            <Ionicons name="flag-outline" size={18} color="#FFFFFF" />
            <Text style={styles.newButtonText}>
              {t('vendor_reports_list.report_new_issue', 'Report New Issue')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Reports List */}
        <View style={styles.reportsSection}>
          <Text style={[styles.sectionTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
            {t('vendor_reports_list.all_reports', 'All Reports')}
          </Text>

          {reports.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-open-outline" size={48} color={vendorColors.isDark ? '#8A7263' : '#C8B6A6'} />
              <Text style={[styles.emptyTitle, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                {t('vendor_reports_list.no_reports_title', 'No Reports Yet')}
              </Text>
              <Text style={[styles.emptyText, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                {t('vendor_reports_list.no_reports_desc', "You haven't submitted any customer reports. Tap the button above to report an issue.")}
              </Text>
            </View>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <View style={[styles.reportTypeContainer, { backgroundColor: vendorColors.accentSoft }]}>
                    <Ionicons
                      name={getReportIconName(report.report_type)}
                      size={16}
                      color={vendorColors.primary}
                    />
                    <Text style={[styles.reportType, { color: vendorColors.isDark ? '#F5B078' : vendorColors.primary }]}>
                      {getReportLabel(report.report_type)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBg(report.status) }]}>
                    <Text style={[styles.statusText, { color: getStatusTextColor(report.status) }]}>
                      {getStatusText(report.status)}
                    </Text>
                  </View>
                </View>

                {report.customer_name && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                      {t('vendor_reports_list.customer_label', 'Customer:')}
                    </Text>
                    <Text style={[styles.detailValue, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                      {report.customer_name}
                    </Text>
                  </View>
                )}

                {report.order_id && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
                      {t('vendor_reports_list.order_id_label', 'Order ID:')}
                    </Text>
                    <Text style={[styles.detailValue, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                      {report.order_id}
                    </Text>
                  </View>
                )}

                <View style={[styles.descriptionBox, { backgroundColor: vendorColors.surfaceAlt }]}>
                  <Text style={[styles.reportDescription, { color: vendorColors.isDark ? '#F7EDE1' : '#261006' }]}>
                    {report.description}
                  </Text>
                </View>

                <View style={styles.reportFooter}>
                  <Text style={[styles.reportDate, { color: vendorColors.isDark ? '#C8B6A6' : '#7C6758' }]}>
                    {t('vendor_reports_list.submitted_date', 'Submitted %{date}', {
                      date: formatDate(report.created_at),
                    })}
                  </Text>
                </View>

                {report.admin_notes && (
                  <View style={[styles.adminNote, { backgroundColor: vendorColors.accentSoft, borderLeftColor: vendorColors.primary }]}>
                    <Text style={[styles.adminNoteLabel, { color: vendorColors.primary }]}>
                      {t('vendor_reports_list.admin_response_label', 'Admin Response:')}
                    </Text>
                    <Text style={[styles.adminNoteText, { color: vendorColors.isDark ? '#FFFFFF' : '#261006' }]}>
                      {report.admin_notes}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Info Section */}
        <View
          style={[
            styles.infoSection,
            {
              backgroundColor: vendorColors.isDark ? '#261A10' : '#FFF8F0',
              borderColor: vendorColors.isDark ? '#4A3420' : '#FDE68A',
            },
          ]}
        >
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={20} color={vendorColors.primary} />
            <Text style={[styles.infoTitle, { color: vendorColors.isDark ? '#F5B078' : vendorColors.primary }]}>
              {t('vendor_reports_list.about_title', 'About Customer Reports')}
            </Text>
          </View>
          <Text style={[styles.infoText, { color: vendorColors.isDark ? '#E2D3C4' : '#5B4436' }]}>
            • {t('vendor_reports_list.about_bullet_1', 'Reports are confidential and only visible to admin')}{'\n'}
            • {t('vendor_reports_list.about_bullet_2', 'Our team reviews each report within 24-48 hours')}{'\n'}
            • {t('vendor_reports_list.about_bullet_3', 'False reports may result in account action')}{'\n'}
            • {t('vendor_reports_list.about_bullet_4', "You'll be notified when your report is resolved")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (vendorColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: vendorColors.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: vendorColors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: vendorSpacing.xxl,
    },
    statsContainer: {
      flexDirection: 'row',
      paddingHorizontal: vendorSpacing.lg,
      paddingVertical: vendorSpacing.md,
      gap: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: vendorColors.surface,
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderRadius: vendorBorderRadius.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: vendorColors.border,
      ...vendorShadows.sm,
    },
    statNumber: {
      fontSize: 22,
      fontWeight: '800',
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 4,
      textAlign: 'center',
    },
    newButton: {
      marginHorizontal: vendorSpacing.lg,
      marginBottom: vendorSpacing.md,
      borderRadius: vendorBorderRadius.full,
      overflow: 'hidden',
      ...vendorShadows.md,
    },
    newButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 8,
    },
    newButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    reportsSection: {
      paddingHorizontal: vendorSpacing.lg,
      marginBottom: vendorSpacing.md,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12,
    },
    emptyState: {
      backgroundColor: vendorColors.surface,
      padding: 36,
      borderRadius: vendorBorderRadius.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: vendorColors.border,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
    reportCard: {
      backgroundColor: vendorColors.surface,
      borderRadius: vendorBorderRadius.xl,
      padding: vendorSpacing.lg,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: vendorColors.border,
      ...vendorShadows.sm,
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
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: vendorBorderRadius.full,
    },
    reportType: {
      fontSize: 12,
      fontWeight: '700',
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: vendorBorderRadius.full,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    detailLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    detailValue: {
      fontSize: 13,
      fontWeight: '700',
    },
    descriptionBox: {
      padding: 12,
      borderRadius: vendorBorderRadius.md,
      marginVertical: 8,
    },
    reportDescription: {
      fontSize: 14,
      lineHeight: 20,
    },
    reportFooter: {
      marginTop: 4,
    },
    reportDate: {
      fontSize: 12,
      fontWeight: '500',
    },
    adminNote: {
      marginTop: 12,
      padding: 12,
      borderRadius: vendorBorderRadius.md,
      borderLeftWidth: 3,
    },
    adminNoteLabel: {
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 4,
    },
    adminNoteText: {
      fontSize: 13,
      lineHeight: 18,
    },
    infoSection: {
      marginHorizontal: vendorSpacing.lg,
      marginBottom: vendorSpacing.xl,
      padding: vendorSpacing.lg,
      borderRadius: vendorBorderRadius.xl,
      borderWidth: 1,
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
    },
    infoText: {
      fontSize: 13,
      lineHeight: 22,
    },
  });
