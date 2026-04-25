import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useCart = () => {
  const { user, isGuest } = useAuth();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = useCallback(async () => {
    if (isGuest || !user) {
      setCart([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Fetching cart for user:', user.id);
      
      // Get cart data - ensure we get only one row
      let { data, error } = await supabase
        .from('carts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching cart:', error);
        setCart([]);
        return;
      }

      console.log('📦 Found cart rows:', data?.length || 0);
      
      let cartData = null;
      if (data && data.length > 0) {
        cartData = data[0];
        
        // Delete any duplicate cart rows (keep only the most recent)
        if (data.length > 1) {
          console.log('⚠️ Found duplicate carts, cleaning up...');
          const oldCartIds = data.slice(1).map(c => c.id);
          await supabase.from('carts').delete().in('id', oldCartIds);
        }
      }
      
      // If no cart exists, create one with empty items
      if (!cartData) {
        console.log('📝 No cart found, creating new empty cart');
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
          console.error('❌ Error creating cart:', insertError);
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
      
      console.log('✅ Cart loaded:', formattedItems.length, 'items');
      setCart(formattedItems);
    } catch (error) {
      console.error('❌ Error fetching cart:', error);
      setCart([]);
    } finally {
      setLoading(false);
    }
  }, [user, isGuest]);

  const addToCart = useCallback(async (item, stallId, stallData, quantity = 1) => {
    console.log('🛒 Adding to cart:', { itemName: item.name, quantity, stallId });
    
    if (!user) return;
    
    const newItem = {
      product_id: item.id,
      id: item.id,
      name: item.name,
      price: item.price,
      unit: item.unit,
      stall_id: stallId,
      stall_name: stallData?.stall_name,
      stall_number: stallData?.stall_number,
      section: stallData?.section,
      quantity: quantity,
      selected_unit: item.selected_unit || item.unit,
      selected_unit_label: item.selected_unit_label,
      original_price: item.original_price || item.price
    };

    const existingItemIndex = cart.findIndex(cartItem => cartItem.product_id === item.id);
    let updatedCart;
    
    if (existingItemIndex !== -1) {
      updatedCart = [...cart];
      updatedCart[existingItemIndex] = {
        ...updatedCart[existingItemIndex],
        quantity: updatedCart[existingItemIndex].quantity + quantity
      };
    } else {
      updatedCart = [...cart, newItem];
    }
    
    setCart(updatedCart);
    
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
      
      console.log('✅ Cart saved to database');
    } catch (dbError) {
      console.error('❌ Database error:', dbError);
    }
  }, [cart, user]);

  const updateQuantity = useCallback(async (productId, newQuantity) => {
    console.log('🔄 Updating quantity:', { productId, newQuantity });
    
    if (!user) return;
    
    if (newQuantity <= 0) {
      const updatedCart = cart.filter(item => item.product_id !== productId);
      setCart(updatedCart);
      await supabase
        .from('carts')
        .update({ items: updatedCart, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      return;
    }

    const updatedCart = cart.map(item => 
      item.product_id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    );
    setCart(updatedCart);

    await supabase
      .from('carts')
      .update({ items: updatedCart, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  }, [cart, user]);

  const removeItem = useCallback(async (productId) => {
    console.log('🗑️ Removing item:', productId);
    
    if (!user) return;
    
    const updatedCart = cart.filter(item => item.product_id !== productId);
    setCart(updatedCart);
    
    await supabase
      .from('carts')
      .update({ items: updatedCart, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  }, [cart, user]);

  const clearCart = useCallback(async () => {
    console.log('🗑️ Clearing cart');
    
    if (!user) return;
    
    // Clear local state first for immediate UI feedback
    setCart([]);
    
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
        console.error('❌ Error clearing cart in DB:', error);
      } else {
        console.log('✅ Cart cleared successfully in database');
      }
    } catch (error) {
      console.error('❌ Error clearing cart:', error);
    }
  }, [user]);

  const refreshCart = useCallback(async () => {
    console.log('🔄 Refreshing cart...');
    await fetchCart();
  }, [fetchCart]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  // Initial fetch
  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  return {
    cart,
    cartTotal,
    loading,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    refreshCart,
  };
};