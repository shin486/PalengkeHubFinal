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
      const { error } = await supabase
        .from('promotions')
        .insert([{
          product_id: promotionData.product_id,
          stall_id: stallId,
          original_price: promotionData.original_price,
          discounted_price: promotionData.discounted_price,
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
      const { error } = await supabase
        .from('promotions')
        .update({
          original_price: updates.original_price,
          discounted_price: updates.discounted_price,
          discount_type: updates.discount_type,
          discount_value: updates.discount_value,
          start_date: updates.start_date,
          end_date: updates.end_date,
          is_active: updates.is_active,
          updated_at: new Date().toISOString(),
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
    try {
      const { error } = await supabase
        .from('promotions')
        .update({ is_active: !promotion.is_active })
        .eq('id', promotion.id);

      if (error) throw error;
      await fetchPromotions();
      return true;
    } catch (err) {
      console.error('Error toggling promotion:', err);
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