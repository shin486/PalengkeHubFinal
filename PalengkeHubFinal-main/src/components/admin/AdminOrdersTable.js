// src/components/admin/AdminOrdersTable.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../lib/supabase';

export const AdminOrdersTable = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:consumer_id (full_name, email),
          stalls (stall_number, stall_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#3B82F6';
      case 'preparing': return '#8B5CF6';
      case 'ready': return '#10B981';
      case 'completed': return '#6B7280';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <Text style={[styles.headerCell, styles.cellNumber]}>Order #</Text>
        <Text style={[styles.headerCell, styles.cellCustomer]}>Customer</Text>
        <Text style={[styles.headerCell, styles.cellStall]}>Stall</Text>
        <Text style={[styles.headerCell, styles.cellAmount]}>Amount</Text>
        <Text style={[styles.headerCell, styles.cellStatus]}>Status</Text>
        <Text style={[styles.headerCell, styles.cellDate]}>Date</Text>
      </View>
      
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.tableRow}>
            <Text style={[styles.rowCell, styles.cellNumber]} numberOfLines={1}>
              {item.order_number?.slice(-8) || item.id.toString().slice(-8)}
            </Text>
            <Text style={[styles.rowCell, styles.cellCustomer]} numberOfLines={1}>
              {item.profiles?.full_name || item.profiles?.email?.split('@')[0] || 'N/A'}
            </Text>
            <Text style={[styles.rowCell, styles.cellStall]} numberOfLines={1}>
              {item.stalls?.stall_name || `Stall #${item.stalls?.stall_number}` || 'N/A'}
            </Text>
            <Text style={[styles.rowCell, styles.cellAmount]}>₱{item.total_amount}</Text>
            <View style={[styles.cellStatus, styles.statusContainer]}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={[styles.rowCell, styles.cellDate]}>{formatDate(item.created_at)}</Text>
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
  cellNumber: { width: '15%' },
  cellCustomer: { width: '20%' },
  cellStall: { width: '20%' },
  cellAmount: { width: '12%' },
  cellStatus: { width: '15%' },
  cellDate: { width: '18%' },
  statusContainer: {
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  listContent: {
    paddingBottom: 20,
  },
});