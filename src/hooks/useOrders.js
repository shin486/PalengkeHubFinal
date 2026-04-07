import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          stall:stalls (
            id,
            stall_number,
            stall_name,
            section,
            description,
            location_notes
          )
        `)
        .eq('consumer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // ✅ Add fallback stall data if missing
      const ordersWithStall = (data || []).map(order => ({
        ...order,
        stall: order.stall || {
          stall_number: 'N/A',
          stall_name: 'Market Stall',
          section: 'Unknown',
        }
      }));
      
      setOrders(ordersWithStall);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 🔥 REAL-TIME SUBSCRIPTION
  useEffect(() => {
    fetchOrders();

    if (!user?.id) return;

    console.log('🔌 Setting up real-time subscription for customer orders:', user.id);

    const subscription = supabase
      .channel(`customer-orders-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `consumer_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🆕 New order placed!', payload.new);
          setNewOrderAlert(true);
          fetchOrders();
          setTimeout(() => setNewOrderAlert(false), 3000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `consumer_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Order status updated!', payload.new);
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchOrders, user?.id]);

  const getOrderById = (orderId) => {
    return orders.find(order => order.id === orderId);
  };

  const getActiveOrders = () => {
    return orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  };

  const getOrderHistory = () => {
    return orders.filter(o => ['completed', 'cancelled'].includes(o.status));
  };

  return {
    orders,
    loading,
    error,
    newOrderAlert,
    getOrderById,
    getActiveOrders,
    getOrderHistory,
    refreshOrders: fetchOrders,
  };
};