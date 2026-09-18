import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/i18nContext';
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
import { fetchAllStallRatings } from '../../services/stallRatingsService';

export default function StallsDirectoryScreen({ navigation, isGuest }) {
  const COLORS = useColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [stalls, setStalls] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('All');
  const [loading, setLoading] = useState(true);

  const formatSection = (sec) => {
    if (!sec || sec === 'All') return t('stalls.all_sections', 'All');
    return t(`market_sections.${sec}`, sec);
  };
  // Real per-stall ratings — stalls.average_rating (used below before this
  // fix) is never written to by anything in the app, so every card's
  // rating silently never showed at all.
  const [stallRatingsMap, setStallRatingsMap] = useState({});

  useEffect(() => {
    fetchStalls();
    fetchAllStallRatings().then(setStallRatingsMap);
  }, []);

  const fetchStalls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .eq('is_active', true)
        .not('vendor_id', 'is', null)
        .order('stall_number');

      if (error) throw error;

      const activeStalls = (data || []).filter(s => s.is_active && s.vendor_id);
      setStalls(activeStalls);
      
      const uniqueSections = ['All', ...new Set(activeStalls.map(s => s.section))];
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
          {((stallRatingsMap[item.id]?.average ?? stallRatingsMap[String(item.id)]?.average ?? 0) > 0) && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingValue}>{(stallRatingsMap[item.id]?.average ?? stallRatingsMap[String(item.id)]?.average).toFixed(1)}</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.stallName}>{item.stall_name || t('stalls.vendor_fallback', 'Market Stall')}</Text>
        
        {item.section ? (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionText}>{formatSection(item.section)}</Text>
          </View>
        ) : null}
        
        {item.description ? (
          <Text style={styles.stallDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        
        <View style={styles.productCount}>
          <Text style={styles.productCountText}>{t('stalls.view_products', 'View Products →')}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>{t('stalls.loading_stalls', 'Loading stalls...')}</Text>
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
              {formatSection(section)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results Count */}
      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {filteredStalls.length === 1
            ? t('stalls.stall_count_singular', '1 Stall')
            : t('stalls.stall_count_plural', '%{count} Stalls', { count: filteredStalls.length })}
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
                ? t('stalls.empty_all', 'No active stalls available at the moment') 
                : t('stalls.empty_section', 'No active stalls found in %{section}', { section: formatSection(selectedSection) })}
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
    color: '#FFFFFF',
    fontWeight: '700',
  },
  countContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
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
    borderWidth: 1,
    borderColor: COLORS.borderLight,
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
    fontWeight: '700',
    color: COLORS.accent,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStar: {
    fontSize: 12,
  },
  ratingValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text.primary,
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
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  stallDescription: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  productCount: {
    marginTop: 4,
  },
  productCountText: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});