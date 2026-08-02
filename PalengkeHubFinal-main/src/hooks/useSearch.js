import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useSearch = () => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const debounceTimer = useRef(null);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setProducts([]);
      setStalls([]);
      return;
    }

    setLoading(true);
    
    try {
      // Search products
      const { data: productsData } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            stall_number,
            stall_name,
            section
          )
        `)
        .ilike('name', `%${searchQuery}%`)
        .eq('is_available', true)
        .limit(20);

      // Search stalls
      const { data: stallsData } = await supabase
        .from('stalls')
        .select('*')
        .or(`stall_number.ilike.%${searchQuery}%,stall_name.ilike.%${searchQuery}%,section.ilike.%${searchQuery}%`)
        .eq('is_active', true)
        .limit(20);

      setProducts(productsData || []);
      setStalls(stallsData || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((text) => {
    setQuery(text);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      performSearch(text);
    }, 300);
  }, [performSearch]);

  const addRecentSearch = useCallback((term) => {
    if (!term.trim()) return;
    
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== term);
      return [term, ...filtered].slice(0, 10);
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setProducts([]);
    setStalls([]);
  }, []);

  return {
    query,
    products,
    stalls,
    loading,
    recentSearches,
    handleSearch,
    addRecentSearch,
    clearRecentSearches,
    clearSearch,
    performSearch,
  };
};