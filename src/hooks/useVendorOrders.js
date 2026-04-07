import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export const useVendorOrders = (stallId) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!stallId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('📦 Fetching orders for stall:', stallId);
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:consumer_id (
            full_name,
            phone
          )
        `)
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('✅ Orders fetched:', data?.length || 0);
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [stallId]);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      console.log('📝 Updating order:', orderId, 'to:', newStatus);
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date()
        })
        .eq('id', orderId);

      if (error) throw error;
      
      console.log('✅ Order status updated');
      await fetchOrders(); // Refresh orders
      return true;
    } catch (error) {
      console.error('Error updating order:', error);
      return false;
    }
  };

  const orderStats = {
    pending: orders.filter(o => o.status === 'pending'),
    confirmed: orders.filter(o => o.status === 'confirmed'),
    preparing: orders.filter(o => o.status === 'preparing'),
    ready: orders.filter(o => o.status === 'ready'),
    completed: orders.filter(o => o.status === 'completed'),
    cancelled: orders.filter(o => o.status === 'cancelled'),
    active: orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)),
  };

  // 🔥 REAL-TIME SUBSCRIPTION
  useEffect(() => {
    // Initial fetch
    fetchOrders();

    if (!stallId) return;

    console.log('🔌 Setting up real-time subscription for stall:', stallId);

    // Subscribe to new orders and status changes
    const subscription = supabase
      .channel(`vendor-orders-${stallId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `stall_id=eq.${stallId}`,
        },
        (payload) => {
          console.log('🆕 New order received in real-time!', payload.new);
          // Refresh orders when new order arrives
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `stall_id=eq.${stallId}`,
        },
        (payload) => {
          console.log('🔄 Order status updated in real-time!', payload.new);
          // Refresh orders when status changes
          fetchOrders();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    // Cleanup on unmount
    return () => {
      console.log('🔌 Cleaning up subscription for stall:', stallId);
      subscription.unsubscribe();
    };
  }, [fetchOrders, stallId]);

  return {
    orders,
    loading,
    orderStats,
    updateOrderStatus,
    refreshOrders: fetchOrders,
  };
};