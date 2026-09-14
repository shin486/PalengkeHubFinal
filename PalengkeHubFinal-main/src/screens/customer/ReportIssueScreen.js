// src/screens/customer/ReportIssueScreen.js

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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/i18nContext';

const getReportTypes = (t) => [
  { id: 'product', label: t('reports.type_product', 'Product Issue'), icon: 'cube-outline', color: '#DC2626' },
  { id: 'vendor', label: t('reports.type_vendor', 'Vendor Problem'), icon: 'person-outline', color: '#EA580C' },
  { id: 'order', label: t('reports.type_order', 'Order Issue'), icon: 'cart-outline', color: '#2563EB' },
  { id: 'payment', label: t('reports.type_payment', 'Payment Problem'), icon: 'cash-outline', color: '#16A34A' },
  { id: 'other', label: t('reports.type_other', 'Other Concerns'), icon: 'help-circle-outline', color: '#9333EA' },
];

const getReasons = (t) => ({
  product: [
    t('reports.reasons.product_wrong', 'Wrong product received'),
    t('reports.reasons.product_damaged', 'Damaged product'),
    t('reports.reasons.product_expired', 'Expired product'),
    t('reports.reasons.product_not_described', 'Product not as described'),
    t('reports.reasons.product_missing', 'Missing item'),
    t('reports.reasons.product_other', 'Other product issue'),
  ],
  vendor: [
    t('reports.reasons.vendor_unresponsive', 'Unresponsive vendor'),
    t('reports.reasons.vendor_rude', 'Rude or unprofessional behavior'),
    t('reports.reasons.vendor_pricing', 'Incorrect pricing'),
    t('reports.reasons.vendor_rules', 'Vendor not following market rules'),
    t('reports.reasons.vendor_health_safety', 'Health/safety concerns'),
    t('reports.reasons.vendor_other', 'Other vendor issue'),
  ],
  order: [
    t('reports.reasons.order_never_arrived', 'Order never arrived'),
    t('reports.reasons.order_late', 'Late delivery'),
    t('reports.reasons.order_wrong', 'Wrong order received'),
    t('reports.reasons.order_missing', 'Missing items from order'),
    t('reports.reasons.order_cancelled', 'Order cancelled incorrectly'),
    t('reports.reasons.order_other', 'Other order issue'),
  ],
  payment: [
    t('reports.reasons.payment_charge_amount', 'Incorrect charge amount'),
    t('reports.reasons.payment_not_reflected', 'Payment not reflected'),
    t('reports.reasons.payment_double_charge', 'Double charge'),
    t('reports.reasons.payment_refund_not_processed', 'Refund not processed'),
    t('reports.reasons.payment_method_issue', 'Payment method issue'),
    t('reports.reasons.payment_other', 'Other payment issue'),
  ],
  other: [
    t('reports.reasons.other_bug', 'App bug or technical issue'),
    t('reports.reasons.other_suggestion', 'Suggestion for improvement'),
    t('reports.reasons.other_complaint', 'General complaint'),
    t('reports.reasons.other_feedback', 'Compliment or feedback'),
    t('reports.reasons.other_concern', 'Other concern'),
  ],
});

export default function ReportIssueScreen({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user } = useAuth();
  const { t } = useI18n();

  const reportTypes = useMemo(() => getReportTypes(t), [t]);
  const reasons = useMemo(() => getReasons(t), [t]);

  const [selectedType, setSelectedType] = useState(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [loading, setLoading] = useState(false);
  const [customReason, setCustomReason] = useState('');

  // If coming from product/order/vendor page with pre-filled data
  useEffect(() => {
    if (route.params?.type) {
      setSelectedType(route.params.type);
    }
    if (route.params?.targetId) {
      setTargetId(String(route.params.targetId));
    }
    if (route.params?.targetName) {
      setTargetName(String(route.params.targetName));
    }
  }, [route.params]);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert(t('common.error', 'Error'), t('reports.select_type_error', 'Please select a report type'));
      return;
    }
    
    const isOther = selectedReason === t('reports.reasons.other_concern', 'Other concern') ||
                    selectedReason === t('reports.reasons.product_other', 'Other product issue') ||
                    selectedReason === t('reports.reasons.vendor_other', 'Other vendor issue') ||
                    selectedReason === t('reports.reasons.order_other', 'Other order issue') ||
                    selectedReason === t('reports.reasons.payment_other', 'Other payment issue') ||
                    selectedReason === 'Other';
    const finalReason = isOther && customReason.trim() ? customReason.trim() : selectedReason;
    if (!finalReason) {
      Alert.alert(t('common.error', 'Error'), t('reports.select_reason_error', 'Please select or enter a reason'));
      return;
    }

    if (!description.trim()) {
      Alert.alert(t('common.error', 'Error'), t('reports.provide_description_error', 'Please provide a description of the issue'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('customer_reports').insert({
        user_id: user.id,
        report_type: selectedType,
        target_id: targetId || null,
        target_name: targetName || null,
        reason: finalReason,
        description: description.trim(),
        status: 'pending',
      });

      if (error) throw error;

      if (Platform.OS === 'web') {
        const goToReports = window.confirm(t('reports.report_submitted_web_confirm', 'Report Submitted\n\nThank you for your report. Our team will review it and get back to you within 24-48 hours.\n\nOK = View My Reports, Cancel = Back to Home'));
        navigation.navigate(goToReports ? 'CustomerReports' : 'Home');
      } else {
        Alert.alert(
          t('reports.report_submitted_title', 'Report Submitted'),
          t('reports.report_submitted_msg', 'Thank you for your report. Our team will review it and get back to you within 24-48 hours.'),
          [
            {
              text: t('reports.view_my_reports', 'View My Reports'),
              onPress: () => navigation.navigate('CustomerReports'),
            },
            {
              text: t('reports.back_to_home', 'Back to Home'),
              onPress: () => navigation.navigate('Home'),
              style: 'cancel',
            },
          ]
        );
      }

      // Reset form
      setSelectedType(null);
      setSelectedReason('');
      setDescription('');
      setTargetId('');
      setTargetName('');
      setCustomReason('');
    } catch (error) {
      console.error('Error submitting report:', error);
      if (Platform.OS === 'web') {
        window.alert(t('reports.submit_failed', 'Failed to submit report. Please try again.'));
      } else {
        Alert.alert(t('common.error', 'Error'), t('reports.submit_failed', 'Failed to submit report. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Report Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('reports.what_type_of_issue', 'What type of issue is this?')}</Text>
          <View style={styles.reportTypesGrid}>
            {reportTypes.map((type) => {
              const isActive = selectedType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.reportTypeCard,
                    isActive && styles.reportTypeCardActive,
                    { borderTopColor: type.color },
                  ]}
                  onPress={() => {
                    setSelectedType(type.id);
                    setSelectedReason('');
                    setCustomReason('');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={type.icon}
                    size={28}
                    color={isActive ? COLORS.primary : type.color}
                    style={styles.reportTypeIcon}
                  />
                  <Text style={[styles.reportTypeLabel, isActive && styles.reportTypeLabelActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {selectedType && (
          <>
            {/* Target Information (Optional) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {targetId
                  ? t('reports.target_info_prefilled', 'Target Information (Pre-filled)')
                  : t('reports.target_info_optional', 'Target Information (Optional)')}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t('reports.target_id_placeholder', 'Product/Order/Vendor ID (if applicable)')}
                placeholderTextColor={COLORS.text.lighter}
                value={targetId}
                onChangeText={setTargetId}
                editable={!route.params?.targetId}
              />
              <TextInput
                style={styles.input}
                placeholder={t('reports.target_name_placeholder', 'Name of product/vendor (if applicable)')}
                placeholderTextColor={COLORS.text.lighter}
                value={targetName}
                onChangeText={setTargetName}
                editable={!route.params?.targetName}
              />
            </View>

            {/* Reason Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('reports.reason_for_report', 'Reason for report')}</Text>
              <View style={styles.reasonsList}>
                {reasons[selectedType]?.map((reason) => {
                  const isActive = selectedReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonChip,
                        isActive && styles.reasonChipActive,
                      ]}
                      onPress={() => {
                        setSelectedReason(reason);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.reasonChipText,
                          isActive && styles.reasonChipTextActive,
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Custom Reason (if Other or specific other selected) */}
            {(selectedReason.includes('Other') || selectedReason.includes('Iba pang')) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('reports.please_specify', 'Please specify')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('reports.enter_reason_placeholder', 'Enter your reason here...')}
                  placeholderTextColor={COLORS.text.lighter}
                  value={customReason}
                  onChangeText={setCustomReason}
                />
              </View>
            )}

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('reports.detailed_description', 'Detailed Description')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('reports.description_placeholder', 'Please provide as much detail as possible about the issue...')}
                placeholderTextColor={COLORS.text.lighter}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                {t('reports.description_helper', 'Include relevant dates, times, and any supporting information')}
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>{t('reports.submit_report', 'Submit Report')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Info Note */}
            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={22} color={COLORS.warning} style={styles.infoIcon} />
              <Text style={styles.infoText}>
                {t('reports.confidential_note', 'All reports are confidential and will be reviewed by our admin team. We take all reports seriously and will investigate thoroughly.')}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  section: {
    backgroundColor: COLORS.surface,
    marginTop: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  reportTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  reportTypeCard: {
    width: '48%',
    backgroundColor: COLORS.surfaceSecondary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderTopWidth: 3,
    borderTopColor: COLORS.border,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  reportTypeCardActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.primary,
  },
  reportTypeIcon: {
    marginBottom: 8,
  },
  reportTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  reportTypeLabelActive: {
    color: COLORS.primary,
  },
  input: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text.primary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  reasonsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reasonChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  reasonChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  reasonChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  submitButton: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: COLORS.warningLight,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 14,
    borderRadius: 12,
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.warning + '40',
  },
  infoIcon: {
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.primary,
    lineHeight: 18,
  },
});