import { useColors } from '../../contexts/ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
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
import { supabase } from '../../../lib/supabase';

export default function StallsDirectoryScreen({ navigation, isGuest }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
        .eq('is_active', true)
        .order('stall_number');

      if (error) throw error;

      setStalls(data || []);
      
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
        colors={[COLORS.surface, COLORS.background]}
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
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading stalls...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            activeOpacity={1}  // ← Disable opacity animation
          >
            <Text 
              style={[
                styles.filterChipText,
                selectedSection === section && styles.filterChipTextActive
              ]}
              numberOfLines={1}
            >
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
            <Text style={styles.emptyText}>
              {selectedSection === 'All' 
                ? 'No active stalls available at the moment' 
                : `No active stalls found in ${selectedSection}`}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.text.light,
  },
  filterScroll: {
    paddingVertical: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterChipText: {
    fontSize: 13,
    color: COLORS.text.tertiary,
  },
  filterChipTextActive: {
    color: COLORS.text.inverse,
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 14,
    color: COLORS.text.tertiary,
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  stallCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.shadowDark,
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
    color: COLORS.accent,
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
    color: COLORS.text.tertiary,
  },
  stallName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 8,
  },
  sectionBadge: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 11,
    color: COLORS.text.tertiary,
  },
  stallDescription: {
    fontSize: 13,
    color: COLORS.text.quaternary,
    lineHeight: 18,
    marginBottom: 12,
  },
  productCount: {
    marginTop: 4,
  },
  productCountText: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.text.quaternary,
    textAlign: 'center',
  },
});