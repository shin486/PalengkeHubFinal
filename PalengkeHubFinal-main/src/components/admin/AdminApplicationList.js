// src/components/admin/AdminApplicationsList.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';

export const AdminApplicationsList = ({ navigation }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_applications')
        .select(`
          *,
          profiles:applicant_id (email, full_name, phone)
        `)
        .eq('status', 'pending')
        .order('application_date', { ascending: false });
      
      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (application) => {
    Alert.alert(
      'Approve Application',
      `Approve ${application.business_name} as a vendor?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await supabase
                .from('vendor_applications')
                .update({ status: 'approved', reviewed_at: new Date() })
                .eq('id', application.id);
              
              await supabase
                .from('profiles')
                .update({ role: 'vendor' })
                .eq('id', application.applicant_id);
              
              Alert.alert('Success', 'Vendor application approved');
              fetchApplications();
            } catch (error) {
              Alert.alert('Error', 'Failed to approve application');
            }
          }
        }
      ]
    );
  };

  const handleReject = async (application) => {
    Alert.alert(
      'Reject Application',
      `Reject ${application.business_name}'s application?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('vendor_applications')
              .update({ status: 'rejected', reviewed_at: new Date() })
              .eq('id', application.id);
            Alert.alert('Rejected', 'Application has been rejected');
            fetchApplications();
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  if (applications.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>✅</Text>
        <Text style={styles.emptyTitle}>No Pending Applications</Text>
        <Text style={styles.emptyText}>All vendor applications have been reviewed</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.businessName}>{item.business_name}</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            </View>
            
            <Text style={styles.applicant}>Applicant: {item.profiles?.full_name || item.profiles?.email}</Text>
            <Text style={styles.category}>Category: {item.category || 'N/A'}</Text>
            <Text style={styles.date}>Applied: {new Date(item.application_date).toLocaleDateString()}</Text>
            {item.experience && (
              <Text style={styles.experience}>Experience: {item.experience}</Text>
            )}
            {item.address && (
              <Text style={styles.address}>Address: {item.address}</Text>
            )}
            
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.approveButton} onPress={() => handleApprove(item)}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.buttonGradient}>
                  <Text style={styles.buttonText}>Approve</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectButton} onPress={() => handleReject(item)}>
                <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.buttonGradient}>
                  <Text style={styles.buttonText}>Reject</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 60,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  applicant: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  experience: {
    fontSize: 13,
    color: '#374151',
    marginTop: 4,
    fontStyle: 'italic',
  },
  address: {
    fontSize: 13,
    color: '#374151',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  approveButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rejectButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});