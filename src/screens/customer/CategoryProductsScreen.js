import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../lib/supabase';

export default function CategoryProductsScreen({ route, navigation }) {
  const { categoryName, categoryIcon, categoryColor } = route.params;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProductsByCategory();
  }, []);

  const fetchProductsByCategory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          stalls (
            stall_number,
            stall_name,
            section
          )
        `)
        .eq('category', categoryName)
        .eq('is_available', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with category */}
      <View style={[styles.header, { backgroundColor: categoryColor }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>{categoryIcon}</Text>
          <Text style={styles.headerTitle}>{categoryName}</Text>
          <Text style={styles.headerSubtitle}>
            {products.length} products available
          </Text>
        </View>
      </View>

      {/* Products List */}
      {products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No products found in this category</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
            >
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>₱{item.price}/{item.unit}</Text>
                <View style={styles.productMeta}>
                  <Text style={styles.stallName}>
                    Stall {item.stalls?.stall_number}
                  </Text>
                  <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
                    <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                      {item.category}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  backText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  productCard: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
    marginBottom: 8,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stallName: {
    fontSize: 14,
    color: '#666',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});