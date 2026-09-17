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

  // Get current user. getSession() (not getUser()) deliberately -- it
  // resolves instantly from the locally cached session instead of a
  // real network round-trip to Supabase's auth server. That round-trip
  // (a few hundred ms to ~1s) was exactly the window "shows, then
  // disappears after a second" fell into: on a freshly-mounted
  // useFavorites() instance (e.g. an uncontrolled ProductCard on a
  // screen that doesn't pass isWishlisted/onToggleWishlist -- see
  // CategoryProductsScreen.js), userId starts null until this
  // resolves. A heart-tap in that window optimistically shows the
  // favorite, but saveFavorites' `if (userId)` guard is still false,
  // so the Supabase sync is silently skipped (only AsyncStorage gets
  // it) -- and the moment userId then resolves, the effect below
  // re-fetches from the server, which never received the toggle,
  // overwriting the optimistic state right back to unfavorited.
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
    };
    checkUser();

    // onAuthStateChange fires on more than sign-in/sign-out -- also
    // TOKEN_REFRESHED, USER_UPDATED, an initial INITIAL_SESSION event,
    // etc. This used to call loadFavoritesFromSupabase directly here
    // AND (via setUserId below) trigger the separate userId-effect to
    // also call it -- two independent, unsynchronized fetches per
    // event. If either of those extra events fired a few seconds after
    // a heart-tap, whichever fetch resolved last could land with
    // pre-toggle data and silently overwrite the just-added favorite,
    // which is exactly what "shows, then disappears a few seconds
    // later" was. setUserId alone is enough: the effect below only
    // re-fetches when the id actually changes (a real sign-in/out),
    // not on a same-user token refresh.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
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

    // Sync to Supabase if logged in. A plain update, not an upsert --
    // every real user's profiles row already exists (created by the
    // handle_new_user() signup trigger), and .upsert()'s INSERT ... ON
    // CONFLICT DO UPDATE must satisfy the table's INSERT policy too,
    // even when it ends up updating an existing row. This table's
    // INSERT policy is admin-only, so a regular user's upsert here was
    // always rejected with a 403 -- confirmed directly against the live
    // database. update() only needs the (already-correct) UPDATE
    // policy, which permits a user to update their own row.
    //
    // Also: supabase-js does not throw on an HTTP error response like
    // that 403 -- it resolves to { data, error }. This never checked
    // that, so the failure was silently swallowed before it could even
    // reach a catch block, which is why nothing ever surfaced it.
    if (userId) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ favorites: { products, stalls } })
          .eq('id', userId);
        if (error) console.warn('Error syncing favorites to Supabase:', error);
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

  // Must be stable across renders -- callers wire this into
  // useFocusEffect(useCallback(() => refreshFavorites(), [refreshFavorites])).
  // Returning a fresh arrow function every render (as this used to, inline
  // in the object below) made that dependency "change" on every render,
  // and since calling it triggers a state update (a re-render) via
  // loadFavoritesFromSupabase/loadLocalFavorites, that re-render produced
  // yet another new reference -- an infinite refetch loop that froze
  // FavoritesScreen and ProfileScreen the moment either mounted.
  const refreshFavorites = useCallback(() => {
    if (userId) loadFavoritesFromSupabase(userId);
    else loadLocalFavorites();
  }, [userId]);

  const clearAllFavorites = async () => {
    setFavoriteProducts([]);
    setFavoriteStalls([]);
    await AsyncStorage.removeItem(FAVORITES_KEY);
    if (userId) {
      // Same upsert-vs-update fix as saveFavorites above.
      const { error } = await supabase
        .from('profiles')
        .update({ favorites: { products: [], stalls: [] } })
        .eq('id', userId);
      if (error) console.warn('Error clearing favorites in Supabase:', error);
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
    refreshFavorites,
  };
};