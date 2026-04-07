import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useProducts = (options = {}) => {
  const {
    stallId,
    category,
    searchQuery,
    limit = 20,
    featured = false,
  } = options;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = supabase
        .from('products')
        .select(`
          *,
          stalls (
            id,
            stall_number,
            stall_name,
            section,
            average_rating
          )
        `)
        .eq('is_available', true)
        .limit(limit);

      if (stallId) {
        query = query.eq('stall_id', stallId);
      }

      if (category && category !== 'All') {
        query = query.eq('category', category);
      }

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      if (featured) {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('name');
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
      setHasMore(data?.length === limit);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [stallId, category, searchQuery, limit, featured]);

  const getProductById = async (productId) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            id,
            stall_number,
            stall_name,
            section,
            description,
            average_rating,
            total_ratings
          )
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    hasMore,
    getProductById,
    refreshProducts: fetchProducts,
  };
};