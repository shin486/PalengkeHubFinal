import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';

const AdminVendorApplicationsScreen = ({ navigation }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stalls')
        .select(`
          *,
          vendor:vendor_id (
            id,
            full_name,
            email,
            phone,
            created_at
          )
        `)
        .is('is_active', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      Alert.alert('Error', 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchApplications();
    setRefreshing(false);
  };

  const handleApplicationAction = (application, action) => {
    setSelectedApplication(application);
    setActionType(action);
    setRejectionReason('');
    setActionModalVisible(true);
  };

  const confirmAction = async () => {
    if (!selectedApplication) return;

    try {
      if (actionType === 'approve') {
        const { error } = await supabase
          .from('stalls')
          .update({ 
            is_active: true, 
            approved_at: new Date().toISOString() 
          })
          .eq('id', selectedApplication.id);

        if (error) throw error;
        Alert.alert('Success', 'Application approved successfully');
      } else if (actionType === 'reject') {
        if (!rejectionReason.trim()) {
          Alert.alert('Error', 'Please provide a rejection reason');
          return;
        }

        const { error } = await supabase
          .from('stalls')
          .update({ 
            is_active: false,
            rejection_reason: rejectionReason 
          })
          .eq('id', selectedApplication.id);

        if (error) throw error;
        Alert.alert('Success', 'Application rejected');
      }

      setActionModalVisible(false);
      setSelectedApplication(null);
      setActionType('');
      setRejectionReason('');
      fetchApplications();
    } catch (error) {
      console.error('Error processing application:', error);
      Alert.alert('Error', 'Failed to process application');
    }
  };

  const getStatusBadge = (stall) => {
    if (stall.is_active === true) {
      return { text: 'Active', color: '#10B981', bgColor: '#D1FAE5' };
    }
    if (stall.is_active === false) {
      return { text: 'Rejected', color: '#EF4444', bgColor: '#FEE2E2' };
    }
    return { text: 'Pending', color: '#F59E0B', bgColor: '#FEF3C7' };
  };

  const renderApplicationCard = ({ item }) => {
    const status = getStatusBadge(item);
    
    return (
      <View style={styles.applicationCard}>
        <View style={styles.applicationHeader}>
          <View style={styles.vendorInfo}>
            <View style={styles.vendorAvatar}>
              <MaterialIcons name="person" size={24} color="#DC2626" />
            </View>
            <View style={styles.vendorDetails}>
              <Text style={styles.vendorName}>{item.vendor?.full_name || 'Unknown Vendor'}</Text>
              <Text style={styles.vendorEmail}>{item.vendor?.email || 'N/A'}</Text>
              {item.vendor?.phone && (
                <Text style={styles.vendorPhone}>{item.vendor.phone}</Text>
              )}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>

        <View style={styles.stallInfo}>
          <Text style={styles.stallName}>{item.stall_name || 'Unnamed Stall'}</Text>
          <Text style={styles.stallDetails}>
            Stall #{item.stall_number || 'N/A'} • {item.section || 'Unassigned'}
          </Text>
        </View>

        <Text style={styles.applicationDate}>
          Applied: {new Date(item.created_at).toLocaleDateString()}
        </Text>

        {status.text === 'Pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApplicationAction(item, 'approve')}
            >
              <MaterialIcons name="check-circle" size={18} color="white" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleApplicationAction(item, 'reject')}
            >
              <MaterialIcons name="cancel" size={18} color="white" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading applications...</Text>
      </SafeAreaView>
    );
  }

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
          <Text style={styles.headerTitle}>Vendor Applications</Text>
          <Text style={styles.headerSubtitle}>
            {applications.filter(a => a.is_active === null).length} pending applications
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <MaterialIcons name="refresh" size={22} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={applications}
        renderItem={renderApplicationCard}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />
        }
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="inbox" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Applications</Text>
            <Text style={styles.emptyText}>
              No vendor applications found
            </Text>
          </View>
        }
      />

      {/* Action Modal */}
      <Modal
        visible={actionModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setActionModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {actionType === 'approve' ? 'Approve Application' : 'Reject Application'}
            </Text>
            <TouchableOpacity onPress={() => setActionModalVisible(false)}>
              <MaterialIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedApplication && (
              <>
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Vendor</Text>
                  <Text style={styles.modalValue}>{selectedApplication.vendor?.full_name || 'N/A'}</Text>
                  <Text style={styles.modalValueSub}>{selectedApplication.vendor?.email || 'N/A'}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Stall</Text>
                  <Text style={styles.modalValue}>{selectedApplication.stall_name || 'N/A'}</Text>
                  <Text style={styles.modalValueSub}>
                    Stall #{selectedApplication.stall_number || 'N/A'} • {selectedApplication.section || 'N/A'}
                  </Text>
                </View>

                {actionType === 'reject' && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Rejection Reason *</Text>
                    <TextInput
                      style={styles.modalTextArea}
                      placeholder="Please provide a reason for rejection..."
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                )}

                <TouchableOpacity 
                  style={[
                    styles.modalActionButton,
                    actionType === 'reject' && styles.rejectActionButton
                  ]}
                  onPress={confirmAction}
                >
                  <LinearGradient 
                    colors={actionType === 'approve' ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']} 
                    style={styles.modalActionGradient}
                  >
                    <Text style={styles.modalActionText}>
                      {actionType === 'approve' ? 'Approve Application' : 'Reject Application'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

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
  listContainer: {
    padding: 16,
  },
  applicationCard: {
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
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  vendorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorDetails: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  vendorEmail: {
    fontSize: 13,
    color: '#6B7280',
  },
  vendorPhone: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
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
  stallInfo: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stallName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  stallDetails: {
    fontSize: 13,
    color: '#6B7280',
  },
  applicationDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
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
    fontWeight: '600',
    color: '#111827',
  },
  modalValueSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
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
  modalActionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 32,
  },
  rejectActionButton: {
    // Same style, different gradient
  },
  modalActionGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AdminVendorApplicationsScreen;
