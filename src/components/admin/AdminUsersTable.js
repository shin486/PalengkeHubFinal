// src/components/admin/AdminUsersTable.js
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
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return '#DC2626';
      case 'vendor': return '#10B981';
      default: return '#3B82F6';
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
        <Text style={[styles.headerCell, styles.cellUser]}>User</Text>
        <Text style={[styles.headerCell, styles.cellEmail]}>Email</Text>
        <Text style={[styles.headerCell, styles.cellRole]}>Role</Text>
        <Text style={[styles.headerCell, styles.cellActions]}>Actions</Text>
      </View>
      
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.tableRow}>
            <Text style={[styles.rowCell, styles.cellUser]} numberOfLines={1}>
              {item.full_name || 'N/A'}
            </Text>
            <Text style={[styles.rowCell, styles.cellEmail]} numberOfLines={1}>
              {item.email}
            </Text>
            <View style={[styles.cellRole, styles.roleContainer]}>
              <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) }]}>
                <Text style={styles.roleText}>{item.role}</Text>
              </View>
            </View>
            <View style={[styles.rowCell, styles.cellActions, styles.actionsContainer]}>
              {item.role !== 'admin' && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => updateUserRole(item.id, 'vendor')}
                  >
                    <Text style={styles.actionText}>Make Vendor</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.consumerButton]}
                    onPress={() => updateUserRole(item.id, 'consumer')}
                  >
                    <Text style={styles.actionText}>Make Consumer</Text>
                  </TouchableOpacity>
                </>
              )}
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
  cellUser: { width: '20%' },
  cellEmail: { width: '35%' },
  cellRole: { width: '15%' },
  cellActions: { width: '30%' },
  roleContainer: {
    justifyContent: 'center',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
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
  approveButton: {
    backgroundColor: '#10B981',
  },
  consumerButton: {
    backgroundColor: '#3B82F6',
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