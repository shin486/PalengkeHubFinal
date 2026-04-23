// src/components/admin/AdminStallsTable.js
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
import { supabase } from '../../../lib/supabase';

export const AdminStallsTable = ({ navigation }) => {
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStalls();
  }, []);

  const fetchStalls = async () => {
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select(`
          *,
          profiles:vendor_id (email, full_name)
        `)
        .order('stall_number');
      
      if (error) throw error;
      setStalls(data || []);
    } catch (error) {
      console.error('Error fetching stalls:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStallStatus = async (stallId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('stalls')
        .update({ is_active: !currentStatus })
        .eq('id', stallId);
      
      if (error) throw error;
      Alert.alert('Success', `Stall ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchStalls();
    } catch (error) {
      Alert.alert('Error', 'Failed to update stall status');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.cellNumber]}>Stall #</Text>
        <Text style={[styles.headerCell, styles.cellName]}>Name</Text>
        <Text style={[styles.headerCell, styles.cellSection]}>Section</Text>
        <Text style={[styles.headerCell, styles.cellVendor]}>Vendor</Text>
        <Text style={[styles.headerCell, styles.cellStatus]}>Status</Text>
        <Text style={[styles.headerCell, styles.cellActions]}>Actions</Text>
      </View>
      
      <FlatList
        data={stalls}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.tableRow}>
            <Text style={[styles.rowCell, styles.cellNumber]}>{item.stall_number}</Text>
            <Text style={[styles.rowCell, styles.cellName]} numberOfLines={1}>
              {item.stall_name || 'Unnamed'}
            </Text>
            <Text style={[styles.rowCell, styles.cellSection]}>{item.section}</Text>
            <Text style={[styles.rowCell, styles.cellVendor]} numberOfLines={1}>
              {item.profiles?.full_name || item.profiles?.email || 'Unassigned'}
            </Text>
            <View style={[styles.cellStatus, styles.statusContainer]}>
              <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                <Text style={styles.statusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
              </View>
            </View>
            <View style={[styles.rowCell, styles.cellActions, styles.actionsContainer]}>
              <TouchableOpacity
                style={[styles.actionButton, item.is_active ? styles.deactivateButton : styles.activateButton]}
                onPress={() => toggleStallStatus(item.id, item.is_active)}
              >
                <Text style={styles.actionText}>{item.is_active ? 'Deactivate' : 'Activate'}</Text>
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
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowCell: {
    fontSize: 14,
    color: '#111827',
  },
  cellNumber: { width: '10%' },
  cellName: { width: '20%' },
  cellSection: { width: '15%' },
  cellVendor: { width: '25%' },
  cellStatus: { width: '12%' },
  cellActions: { width: '18%' },
  statusContainer: {
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  activateButton: {
    backgroundColor: '#10B981',
  },
  deactivateButton: {
    backgroundColor: '#EF4444',
  },
  actionText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
});