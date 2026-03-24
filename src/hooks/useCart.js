import { useState, useEffect } from 'react';
import { Alert } from 'react-native';

// Create a singleton cart store outside the hook
let globalCart = [];
let listeners = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener(globalCart));
};

const updateCart = (newCart) => {
  globalCart = newCart;
  notifyListeners();
};

export const useCart = () => {
  const [cart, setLocalCart] = useState(globalCart);

  useEffect(() => {
    // Listen for global cart changes
    const listener = (newCart) => {
      setLocalCart(newCart);
    };
    listeners.push(listener);
    
    // Cleanup
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  const addToCart = (product) => {
    console.log('➕🔴 addToCart called with:', product?.name);
    console.log('➕🔴 Current global cart:', globalCart);
    
    if (!product || !product.id) {
      console.error('❌ Invalid product:', product);
      return;
    }
    
    const existingItem = globalCart.find(item => item.id === product.id);
    let newCart;
    
    if (existingItem) {
      console.log('📦 Updating quantity for:', product.name);
      newCart = globalCart.map(item =>
        item.id === product.id
          ? { ...item, quantity: (item.quantity || 1) + 1 }
          : item
      );
    } else {
      console.log('✨ Adding new item:', product.name);
      newCart = [...globalCart, { ...product, quantity: 1 }];
    }
    
    console.log('✨ New cart length:', newCart.length);
    updateCart(newCart);
    Alert.alert('Success', `${product.name} added to cart!`);
  };

  const removeFromCart = (productId) => {
    const newCart = globalCart.filter(item => item.id !== productId);
    updateCart(newCart);
  };

  const updateQuantity = (productId, change) => {
    const newCart = globalCart
      .map(item =>
        item.id === productId
          ? { ...item, quantity: Math.max(1, (item.quantity || 1) + change) }
          : item
      )
      .filter(item => item.quantity > 0);
    updateCart(newCart);
  };

  const clearCart = () => {
    updateCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartTotal,
    cartCount: cart.length,
  };
};