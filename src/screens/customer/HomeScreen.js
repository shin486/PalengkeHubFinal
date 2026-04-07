import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';

const colors = {
  primary: '#6366F1',
  secondary: '#8B5CF6',
};

export default function HomeScreen({ isGuest = false, navigation }) {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [stalls, setStalls] = useState([]);
  const [selectedSection, setSelectedSection] = useState('All');
  const [loading, setLoading] = useState(true);

  // Categories for shoppers to browse
  const categories = [
    { id: 1, name: 'Meat', icon: '🥩', color: '#FF6B6B' },
    { id: 2, name: 'Vegetables', icon: '🥬', color: '#4CAF50' },
    { id: 3, name: 'Fish', icon: '🐟', color: '#2196F3' },
    { id: 4, name: 'Fruits', icon: '🍎', color: '#FF9800' },
    { id: 5, name: 'Dairy', icon: '🥛', color: '#9C27B0' },
    { id: 6, name: 'Dry Goods', icon: '📦', color: '#795548' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch stalls for directory
      const { data: stallsData } = await supabase
        .from('stalls')
        .select('*')
        .order('stall_number');
      setStalls(stallsData || []);

      // Fetch featured products (recently added)
      const { data: productsData } = await supabase
        .from('products')
        .select('*, stalls(stall_number, stall_name)')
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(10);
      setFeaturedProducts(productsData || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sections = ['All', ...new Set(stalls.map(s => s.section))];
  const filteredStalls = selectedSection === 'All' 
    ? stalls 
    : stalls.filter(s => s.section === selectedSection);

  return (
    <ScrollView style={styles.container}>
      {/* Guest Banner */}
      {isGuest && (
        <View style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>👋 You're browsing as a guest</Text>
          <Text style={styles.guestBannerSubtext}>Sign in to save your cart and place orders</Text>
        </View>
      )}

      {/* Categories Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        <View style={styles.categoriesGrid}>
          {categories.map(cat => (
            <TouchableOpacity 
              key={cat.id} 
              style={styles.categoryCard}
              onPress={() => navigation.navigate('CategoryProducts', {
                categoryName: cat.name,
                categoryIcon: cat.icon,
                categoryColor: cat.color
              })}
            >
              <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                <Text style={styles.categoryIconText}>{cat.icon}</Text>
              </View>
              <Text style={styles.categoryName}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Featured Products Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {featuredProducts.map(product => (
            <TouchableOpacity 
              key={product.id} 
              style={styles.featuredCard}
              onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
            >
              <View style={styles.productImagePlaceholder}>
                <Text style={styles.productEmoji}>🛒</Text>
              </View>
              <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.productPrice}>₱{product.price}</Text>
              <Text style={styles.productStall}>Stall {product.stalls?.stall_number}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stalls Directory Section */}
      <View style={styles.section}>
        <View style={styles.stallsHeader}>
          <Text style={styles.sectionTitle}>Browse by Section</Text>
          <TouchableOpacity onPress={() => navigation.navigate('StallsDirectory')}>
            <Text style={styles.seeAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Section Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {sections.map((section, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.filterChip,
                selectedSection === section && styles.filterChipActive
              ]}
              onPress={() => setSelectedSection(section)}
            >
              <Text style={[
                styles.filterChipText,
                selectedSection === section && styles.filterChipTextActive
              ]}>
                {section}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stalls Grid */}
        <View style={styles.stallsGrid}>
          {filteredStalls.slice(0, 4).map(stall => (
            <TouchableOpacity 
              key={stall.id} 
              style={styles.stallCard}
              onPress={() => navigation.navigate('StallDetails', { stallId: stall.id })}
            >
              <Text style={styles.stallNumber}>Stall #{stall.stall_number}</Text>
              <Text style={styles.stallName}>{stall.stall_name || 'Market Stall'}</Text>
              <View style={styles.stallSection}>
                <Text style={styles.stallSectionText}>{stall.section}</Text>
              </View>
              {stall.average_rating > 0 && (
                <Text style={styles.stallRating}>⭐ {stall.average_rating.toFixed(1)}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        {filteredStalls.length > 4 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('StallsDirectory')}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.viewAllGradient}
            >
              <Text style={styles.viewAllText}>View All Stalls</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  guestBanner: {
    backgroundColor: '#FFE5E5',
    padding: 15,
    margin: 10,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  guestBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  guestBannerSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  stallsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAll: {
    fontSize: 14,
    color: '#FF6B6B',
  },
  // Categories Styles
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 15,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIconText: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: 12,
    color: '#333',
  },
  // Featured Products Styles
  featuredCard: {
    width: 140,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  productImagePlaceholder: {
    height: 80,
    backgroundColor: '#f1f3f5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  productEmoji: {
    fontSize: 24,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  productStall: {
    fontSize: 11,
    color: '#999',
  },
  // Stalls Directory Styles
  filterScroll: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f1f3f5',
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#FF6B6B',
  },
  filterChipText: {
    fontSize: 14,
    color: '#495057',
  },
  filterChipTextActive: {
    color: 'white',
  },
  stallsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  stallCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  stallNumber: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
    marginBottom: 4,
  },
  stallName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  stallSection: {
    backgroundColor: '#f1f3f5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  stallSectionText: {
    fontSize: 11,
    color: '#666',
  },
  stallRating: {
    fontSize: 12,
    color: '#FFB800',
  },
  viewAllButton: {
    marginTop: 10,
  },
  viewAllGradient: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewAllText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});