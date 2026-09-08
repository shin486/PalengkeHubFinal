import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export const useVendorOrders = (stallId) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  // Previously fetch failures only went to console.error — nothing told
  // the vendor the list failed to load, so a network blip or RLS hiccup
  // looked identical to "you genuinely have zero orders."
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!stallId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log(' Fetching orders for stall:', stallId);

      const { data, error: fetchError } = await supabase
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

      if (fetchError) throw fetchError;

      console.log(' Orders fetched:', data?.length || 0);
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err?.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [stallId]);

  // Notify-the-customer text — kept identical to VendorOrderDetailScreen.js's
  // own copy of this map, since this is the SECOND path that can advance an
  // order's status (the Orders list's quick-action buttons) and previously
  // updated the row with no notification at all. A vendor advancing an
  // order from the list, rather than opening its detail screen, meant the
  // customer never heard about it.
  const STATUS_NOTIFICATION_MESSAGES = {
    confirmed: 'Your order has been confirmed by the vendor!',
    preparing: 'Your order is now being prepared.',
    ready: 'Your order is ready for pickup!',
    completed: 'Your order has been completed. Thank you!',
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      console.log(' Updating order:', orderId, 'to:', newStatus);

      const order = orders.find(o => o.id === orderId);

      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: new Date()
        })
        .eq('id', orderId);

      if (error) throw error;

      if (order?.consumer_id && STATUS_NOTIFICATION_MESSAGES[newStatus]) {
        const { error: notifyError } = await supabase.from('notifications').insert({
          user_id: order.consumer_id,
          title: 'Order Update',
          message: STATUS_NOTIFICATION_MESSAGES[newStatus],
          type: 'order',
          data: { order_id: orderId, type: 'status_update' },
          is_read: false,
          created_at: new Date().toISOString(),
        });
        if (notifyError) console.error('Error notifying customer of status update:', notifyError);
      }

      console.log(' Order status updated');
      await fetchOrders(); // Refresh orders
      return { success: true };
    } catch (error) {
      console.error('Error updating order:', error);
      return { success: false, error: error?.message || 'Failed to update order status.' };
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

  //  REAL-TIME SUBSCRIPTION
  useEffect(() => {
    // Initial fetch
    fetchOrders();

    if (!stallId) return;

    console.log(' Setting up real-time subscription for stall:', stallId);

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
          console.log(' New order received in real-time!', payload.new);
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
          console.log(' Order status updated in real-time!', payload.new);
          // Refresh orders when status changes
          fetchOrders();
        }
      )
      .subscribe((status) => {
        console.log(' Subscription status:', status);
      });

    // Cleanup on unmount
    return () => {
      console.log(' Cleaning up subscription for stall:', stallId);
      subscription.unsubscribe();
    };
  }, [fetchOrders, stallId]);

  return {
    orders,
    loading,
    error,
    orderStats,
    updateOrderStatus,
    refreshOrders: fetchOrders,
  };
};