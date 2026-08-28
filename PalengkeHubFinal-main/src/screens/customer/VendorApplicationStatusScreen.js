// src/screens/customer/VendorApplicationStatusScreen.js
// Lets a pending vendor applicant see their application status and, when the
// admin has asked for it, re-upload their Valid ID / Business Permit right
// from the app. Reached via a notification tap or the Profile screen's
// "Vendor Application" card.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Header } from '../../components/Header';
import { useColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { uploadVendorDocument } from '../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';

const PH_DATE = (d) => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export default function VendorApplicationStatusScreen({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user } = useAuth();
  const applicationId = route?.params?.applicationId;

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [validId, setValidId] = useState(null);
  const [validIdName, setValidIdName] = useState('');
  const [businessPermit, setBusinessPermit] = useState(null);
  const [businessPermitName, setBusinessPermitName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase.from('vendor_applications').select('*');
      query = applicationId ? query.eq('id', applicationId) : query.eq('applicant_id', user.id).order('application_date', { ascending: false }).limit(1);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      setApplication(data || null);
    } catch (error) {
      console.error('Error loading vendor application:', error);
    } finally {
      setLoading(false);
    }
  }, [user, applicationId]);

  useEffect(() => { load(); }, [load]);

  const pickImage = async (setFile, setFileName) => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Photo Access Needed', 'Please allow photo access to upload your document.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        const file = { uri: asset.uri, name: `valid_id_${Date.now()}.jpg`, type: 'image/jpeg' };
        setFile(file);
        setFileName(file.name);
      }
    } catch (error) {
      console.error('Image pick error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const pickDocument = async (setFile, setFileName) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (result.canceled === false) {
        const file = result.assets[0];
        setFile(file);
        setFileName(file.name);
      }
    } catch (error) {
      console.error('Document pick error:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const submitResubmission = async () => {
    if (!validId || !businessPermit) {
      Alert.alert('Missing documents', 'Please upload both your Valid ID and Business Permit.');
      return;
    }
    setSubmitting(true);
    try {
      const [validIdUrl, businessPermitUrl] = await Promise.all([
        uploadVendorDocument(validId, `valid_ids/${user.id}`),
        uploadVendorDocument(businessPermit, `business_permits/${user.id}`),
      ]);
      if (!validIdUrl || !businessPermitUrl) {
        Alert.alert('Upload failed', 'One of your documents could not be uploaded. Please try again.');
        return;
      }
      const documents = [
        { type: 'valid_id', url: validIdUrl },
        { type: 'business_permit', url: businessPermitUrl },
      ];
      const { error } = await supabase.from('vendor_applications').update({
        documents,
        resubmission_status: 'resubmitted',
        resubmitted_at: new Date().toISOString(),
      }).eq('id', application.id);
      if (error) throw error;
      setApplication(prev => ({ ...prev, documents, resubmission_status: 'resubmitted', resubmitted_at: new Date().toISOString() }));
      Alert.alert('Submitted', 'Your updated documents were sent for review.');
    } catch (error) {
      console.error('Resubmission error:', error);
      Alert.alert('Error', 'Could not submit your documents. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Vendor Application" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.centerContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </View>
    );
  }

  if (!application) {
    return (
      <View style={styles.container}>
        <Header title="Vendor Application" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={48} color={COLORS.text.lighter} />
          <Text style={styles.emptyText}>No vendor application found for your account.</Text>
        </View>
      </View>
    );
  }

  const needsResubmission = application.status === 'pending' && application.resubmission_status === 'requested';
  const wasResubmitted = application.status === 'pending' && application.resubmission_status === 'resubmitted';

  return (
    <View style={styles.container}>
      <Header title="Vendor Application" showBack onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.businessName}>{application.business_name || 'Your application'}</Text>
          <Text style={styles.appliedDate}>Applied {PH_DATE(application.application_date)}</Text>
          <View style={[
            styles.statusPill,
            application.status === 'approved' && styles.statusApproved,
            application.status === 'rejected' && styles.statusRejected,
          ]}>
            <Text style={[
              styles.statusPillText,
              application.status === 'approved' && styles.statusApprovedText,
              application.status === 'rejected' && styles.statusRejectedText,
            ]}>
              {application.status === 'approved' ? 'Approved' : application.status === 'rejected' ? 'Not Approved' : 'Under Review'}
            </Text>
          </View>
        </View>

        {application.status === 'approved' && (
          <View style={styles.infoCard}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
            <Text style={styles.infoText}>You're an approved vendor! Open your Vendor Dashboard from Profile to get started.</Text>
          </View>
        )}

        {application.status === 'rejected' && (
          <View style={styles.infoCard}>
            <Ionicons name="close-circle" size={22} color={COLORS.error} />
            <Text style={styles.infoText}>This application wasn't approved. Contact support if you'd like to know more or reapply.</Text>
          </View>
        )}

        {application.status === 'pending' && !needsResubmission && !wasResubmitted && (
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={22} color={COLORS.primary} />
            <Text style={styles.infoText}>Your application is under review. We'll notify you once there's an update.</Text>
          </View>
        )}

        {wasResubmitted && (
          <View style={styles.infoCard}>
            <Ionicons name="checkmark-done-outline" size={22} color={COLORS.success} />
            <Text style={styles.infoText}>Your updated documents were submitted and are awaiting review.</Text>
          </View>
        )}

        {needsResubmission && (
          <>
            <View style={styles.warningCard}>
              <View style={styles.warningHead}>
                <Ionicons name="alert-circle" size={20} color={COLORS.warning} />
                <Text style={styles.warningTitle}>Action needed</Text>
              </View>
              <Text style={styles.warningMessage}>{application.resubmission_message}</Text>
            </View>

            <View style={styles.uploadGroup}>
              <Text style={styles.uploadLabel}>Government Issued ID</Text>
              <TouchableOpacity style={[styles.uploadButton, validId && styles.uploadButtonDone]} onPress={() => pickImage(setValidId, setValidIdName)}>
                <Ionicons name={validId ? 'checkmark-circle' : 'document-text-outline'} size={22} color={validId ? COLORS.success : COLORS.primary} />
                <Text style={[styles.uploadButtonText, validId && styles.uploadButtonTextDone]}>{validId ? validIdName : 'Upload Valid ID'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.uploadGroup}>
              <Text style={styles.uploadLabel}>Business Permit / Mayor's Permit</Text>
              <TouchableOpacity style={[styles.uploadButton, businessPermit && styles.uploadButtonDone]} onPress={() => pickDocument(setBusinessPermit, setBusinessPermitName)}>
                <Ionicons name={businessPermit ? 'checkmark-circle' : 'document-text-outline'} size={22} color={businessPermit ? COLORS.success : COLORS.primary} />
                <Text style={[styles.uploadButtonText, businessPermit && styles.uploadButtonTextDone]}>{businessPermit ? businessPermitName : 'Upload Business Permit'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, (!validId || !businessPermit || submitting) && styles.submitButtonDisabled]}
              onPress={submitResubmission}
              disabled={!validId || !businessPermit || submitting}
            >
              {submitting ? <ActivityIndicator color={COLORS.text.inverse} /> : <Text style={styles.submitButtonText}>Submit for Review</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.text.tertiary, textAlign: 'center' },
  body: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: 16, alignItems: 'flex-start',
  },
  businessName: { fontSize: 18, fontWeight: '800', color: COLORS.text.primary, marginBottom: 4 },
  appliedDate: { fontSize: 13, color: COLORS.text.tertiary, marginBottom: 12 },
  statusPill: { backgroundColor: COLORS.accentSoft, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusPillText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  statusApproved: { backgroundColor: COLORS.successLight },
  statusApprovedText: { color: COLORS.success },
  statusRejected: { backgroundColor: COLORS.errorLight },
  statusRejectedText: { color: COLORS.error },
  infoCard: {
    flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.text.secondary },
  warningCard: {
    backgroundColor: COLORS.warningLight, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.warning, marginBottom: 16,
  },
  warningHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  warningTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text.primary },
  warningMessage: { fontSize: 14, lineHeight: 20, color: COLORS.text.secondary },
  uploadGroup: { marginBottom: 14 },
  uploadLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text.secondary, marginBottom: 8 },
  uploadButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
  },
  uploadButtonDone: { borderColor: COLORS.success, backgroundColor: COLORS.successLight },
  uploadButtonText: { fontSize: 14, color: COLORS.text.tertiary, fontWeight: '600' },
  uploadButtonTextDone: { color: COLORS.text.primary },
  submitButton: {
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: COLORS.text.inverse, fontSize: 16, fontWeight: '700' },
});
