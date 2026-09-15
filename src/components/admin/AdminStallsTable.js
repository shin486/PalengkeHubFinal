// src/components/admin/AdminStallsTable.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { colors, spacing, radius, getStatusColor, getStatusBg } from '../../theme/adminTheme';
import { AdminDataTable } from './AdminDataTable';

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
    Alert.alert(
      currentStatus ? 'Deactivate Stall' : 'Activate Stall',
      `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this stall?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: currentStatus ? 'Deactivate' : 'Activate',
          style: currentStatus ? 'destructive' : 'default',
          onPress: async () => {
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
          }
        }
      ]
    );
  };

  const columns = [
    { key: 'stall_number', label: 'Stall #', width: '10%' },
    { key: 'stall_name', label: 'Name', width: '20%' },
    { key: 'section', label: 'Section', width: '15%' },
    { key: 'vendor', label: 'Vendor', width: '25%' },
    { key: 'status', label: 'Status', width: '12%' },
    { key: 'actions', label: 'Actions', width: '18%' },
  ];

  const StatusBadge = ({ isActive }) => (
    <View style={[styles.statusBadge, { backgroundColor: isActive ? colors.success[50] : colors.danger[50] }]}>
      <Text style={[styles.statusText, { color: isActive ? colors.success[500] : colors.danger[500] }]}>
        {isActive ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );

  const renderRow = (item) => (
    <>
      <Text style={[styles.rowCell, styles.cellNumber]}>{item.stall_number}</Text>
      <Text style={[styles.rowCell, styles.cellName]} numberOfLines={1}>
        {item.stall_name || 'Unnamed'}
      </Text>
      <Text style={[styles.rowCell, styles.cellSection]}>{item.section}</Text>
      <Text style={[styles.rowCell, styles.cellVendor]} numberOfLines={1}>
        {item.profiles?.full_name || item.profiles?.email || 'Unassigned'}
      </Text>
      <View style={[styles.rowCell, styles.cellStatus]}>
        <StatusBadge isActive={item.is_active} />
      </View>
      <View style={[styles.rowCell, styles.cellActions]}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            item.is_active ? styles.deactivateButton : styles.activateButton
          ]}
          onPress={() => toggleStallStatus(item.id, item.is_active)}
        >
          <Text style={styles.actionText}>
            {item.is_active ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <AdminDataTable
      data={stalls}
      columns={columns}
      keyExtractor={(item) => item.id.toString()}
      loading={loading}
      emptyMessage="No stalls found"
      renderRow={renderRow}
      rowStyle={styles.tableRow}
      searchable={true}
      searchPlaceholder="Search stalls..."
    />
  );
};

const styles = StyleSheet.create({
  tableRow: {
    paddingVertical: spacing.md,
  },
  rowCell: {
    fontSize: 13,
    color: colors.neutral[900],
    paddingHorizontal: spacing.sm,
  },
  cellNumber: { width: '10%' },
  cellName: { width: '20%' },
  cellSection: { width: '15%' },
  cellVendor: { width: '25%' },
  cellStatus: { 
    width: '12%',
    justifyContent: 'center',
  },
  cellActions: { 
    width: '18%',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  activateButton: {
    backgroundColor: colors.success[500],
  },
  deactivateButton: {
    backgroundColor: colors.danger[500],
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.surface.default,
  },
});