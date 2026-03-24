import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import StallMap from '../components/StallMap'; // 👈 ADD THIS IMPORT

export default function StallDetailsScreen({ route, navigation }) {
  const { stallId } = route.params;
  const [stall, setStall] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStallDetails();
  }, [stallId]);

  const fetchStallDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch stall details
      const { data: stallData, error: stallError } = await supabase
        .from('stalls')
        .select('*')
        .eq('id', stallId)
        .single();

      if (stallError) throw stallError;
      setStall(stallData);

      // Fetch stall products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('stall_id', stallId)
        .eq('is_available', true)
        .order('category');

      if (productsError) throw productsError;
      setProducts(productsData || []);

    } catch (error) {
      console.error('Error fetching stall:', error);
      Alert.alert('Error', 'Failed to load stall details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text>Loading stall details...</Text>
      </View>
    );
  }

  if (!stall) {
    return (
      <View style={styles.centerContainer}>
        <Text>Stall not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Stall Header */}
      <LinearGradient
        colors={['#FF6B6B', '#FF8E8E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.stallNumber}>Stall #{stall.stall_number}</Text>
        <Text style={styles.stallName}>{stall.stall_name || 'Market Stall'}</Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{stall.section}</Text>
        </View>
        
        {stall.average_rating > 0 && (
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingStar}>⭐</Text>
            <Text style={styles.ratingValue}>{stall.average_rating.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({stall.total_ratings || 0} ratings)</Text>
          </View>
        )}
      </LinearGradient>

      {/* ========== MAP SECTION - ADD THIS ========== */}
      <StallMap stall={stall} />

      {/* Stall Description */}
      {stall.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About this Stall</Text>
          <Text style={styles.description}>{stall.description}</Text>
        </View>
      )}

      {/* Location Info */}
      {stall.location_notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Details</Text>
          <Text style={styles.location}>{stall.location_notes}</Text>
        </View>
      )}

      {/* Products */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Products ({products.length})</Text>
        
        {products.length === 0 ? (
          <Text style={styles.emptyText}>No products available at this stall</Text>
        ) : (
          <View style={styles.productsList}>
            {products.map(product => (
              <TouchableOpacity
                key={product.id}
                style={styles.productCard}
                onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
              >
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productPrice}>₱{product.price}/{product.unit}</Text>
                </View>
                <View style={styles.productBadge}>
                  <Text style={styles.productCategory}>{product.category}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.rateButton}>
          <Text style={styles.rateButtonText}>⭐ Rate this Stall</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  header: {
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  stallNumber: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 5,
  },
  stallName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  sectionBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  sectionBadgeText: {
    color: 'white',
    fontSize: 14,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStar: {
    fontSize: 16,
    marginRight: 4,
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  location: {
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  productsList: {
    marginTop: 5,
  },
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  productBadge: {
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  productCategory: {
    fontSize: 12,
    color: '#666',
  },
  actionButtons: {
    padding: 20,
    backgroundColor: 'white',
    marginTop: 10,
    marginBottom: 20,
  },
  rateButton: {
    backgroundColor: '#FFB800',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  rateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});