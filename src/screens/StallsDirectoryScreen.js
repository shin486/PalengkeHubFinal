import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

export default function StallsDirectoryScreen({ navigation, isGuest }) {
  const [stalls, setStalls] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStalls();
  }, []);

  const fetchStalls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .order('stall_number');

      if (error) throw error;

      setStalls(data || []);
      
      // Get unique sections
      const uniqueSections = ['All', ...new Set(data.map(s => s.section))];
      setSections(uniqueSections);
      
    } catch (error) {
      console.error('Error fetching stalls:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStalls = selectedSection === 'All' 
    ? stalls 
    : stalls.filter(s => s.section === selectedSection);

  const renderStallCard = ({ item }) => (
    <TouchableOpacity
      style={styles.stallCard}
      onPress={() => navigation.navigate('StallDetails', { stallId: item.id })}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB']}
        style={styles.stallGradient}
      >
        <View style={styles.stallHeader}>
          <Text style={styles.stallNumber}>#{item.stall_number}</Text>
          {item.average_rating > 0 && (
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingStar}>⭐</Text>
              <Text style={styles.ratingValue}>{item.average_rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.stallName}>{item.stall_name || 'Market Stall'}</Text>
        
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionText}>{item.section}</Text>
        </View>
        
        {item.description && (
          <Text style={styles.stallDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.productCount}>
          <Text style={styles.productCountText}>View Products →</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading stalls...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stalls Directory</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Section Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
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

      {/* Results Count */}
      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {filteredStalls.length} {filteredStalls.length === 1 ? 'Stall' : 'Stalls'}
        </Text>
      </View>

      {/* Stalls List */}
      <FlatList
        data={filteredStalls}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderStallCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No stalls found in this section</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FF6B6B',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  filterScroll: {
    paddingVertical: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: 'white',
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 14,
    color: '#6B7280',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  stallCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  stallGradient: {
    padding: 16,
  },
  stallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stallNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingStar: {
    fontSize: 12,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  stallName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  sectionBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 11,
    color: '#6B7280',
  },
  stallDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
    marginBottom: 12,
  },
  productCount: {
    marginTop: 4,
  },
  productCountText: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});