// src/hooks/useVendorPromotions.js
import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

export const useVendorPromotions = (stallId) => {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPromotions = useCallback(async () => {
    if (!stallId) {
      setPromotions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          product:product_id (
            id,
            name,
            unit,
            price,
            image_url,
            is_available
          )
        `)
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (err) {
      console.error('Error fetching promotions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [stallId]);

  const createPromotion = async (promotionData) => {
    if (!stallId) {
      Alert.alert('Error', 'No stall assigned');
      return false;
    }

    try {
      // discounted_price is a DB-generated column (computed from
      // original_price + discount_type/discount_value) — Postgres rejects
      // any insert that tries to write a value into it directly ("cannot
      // insert a non-DEFAULT value into column"). This was the actual
      // cause of "new special price doesn't save": every create silently
      // failed with a 400 the UI never surfaced.
      const { error } = await supabase
        .from('promotions')
        .insert([{
          product_id: promotionData.product_id,
          stall_id: stallId,
          original_price: promotionData.original_price,
          discount_type: promotionData.discount_type,
          discount_value: promotionData.discount_value,
          start_date: promotionData.start_date,
          end_date: promotionData.end_date,
          is_active: promotionData.is_active ?? true,
        }]);

      if (error) throw error;

      Alert.alert('Success', 'Special price created successfully');
      await fetchPromotions();
      return true;
    } catch (err) {
      console.error('Error creating promotion:', err);
      Alert.alert('Error', err.message || 'Failed to create special price');
      return false;
    }
  };

  const updatePromotion = async (promotionId, updates) => {
    try {
      // Same fix as createPromotion: discounted_price is DB-generated
      // (writing to it is rejected outright), and this table has no
      // updated_at column at all (PGRST204 "Could not find the
      // 'updated_at' column") — both made every edit fail silently.
      const { error } = await supabase
        .from('promotions')
        .update({
          original_price: updates.original_price,
          discount_type: updates.discount_type,
          discount_value: updates.discount_value,
          start_date: updates.start_date,
          end_date: updates.end_date,
          is_active: updates.is_active,
        })
        .eq('id', promotionId);

      if (error) throw error;

      Alert.alert('Success', 'Special price updated successfully');
      await fetchPromotions();
      return true;
    } catch (err) {
      console.error('Error updating promotion:', err);
      Alert.alert('Error', err.message || 'Failed to update special price');
      return false;
    }
  };

  const togglePromotion = async (promotion) => {
    // Optimistic, in-place update — the previous version called
    // fetchPromotions() after every toggle, which flips the hook's
    // `loading` flag and swaps the whole screen to its skeleton state and
    // back. That's the "blink instead of a smooth toggle" — the Switch
    // itself was never the problem, the surrounding list was remounting.
    const nextActive = !promotion.is_active;
    setPromotions(prev => prev.map(p => p.id === promotion.id ? { ...p, is_active: nextActive } : p));
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: nextActive })
        .eq('id', promotion.id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error toggling promotion:', err);
      // Revert the optimistic flip since the write failed.
      setPromotions(prev => prev.map(p => p.id === promotion.id ? { ...p, is_active: promotion.is_active } : p));
      Alert.alert('Error', 'Failed to update special price status');
      return false;
    }
  };

  const deletePromotion = async (promotionId) => {
    Alert.alert(
      'Delete Special Price',
      'Are you sure you want to remove this special price?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('promotions')
                .delete()
                .eq('id', promotionId);

              if (error) throw error;

              Alert.alert('Success', 'Special price removed');
              await fetchPromotions();
            } catch (err) {
              console.error('Error deleting promotion:', err);
              Alert.alert('Error', 'Failed to remove special price');
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  return {
    promotions,
    loading,
    error,
    createPromotion,
    updatePromotion,
    togglePromotion,
    deletePromotion,
    refreshPromotions: fetchPromotions,
  };
};