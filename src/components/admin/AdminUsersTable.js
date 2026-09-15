// src/components/admin/AdminUsersTable.js
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
import { colors, spacing, radius } from '../../theme/adminTheme';
import { AdminDataTable } from './AdminDataTable';

export const AdminUsersTable = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    Alert.alert(
      'Update Role',
      `Change user role to ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);
              
              if (error) throw error;
              Alert.alert('Success', `User role updated to ${newRole}`);
              fetchUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to update user role');
            }
          }
        }
      ]
    );
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return colors.primary[500];
      case 'vendor': return colors.success[500];
      default: return colors.info[500];
    }
  };

  const columns = [
    { key: 'user', label: 'User', width: '20%' },
    { key: 'email', label: 'Email', width: '30%' },
    { key: 'role', label: 'Role', width: '15%' },
    { key: 'actions', label: 'Actions', width: '35%' },
  ];

  const RoleBadge = ({ role }) => (
    <View style={[styles.roleBadge, { backgroundColor: getRoleColor(role) + '15' }]}>
      <Text style={[styles.roleText, { color: getRoleColor(role) }]}>
        {role}
      </Text>
    </View>
  );

  const renderRow = (item) => (
    <>
      <Text style={[styles.rowCell, styles.cellUser]} numberOfLines={1}>
        {item.full_name || 'N/A'}
      </Text>
      <Text style={[styles.rowCell, styles.cellEmail]} numberOfLines={1}>
        {item.email}
      </Text>
      <View style={[styles.rowCell, styles.cellRole]}>
        <RoleBadge role={item.role} />
      </View>
      <View style={[styles.rowCell, styles.cellActions, styles.actionsContainer]}>
        {item.role !== 'admin' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.vendorButton]}
              onPress={() => updateUserRole(item.id, 'vendor')}
            >
              <Text style={styles.actionText}>Make Vendor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.consumerButton]}
              onPress={() => updateUserRole(item.id, 'consumer')}
            >
              <Text style={styles.actionText}>Make Customer</Text>
            </TouchableOpacity>
          </>
        )}
        {item.role === 'admin' && (
          <Text style={styles.adminText}>Admin</Text>
        )}
      </View>
    </>
  );

  return (
    <AdminDataTable
      data={users}
      columns={columns}
      keyExtractor={(item) => item.id}
      loading={loading}
      emptyMessage="No users found"
      renderRow={renderRow}
      rowStyle={styles.tableRow}
      searchable={true}
      searchPlaceholder="Search users..."
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
  cellUser: { width: '20%' },
  cellEmail: { width: '30%' },
  cellRole: { 
    width: '15%',
    justifyContent: 'center',
  },
  cellActions: { width: '35%' },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  vendorButton: {
    backgroundColor: colors.success[500],
  },
  consumerButton: {
    backgroundColor: colors.info[500],
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.surface.default,
  },
  adminText: {
    fontSize: 13,
    color: colors.neutral[400],
    fontWeight: '500',
  },
});