import React, { useState } from 'react';
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
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const reportTypes = [
  { id: 'product', label: '🚫 Product Issue', icon: '📦', color: '#EF4444' },
  { id: 'vendor', label: '🏪 Vendor Problem', icon: '👤', color: '#F59E0B' },
  { id: 'order', label: '📋 Order Issue', icon: '🛒', color: '#3B82F6' },
  { id: 'payment', label: '💳 Payment Problem', icon: '💰', color: '#10B981' },
  { id: 'other', label: 'Other Concerns', icon: '📝', color: '#8B5CF6' },
];

const reasons = {
  product: [
    'Wrong product received',
    'Damaged product',
    'Expired product',
    'Product not as described',
    'Missing item',
    'Other product issue',
  ],
  vendor: [
    'Unresponsive vendor',
    'Rude or unprofessional behavior',
    'Incorrect pricing',
    'Vendor not following market rules',
    'Health/safety concerns',
    'Other vendor issue',
  ],
  order: [
    'Order never arrived',
    'Late delivery',
    'Wrong order received',
    'Missing items from order',
    'Order cancelled incorrectly',
    'Other order issue',
  ],
  payment: [
    'Incorrect charge amount',
    'Payment not reflected',
    'Double charge',
    'Refund not processed',
    'Payment method issue',
    'Other payment issue',
  ],
  other: [
    'App bug or technical issue',
    'Suggestion for improvement',
    'General complaint',
    'Compliment or feedback',
    'Other concern',
  ],
};

export default function ReportIssueScreen({ navigation, route }) {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [targetId, setTargetId] = useState('');
  const [targetName, setTargetName] = useState('');
  const [loading, setLoading] = useState(false);
  const [customReason, setCustomReason] = useState('');

  // If coming from product/order/vendor page with pre-filled data
  React.useEffect(() => {
    if (route.params?.type) {
      setSelectedType(route.params.type);
    }
    if (route.params?.targetId) {
      setTargetId(route.params.targetId);
    }
    if (route.params?.targetName) {
      setTargetName(route.params.targetName);
    }
  }, [route.params]);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a report type');
      return;
    }
    
    const finalReason = selectedReason === 'Other' ? customReason : selectedReason;
    if (!finalReason) {
      Alert.alert('Error', 'Please select or enter a reason');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please provide a description of the issue');
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

      Alert.alert(
        '✅ Report Submitted',
        'Thank you for your report. Our team will review it and get back to you within 24-48 hours.',
        [
          {
            text: 'View My Reports',
            onPress: () => navigation.navigate('CustomerReports'),
          },
          {
            text: 'Back to Home',
            onPress: () => navigation.navigate('Home'),
            style: 'cancel',
          },
        ]
      );
      
      // Reset form
      setSelectedType(null);
      setSelectedReason('');
      setDescription('');
      setTargetId('');
      setTargetName('');
      setCustomReason('');
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
       
         
     

        {/* Report Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What type of issue is this?</Text>
          <View style={styles.reportTypesGrid}>
            {reportTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.reportTypeCard,
                  selectedType === type.id && styles.reportTypeCardActive,
                  { borderTopColor: type.color }
                ]}
                onPress={() => {
                  setSelectedType(type.id);
                  setSelectedReason('');
                  setCustomReason('');
                }}
              >
                <Text style={styles.reportTypeIcon}>{type.icon}</Text>
                <Text style={styles.reportTypeLabel}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedType && (
          <>
            {/* Target Information (Optional) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Target Information {targetId ? '(Pre-filled)' : '(Optional)'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Product/Order/Vendor ID (if applicable)"
                value={targetId}
                onChangeText={setTargetId}
                editable={!route.params?.targetId}
              />
              <TextInput
                style={styles.input}
                placeholder="Name of product/vendor (if applicable)"
                value={targetName}
                onChangeText={setTargetName}
                editable={!route.params?.targetName}
              />
            </View>

            {/* Reason Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reason for report</Text>
              <View style={styles.reasonsList}>
                {reasons[selectedType].map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonChip,
                      selectedReason === reason && styles.reasonChipActive,
                    ]}
                    onPress={() => {
                      setSelectedReason(reason);
                      if (reason !== 'Other') setCustomReason('');
                    }}
                  >
                    <Text
                      style={[
                        styles.reasonChipText,
                        selectedReason === reason && styles.reasonChipTextActive,
                      ]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Reason (if Other selected) */}
            {selectedReason === 'Other' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Please specify</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your reason here..."
                  value={customReason}
                  onChangeText={setCustomReason}
                />
              </View>
            )}

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detailed Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Please provide as much detail as possible about the issue..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.helperText}>
                Include relevant dates, times, and any supporting information
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Info Note */}
            <View style={styles.infoNote}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>
                All reports are confidential and will be reviewed by our admin team.
                We take all reports seriously and will investigate thoroughly.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 16,
    marginHorizontal: 16,
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
    color: '#111827',
    marginBottom: 12,
  },
  reportTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reportTypeCard: {
    width: '30%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderTopWidth: 3,
    borderTopColor: '#E5E7EB',
  },
  reportTypeCardActive: {
    backgroundColor: '#FEF2F2',
    borderTopColor: '#EF4444',
  },
  reportTypeIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  reportTypeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  reasonsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  reasonChipActive: {
    backgroundColor: '#EF4444',
  },
  reasonChipText: {
    fontSize: 13,
    color: '#4B5563',
  },
  reasonChipTextActive: {
    color: 'white',
  },
  submitButton: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
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
    color: '#92400E',
    lineHeight: 18,
  },
});