import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Shared module-level cart state so all useCart() calls share the same cart
let sharedCart = [];
const listeners = new Set();

// Bumped on every local mutation (add/update/remove/clear) so a slower,
// concurrent fetchCart() can tell its result is now stale instead of
// blindly overwriting it. CartScreen refetches from the DB on every
// screen focus (for multi-device sync), but addToCart's own DB write is
// never awaited by its callers — tap "Add to Cart" and immediately switch
// to the Cart tab, and the focus-triggered fetch can resolve with the
// pre-add cart and stomp the optimistic update that already added the item.
let cartVersion = 0;

// Counts DB writes currently in flight (addToCart/updateQuantity/removeItem/
// etc.). cartVersion alone isn't enough to catch the race above: a fetch
// that STARTS after the optimistic update (so its versionAtStart already
// matches) can still have its own read resolve BEFORE that mutation's own
// write has landed in the database, reading the pre-change row and
// overwriting the correct optimistic state — the item appears, then a
// moment later reverts as if it was never added. Any fetch that resolves
// while a write is still pending is discarded outright, regardless of
// version, since the write itself is a truer picture of where the cart is
// headed than a read that raced ahead of it.
let pendingWrites = 0;

const updateSharedCart = (newCart) => {
  sharedCart = newCart;
  cartVersion += 1;
  listeners.forEach(fn => fn(sharedCart));
};

export const useCart = () => {
  const { user, isGuest } = useAuth();
  const [cart, setCart] = useState(sharedCart);
  const [loading, setLoading] = useState(true);

  // Subscribe to shared cart updates
  useEffect(() => {
    const listener = (newCart) => setCart(newCart);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const fetchCart = useCallback(async () => {
    if (isGuest || !user) {
      updateSharedCart([]);
      setLoading(false);
      return;
    }

    const versionAtStart = cartVersion;

    try {
      setLoading(true);
      console.log(' Fetching cart for user:', user.id);

      // Get cart data - ensure we get only one row
      let { data, error } = await supabase
        .from('carts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(' Error fetching cart:', error);
        updateSharedCart([]);
        return;
      }

      console.log(' Found cart rows:', data?.length || 0);
      
      let cartData = null;
      if (data && data.length > 0) {
        cartData = data[0];
        
        // Delete any duplicate cart rows (keep only the most recent)
        if (data.length > 1) {
          console.log(' Found duplicate carts, cleaning up...');
          const oldCartIds = data.slice(1).map(c => c.id);
          await supabase.from('carts').delete().in('id', oldCartIds);
        }
      }
      
      // If no cart exists, create one with empty items
      if (!cartData) {
        console.log(' No cart found, creating new empty cart');
        const { data: newCart, error: insertError } = await supabase
          .from('carts')
          .insert({ 
            user_id: user.id, 
            items: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (insertError) {
          console.error(' Error creating cart:', insertError);
        } else {
          cartData = newCart;
        }
      }
      
      let items = [];
      if (cartData && cartData.items && Array.isArray(cartData.items)) {
        items = cartData.items;
      }
      
      const formattedItems = items.map(item => ({
        ...item,
        product_id: item.product_id || item.id
      }));
      
      console.log(' Cart loaded:', formattedItems.length, 'items');
      if (cartVersion !== versionAtStart) {
        // addToCart/updateQuantity/removeItem/clearCart changed the cart
        // while this fetch was in flight — that local write is newer than
        // what we just read, so trust it and drop this stale result.
        console.log(' Skipping stale cart fetch — a newer local change won the race');
        return;
      }
      if (pendingWrites > 0) {
        // A mutation's own DB write is still in flight — even though it
        // already bumped cartVersion before we started (so the check
        // above passed), our read could still have raced ahead of that
        // write landing and come back with the pre-change row. Trust the
        // pending write over this read; whichever screen needs fresh data
        // will refetch again on its next focus, by which point the write
        // will be done.
        console.log(' Skipping cart fetch — a write is still in flight');
        return;
      }
      updateSharedCart(formattedItems);
    } catch (error) {
      console.error(' Error fetching cart:', error);
      updateSharedCart([]);
    } finally {
      setLoading(false);
    }
  }, [user, isGuest]);

  const addToCart = useCallback(async (item, stallId, stallData, quantity = 1) => {
    console.log(' Adding to cart:', { itemName: item.name, quantity, stallId });

    if (isGuest || !user) {
      Alert.alert('Sign in required', 'You need to sign in to buy products.');
      return { requiresAuth: true };
    }

    const newItem = {
      product_id: item.id,
      id: item.id,
      name: item.name,
      price: item.price,
      unit: item.unit,
      // Dropped here previously — callers pass the full product (image_url
      // included), but this object only ever listed specific fields to
      // store, and image_url wasn't one of them. Every cart item has been
      // missing its photo since add-to-cart, regardless of which screen
      // added it.
      image_url: item.image_url || null,
      stall_id: stallId,
      stall_name: stallData?.stall_name,
      stall_number: stallData?.stall_number,
      section: stallData?.section,
      // Every vendor gets paid separately via their own GCash (no shared
      // payment gateway) — CheckoutScreen's groupByStall reads these two
      // fields straight off the cart item, so without them every vendor's
      // payment step silently fell back to the same placeholder number.
      gcash_qr_url: stallData?.gcash_qr_url || null,
      gcash_number: stallData?.gcash_number || null,
      quantity: quantity,
      selected_unit: item.selected_unit || item.unit,
      selected_unit_label: item.selected_unit_label,
      original_price: item.original_price || item.price
    };

    // A vendor-accepted haggle overrides whatever price the caller
    // computed — looked up fresh here (not trusted from the screen that
    // called addToCart) so the discount applies no matter which screen
    // added this product, and can't be spoofed by a stale client price.
    // Scoped to this exact customer + product + unit, matching how the
    // offer was made; haggle_offer_id lets checkout mark it 'used' once
    // the order is actually placed, so it reverts to the normal price.
    try {
      const { data: haggle } = await supabase
        .from('haggle_offers')
        .select('id, current_price')
        .eq('product_id', item.id)
        .eq('customer_id', user.id)
        .eq('unit', newItem.selected_unit)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (haggle) {
        // Postgres numeric columns come back as strings over PostgREST —
        // normalized so downstream .toFixed() calls on cart item prices
        // (checkout, cart screen) don't break on a string.
        newItem.price = Number(haggle.current_price);
        newItem.haggle_offer_id = haggle.id;
      }
    } catch (haggleErr) {
      console.warn('Haggle price lookup failed (non-fatal):', haggleErr.message);
    }

    // Reads sharedCart (the always-current module-level source of truth),
    // not the `cart` React-state closure this callback was created with.
    // That closure can be stale — if sharedCart changed (another mutation,
    // a fetchCart sync) any time between this function being called and
    // this line running (the haggle lookup above is a real await, a real
    // window for that), building off the closure's old snapshot would
    // silently discard whatever changed and overwrite the DB with a
    // result based on stale data. The add would appear to just not stick.
    const existingItemIndex = sharedCart.findIndex(cartItem => cartItem.product_id === item.id);
    let updatedCart;

    if (existingItemIndex !== -1) {
      updatedCart = [...sharedCart];
      updatedCart[existingItemIndex] = {
        ...updatedCart[existingItemIndex],
        quantity: updatedCart[existingItemIndex].quantity + quantity,
        // Re-applied on every add, not just the first — a haggle accepted
        // after this item was already in the cart would otherwise stay
        // invisible until the item was removed and re-added. Same for
        // image_url: self-heals a cart item added before that field was
        // captured at all, without the customer needing to remove/re-add.
        price: newItem.price,
        haggle_offer_id: newItem.haggle_offer_id,
        image_url: newItem.image_url,
      };
    } else {
      updatedCart = [...sharedCart, newItem];
    }

    updateSharedCart(updatedCart);

    pendingWrites += 1;
    try {
      // Get existing cart to ensure we update the correct row
      const { data: existingCart } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingCart) {
        await supabase
          .from('carts')
          .update({
            items: updatedCart,
            stall_id: stallId,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('carts')
          .insert({
            user_id: user.id,
            stall_id: stallId,
            items: updatedCart,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      console.log(' Cart saved to database');
    } catch (dbError) {
      console.error(' Database error:', dbError);
    } finally {
      pendingWrites -= 1;
    }
  }, [user, isGuest]);

  const updateQuantity = useCallback(async (productId, newQuantity) => {
    console.log(' Updating quantity:', { productId, newQuantity });

    if (!user) return;

    if (newQuantity <= 0) {
      const updatedCart = sharedCart.filter(item => item.product_id !== productId);
      updateSharedCart(updatedCart);
      pendingWrites += 1;
      try {
        await supabase
          .from('carts')
          .update({ items: updatedCart, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
      } finally {
        pendingWrites -= 1;
      }
      return;
    }

    const updatedCart = sharedCart.map(item =>
      item.product_id === productId
        ? { ...item, quantity: newQuantity }
        : item
    );
    updateSharedCart(updatedCart);

    pendingWrites += 1;
    try {
      await supabase
        .from('carts')
        .update({ items: updatedCart, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } finally {
      pendingWrites -= 1;
    }
  }, [user]);

  const removeItem = useCallback(async (productId) => {
    console.log(' Removing item:', productId);

    if (!user) return;

    const updatedCart = sharedCart.filter(item => item.product_id !== productId);
    updateSharedCart(updatedCart);

    pendingWrites += 1;
    try {
      await supabase
        .from('carts')
        .update({ items: updatedCart, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } finally {
      pendingWrites -= 1;
    }
  }, [user]);

  // Removes a specific set of items rather than the whole cart — used
  // after checking out only a subset of the cart (per-item selection),
  // so items the customer left unchecked stay put for later instead of
  // getting swept away by a full clearCart().
  const removeItems = useCallback(async (productIds) => {
    if (!user || !productIds?.length) return;

    const idSet = new Set(productIds);
    const updatedCart = sharedCart.filter(item => !idSet.has(item.product_id));
    updateSharedCart(updatedCart);

    pendingWrites += 1;
    try {
      await supabase
        .from('carts')
        .update({ items: updatedCart, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } finally {
      pendingWrites -= 1;
    }
  }, [user]);

  // Corrects stale prices in place — used by checkout's server-side price
  // re-verification, so the cart the customer reviews after a "prices
  // changed" block actually shows the corrected numbers instead of the
  // same stale ones that triggered the block.
  const syncPrices = useCallback(async (freshPricesByProductId) => {
    if (!user) return;

    const updatedCart = sharedCart.map(item => {
      const fresh = freshPricesByProductId.get(item.product_id);
      return fresh !== undefined ? { ...item, price: fresh } : item;
    });
    updateSharedCart(updatedCart);

    pendingWrites += 1;
    try {
      await supabase
        .from('carts')
        .update({ items: updatedCart, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } finally {
      pendingWrites -= 1;
    }
  }, [user]);

  const clearCart = useCallback(async () => {
    console.log(' Clearing cart');

    if (!user) return;

    // Clear local state first for immediate UI feedback
    updateSharedCart([]);

    pendingWrites += 1;
    try {
      // Update database with empty items array
      const { error } = await supabase
        .from('carts')
        .update({
          items: [],
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        console.error(' Error clearing cart in DB:', error);
      } else {
        console.log(' Cart cleared successfully in database');
      }
    } catch (error) {
      console.error(' Error clearing cart:', error);
    } finally {
      pendingWrites -= 1;
    }
  }, [user]);

  const refreshCart = useCallback(async () => {
    console.log(' Refreshing cart...');
    await fetchCart();
  }, [fetchCart]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  // Initial fetch
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  return {
    cart,
    cartCount: cart?.length || 0,
    cartTotal,
    loading,
    addToCart,
    updateQuantity,
    removeItem,
    removeItems,
    syncPrices,
    clearCart,
    refreshCart,
  };
};