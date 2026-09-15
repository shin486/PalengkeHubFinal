// src/components/admin/AdminOrdersTable.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { colors, spacing, radius, getStatusColor, getStatusBg } from '../../theme/adminTheme';
import { AdminDataTable } from './AdminDataTable';

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const columns = [
    { key: 'order_number', label: 'Order #', width: '12%' },
    { key: 'customer', label: 'Customer', width: '18%' },
    { key: 'stall', label: 'Stall', width: '18%' },
    { key: 'amount', label: 'Amount', width: '12%' },
    { key: 'status', label: 'Status', width: '15%' },
    { key: 'date', label: 'Date', width: '15%' },
  ];

  const StatusBadge = ({ status }) => (
    <View style={[styles.statusBadge, { backgroundColor: getStatusBg(status) }]}>
      <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
        {status}
      </Text>
    </View>
  );

  const renderRow = (item) => (
    <>
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
      <View style={[styles.rowCell, styles.cellStatus]}>
        <StatusBadge status={item.status} />
      </View>
      <Text style={[styles.rowCell, styles.cellDate]}>
        {formatDate(item.created_at)}
      </Text>
    </>
  );

  return (
    <AdminDataTable
      data={orders}
      columns={columns}
      keyExtractor={(item) => item.id.toString()}
      loading={loading}
      emptyMessage="No orders found"
      renderRow={renderRow}
      rowStyle={styles.tableRow}
      searchable={true}
      searchPlaceholder="Search orders..."
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
  cellNumber: { width: '12%' },
  cellCustomer: { width: '18%' },
  cellStall: { width: '18%' },
  cellAmount: { 
    width: '12%',
    fontWeight: '600',
    color: colors.neutral[900],
  },
  cellStatus: { 
    width: '15%',
    justifyContent: 'center',
  },
  cellDate: { width: '15%' },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});