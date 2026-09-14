import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useColors } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/i18nContext';

const StarRow = ({ rating, size = 14 }) => {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <View style={{ flexDirection: 'row' }}>
      {[...Array(full)].map((_, i) => <Ionicons key={`f${i}`} name="star" size={size} color="#F59E0B" />)}
      {half && <Ionicons name="star-half" size={size} color="#F59E0B" />}
      {[...Array(empty)].map((_, i) => <Ionicons key={`e${i}`} name="star-outline" size={size} color="#D1D5DB" />)}
    </View>
  );
};

export default function StallReviewsScreen({ route }) {
  const COLORS = useColors();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { stallId, stallName } = route.params;

  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchRatings = useCallback(async () => {
    try {
      // consumer_id -> id/full_name/avatar_url only, deliberately no email —
      // this is a public reviews list, not a place to expose a reviewer's
      // account email to every other customer who opens the stall page.
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          id, rating, review, vendor_reply, vendor_reply_at, created_at,
          consumer:consumer_id (id, full_name, avatar_url),
          product:product_id (id, name)
        `)
        .eq('stall_id', stallId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRatings(data || []);
    } catch (error) {
      console.error('Error fetching stall reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stallId]);

  useFocusEffect(
    useCallback(() => {
      fetchRatings();
    }, [fetchRatings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRatings();
  };

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratings.forEach(r => { if (distribution[r.rating] !== undefined) distribution[r.rating]++; });
  const totalRatings = ratings.length;
  const averageRating = totalRatings > 0
    ? (ratings.reduce((sum, r) => sum + (parseFloat(r.rating) || 0), 0) / totalRatings)
    : 0;

  const filteredRatings = activeFilter === 'all'
    ? ratings
    : ratings.filter(r => r.rating === parseInt(activeFilter, 10));

  const renderReviewCard = ({ item }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.customerInfo}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerAvatarText}>
              {item.consumer?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.customerName}>{item.consumer?.full_name || t('stall_reviews.customer_fallback', 'Customer')}</Text>
            <Text style={styles.reviewDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        </View>
        <StarRow rating={item.rating} />
      </View>

      {item.product?.name && (
        <View style={styles.productTag}>
          <Ionicons name="pricetag-outline" size={11} color={COLORS.text.tertiary} />
          <Text style={styles.productTagText}>{item.product.name}</Text>
        </View>
      )}

      {item.review && <Text style={styles.reviewText}>{item.review}</Text>}

      {item.vendor_reply && (
        <View style={styles.replyBlock}>
          <Text style={styles.replyLabel}>{t('stall_reviews.vendor_reply', 'Reply from vendor')}</Text>
          <Text style={styles.replyText}>{item.vendor_reply}</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{t('stall_reviews.loading', 'Loading reviews...')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <Text style={styles.stallName}>{stallName}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{averageRating.toFixed(1)}</Text>
            <StarRow rating={averageRating} size={16} />
            <Text style={styles.summaryLabel}>
              {totalRatings === 1
                ? t('stall_reviews.review_singular', '1 review')
                : t('stall_reviews.review_plural', '%{count} reviews', { count: totalRatings })}
            </Text>
          </View>
          <View style={styles.distributionCard}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = distribution[star];
              const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
              return (
                <View key={star} style={styles.distributionRow}>
                  <Text style={styles.distributionStar}>{star}</Text>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <View style={styles.distributionBarTrack}>
                    <View style={[styles.distributionBarFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.distributionCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {totalRatings === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={40} color={COLORS.text.quaternary} />
            <Text style={styles.emptyTitle}>{t('stall_reviews.no_reviews_title', 'No reviews yet')}</Text>
            <Text style={styles.emptyText}>{t('stall_reviews.no_reviews_desc', 'Reviews left after an order from this stall will show up here.')}</Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
              {['all', '5', '4', '3', '2', '1'].map(filter => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>
                    {filter === 'all' ? t('stall_reviews.filter_all', 'All') : `${filter}★`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FlatList
              data={filteredRatings}
              keyExtractor={item => item.id.toString()}
              renderItem={renderReviewCard}
              scrollEnabled={false}
              contentContainerStyle={styles.reviewList}
            />
          </>
        )}
      </ScrollView>
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
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.text.tertiary,
  },
  stallName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  summaryCard: {
    width: 110,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginTop: 6,
    textAlign: 'center',
  },
  distributionCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 2,
  },
  distributionStar: {
    width: 10,
    fontSize: 11,
    color: COLORS.text.tertiary,
  },
  distributionBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 3,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  distributionBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  distributionCount: {
    width: 18,
    fontSize: 10,
    color: COLORS.text.tertiary,
    textAlign: 'right',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSecondary,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  reviewList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  reviewCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  reviewDate: {
    fontSize: 10,
    color: COLORS.text.quaternary,
    marginTop: 1,
  },
  productTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  productTagText: {
    fontSize: 11,
    color: COLORS.text.tertiary,
  },
  reviewText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  replyBlock: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  replyText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    lineHeight: 17,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
