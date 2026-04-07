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
      
      const { data, error } = await supabase
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
        
        if (data.length > 1) {
          console.log('⚠️ Found duplicate carts, cleaning up...');
          const oldCartIds = data.slice(1).map(c => c.id);
          await supabase.from('carts').delete().in('id', oldCartIds);
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
      quantity: quantity
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
    
    setCart([]);
    
    await supabase
      .from('carts')
      .update({ items: [], updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
  }, [user]);

  const refreshCart = useCallback(async () => {
    await fetchCart();
  }, [fetchCart]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

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