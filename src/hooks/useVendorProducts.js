import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

export const useVendorProducts = (stallId) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    if (!stallId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('stall_id', stallId)
        .order('category')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [stallId]);

  const addProduct = async (productData) => {
    if (!stallId) {
      Alert.alert('Error', 'No stall assigned');
      return false;
    }

    try {
      const { error } = await supabase
        .from('products')
        .insert([{
          stall_id: stallId,
          name: productData.name.trim(),
          description: productData.description?.trim() || null,
          price: productData.price,
          unit: productData.unit,
          category: productData.category,
          is_available: productData.is_available ?? true,
        }]);

      if (error) throw error;
      
      Alert.alert('Success', 'Product added successfully');
      await fetchProducts();
      return true;
    } catch (error) {
      console.error('Error adding product:', error);
      Alert.alert('Error', error.message || 'Failed to add product');
      return false;
    }
  };

  const updateProduct = async (productId, updates) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: updates.name?.trim(),
          description: updates.description?.trim() || null,
          price: updates.price,
          unit: updates.unit,
          category: updates.category,
          is_available: updates.is_available,
          updated_at: new Date(),
        })
        .eq('id', productId);

      if (error) throw error;
      
      Alert.alert('Success', 'Product updated successfully');
      await fetchProducts();
      return true;
    } catch (error) {
      console.error('Error updating product:', error);
      Alert.alert('Error', error.message || 'Failed to update product');
      return false;
    }
  };

  const deleteProduct = async (productId) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', productId);

              if (error) throw error;
              
              Alert.alert('Success', 'Product deleted successfully');
              await fetchProducts();
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Error', 'Failed to delete product');
            }
          }
        }
      ]
    );
  };

  const toggleAvailability = async (product) => {
    return updateProduct(product.id, { is_available: !product.is_available });
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleAvailability,
    refreshProducts: fetchProducts,
  };
};