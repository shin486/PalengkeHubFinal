import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useStalls = (options = {}) => {
  const { section, searchQuery, limit = 20 } = options;

  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState([]);

  const fetchStalls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('stalls')
        .select('*')
        .eq('is_active', true)
        .order('stall_number');

      if (section && section !== 'All') {
        query = query.eq('section', section);
      }

      if (searchQuery) {
        query = query.or(`stall_number.ilike.%${searchQuery}%,stall_name.ilike.%${searchQuery}%,section.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.limit(limit);

      if (error) throw error;
      setStalls(data || []);
    } catch (error) {
      console.error('Error fetching stalls:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [section, searchQuery, limit]);

  const fetchSections = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select('section')
        .eq('is_active', true);

      if (error) throw error;
      
      const uniqueSections = ['All', ...new Set(data.map(s => s.section))];
      setSections(uniqueSections);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  }, []);

  const getStallById = async (stallId) => {
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .eq('id', stallId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching stall:', error);
      return null;
    }
  };

  const getStallWithProducts = async (stallId) => {
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select(`
          *,
          products (*)
        `)
        .eq('id', stallId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching stall with products:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchStalls();
    fetchSections();
  }, [fetchStalls, fetchSections]);

  return {
    stalls,
    sections,
    loading,
    error,
    getStallById,
    getStallWithProducts,
    refreshStalls: fetchStalls,
  };
};