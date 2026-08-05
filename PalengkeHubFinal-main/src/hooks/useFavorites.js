import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

const FAVORITES_KEY = '@palengkehub_favorites';

export const useFavorites = () => {
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [favoriteStalls, setFavoriteStalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Get current user
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);
      if (session?.user?.id) {
        loadFavoritesFromSupabase(session.user.id);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId) {
      loadFavoritesFromSupabase(userId);
    } else {
      loadLocalFavorites();
    }
  }, [userId]);

  // Load from Supabase (primary source for logged-in users)
  const loadFavoritesFromSupabase = async (uid) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('favorites')
        .eq('id', uid)
        .single();

      if (error) throw error;

      if (data?.favorites) {
        const favs = typeof data.favorites === 'string' ? JSON.parse(data.favorites) : data.favorites;
        setFavoriteProducts(favs.products || []);
        setFavoriteStalls(favs.stalls || []);
      } else {
        // Fallback to local storage
        await loadLocalFavorites();
      }
    } catch (err) {
      console.warn('Error loading favorites from Supabase, falling back to local:', err);
      await loadLocalFavorites();
    } finally {
      setLoading(false);
    }
  };

  // Load from AsyncStorage (guest mode or fallback)
  const loadLocalFavorites = async () => {
    try {
      const data = await AsyncStorage.getItem(FAVORITES_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        setFavoriteProducts(parsed.products || []);
        setFavoriteStalls(parsed.stalls || []);
      }
    } catch (error) {
      console.warn('Error loading local favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  // Save to Supabase AND AsyncStorage
  const saveFavorites = async (products, stalls) => {
    const payload = JSON.stringify({ products, stalls });

    // Always save locally
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, payload);
    } catch (e) {
      console.warn('Error saving local favorites:', e);
    }

    // Sync to Supabase if logged in
    if (userId) {
      try {
        await supabase
          .from('profiles')
          .upsert({ id: userId, favorites: { products, stalls } }, { onConflict: 'id' });
      } catch (e) {
        console.warn('Error syncing favorites to Supabase:', e);
      }
    }
  };

  const isProductFavorite = (productId) => {
    return favoriteProducts.some(p => p.id === productId);
  };

  const isStallFavorite = (stallId) => {
    return favoriteStalls.some(s => s.id === stallId);
  };

  const toggleProductFavorite = useCallback((product) => {
    if (!product || !product.id) return;

    const isFav = isProductFavorite(product.id);
    let updated;

    if (isFav) {
      updated = favoriteProducts.filter(p => p.id !== product.id);
      setFavoriteProducts(updated);
      saveFavorites(updated, favoriteStalls);
      Alert.alert('Removed', `${product.name || 'Product'} removed from favorites`);
      return false;
    } else {
      updated = [...favoriteProducts, {
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        stall_id: product.stall?.id || product.stall_id,
        stall_name: product.stall?.name || product.stall_name,
        category: product.category,
        added_at: new Date().toISOString(),
      }];
      setFavoriteProducts(updated);
      saveFavorites(updated, favoriteStalls);
      Alert.alert('Added!', `${product.name || 'Product'} added to favorites`);
      return true;
    }
  }, [favoriteProducts, favoriteStalls, userId]);

  const toggleStallFavorite = useCallback((stall) => {
    if (!stall || !stall.id) return;

    const isFav = isStallFavorite(stall.id);
    let updated;

    if (isFav) {
      updated = favoriteStalls.filter(s => s.id !== stall.id);
      setFavoriteStalls(updated);
      saveFavorites(favoriteProducts, updated);
      Alert.alert('Removed', `${stall.name || stall.stall_name || 'Stall'} removed from favorites`);
      return false;
    } else {
      updated = [...favoriteStalls, {
        id: stall.id,
        name: stall.name || stall.stall_name,
        stall_number: stall.stall_number,
        section: stall.section,
        rating: stall.rating,
        image_url: stall.image_url,
        added_at: new Date().toISOString(),
      }];
      setFavoriteStalls(updated);
      saveFavorites(favoriteProducts, updated);
      Alert.alert('Added!', `${stall.name || stall.stall_name || 'Stall'} added to favorites`);
      return true;
    }
  }, [favoriteProducts, favoriteStalls, userId]);

  const getFavoriteCount = () => favoriteProducts.length + favoriteStalls.length;

  const clearAllFavorites = async () => {
    setFavoriteProducts([]);
    setFavoriteStalls([]);
    await AsyncStorage.removeItem(FAVORITES_KEY);
    if (userId) {
      await supabase
        .from('profiles')
        .upsert({ id: userId, favorites: { products: [], stalls: [] } }, { onConflict: 'id' });
    }
  };

  return {
    favoriteProducts,
    favoriteStalls,
    loading,
    isProductFavorite,
    isStallFavorite,
    toggleProductFavorite,
    toggleStallFavorite,
    getFavoriteCount,
    clearAllFavorites,
    refreshFavorites: () => {
      if (userId) loadFavoritesFromSupabase(userId);
      else loadLocalFavorites();
    },
  };
};