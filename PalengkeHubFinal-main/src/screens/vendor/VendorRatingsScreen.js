import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Header } from '../../components/Header';

export default function VendorRatingsScreen({ navigation }) {
  const { user } = useAuth();
  const [stall, setStall] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [productRatings, setProductRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRating, setSelectedRating] = useState(null);
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', '5', '4', '3', '2', '1'

  // Fetch stall info
  useEffect(() => {
    fetchStall();
  }, []);

  const fetchStall = async () => {
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select('id, stall_number, stall_name')
        .eq('vendor_id', user?.id)
        .single();
      if (error) throw error;
      setStall(data);
    } catch (error) {
      console.error('Error fetching stall:', error);
    }
  };

  // Fetch ratings
  const fetchRatings = useCallback(async () => {
    if (!stall?.id) return;
    try {
      setLoading(true);
      
      // Fetch all ratings for this stall with product and customer info
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          *,
          consumer:consumer_id (id, full_name, email, avatar_url),
          product:product_id (id, name, price, unit)
        `)
        .eq('stall_id', stall.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRatings(data || []);

      // Group by product for analytics
      const productMap = new Map();
      data?.forEach(rating => {
        const productId = rating.product_id;
        if (!productMap.has(productId) && rating.product) {
          productMap.set(productId, {
            id: productId,
            name: rating.product.name,
            totalRatings: 0,
            sumRatings: 0,
            averageRating: 0,
          });
        }
        if (productMap.has(productId)) {
          const product = productMap.get(productId);
          product.totalRatings++;
          product.sumRatings += rating.rating;
          product.averageRating = product.sumRatings / product.totalRatings;
        }
      });
      
      const productData = Array.from(productMap.values())
        .sort((a, b) => b.averageRating - a.averageRating);
      setProductRatings(productData);
    } catch (error) {
      console.error('Error fetching ratings:', error);
      Alert.alert('Error', 'Failed to load ratings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stall]);

  // Submit vendor reply
  const submitReply = async () => {
    if (!replyText.trim()) {
      Alert.alert('Error', 'Please enter a reply');
      return;
    }

    setSubmittingReply(true);
    try {
      const { error } = await supabase
        .from('ratings')
        .update({ 
          vendor_reply: replyText.trim(),
          vendor_reply_at: new Date().toISOString(),
          vendor_reply_read: false
        })
        .eq('id', selectedRating.id);

      if (error) throw error;

      Alert.alert('Success', 'Your reply has been sent to the customer');
      setReplyModalVisible(false);
      setReplyText('');
      setSelectedRating(null);
      fetchRatings(); // Refresh the list
    } catch (error) {
      console.error('Error submitting reply:', error);
      Alert.alert('Error', 'Failed to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  // Delete rating (admin only or vendor can request removal)
  const handleDeleteRating = (rating) => {
    Alert.alert(
      'Remove Rating',
      'Are you sure you want to remove this rating? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('ratings')
                .delete()
                .eq('id', rating.id);
              if (error) throw error;
              Alert.alert('Success', 'Rating removed');
              fetchRatings();
            } catch (error) {
              console.error('Error deleting rating:', error);
              Alert.alert('Error', 'Failed to remove rating');
            }
          }
        }
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      if (stall?.id) {
        fetchRatings();
      }
    }, [stall, fetchRatings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRatings();
  };

  const getStarRating = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text key={i} style={[styles.starIcon, i <= rating ? styles.starFilled : styles.starEmpty]}>
          {i <= rating ? '★' : '☆'}
        </Text>
      );
    }
    return stars;
  };

  const getAverageRating = () => {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / ratings.length).toFixed(1);
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratings.forEach(r => {
      distribution[r.rating]++;
    });
    return distribution;
  };

  const filteredRatings = () => {
    if (activeFilter === 'all') return ratings;
    return ratings.filter(r => r.rating === parseInt(activeFilter));
  };

  const renderStarFilter = () => {
    const distribution = getRatingDistribution();
    const filters = ['all', '5', '4', '3', '2', '1'];
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {filters.map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              activeFilter === filter && styles.filterChipActive
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[
              styles.filterChipText,
              activeFilter === filter && styles.filterChipTextActive
            ]}>
              {filter === 'all' ? 'All' : `★ ${filter}`}
              {filter !== 'all' && distribution[parseInt(filter)] > 0 && (
                <Text style={styles.filterCount}> ({distribution[parseInt(filter)]})</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderRatingCard = ({ item }) => (
    <View style={styles.ratingCard}>
      <View style={styles.ratingHeader}>
        <View style={styles.customerInfo}>
          <View style={styles.customerAvatar}>
            <Text style={styles.customerAvatarText}>
              {item.consumer?.full_name?.charAt(0)?.toUpperCase() || '👤'}
            </Text>
          </View>
          <View>
            <Text style={styles.customerName}>{item.consumer?.full_name || 'Customer'}</Text>
            <Text style={styles.ratingDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
        </View>
        <View style={styles.ratingStars}>
          {getStarRating(item.rating)}
        </View>
      </View>

      {item.product && (
        <View style={styles.productInfo}>
          <Text style={styles.productLabel}>Product:</Text>
          <Text style={styles.productName}>{item.product.name}</Text>
          <Text style={styles.productPrice}>₱{item.product.price}/{item.product.unit}</Text>
        </View>
      )}

      {item.review && (
        <View style={styles.reviewContainer}>
          <Text style={styles.reviewLabel}>Review:</Text>
          <Text style={styles.reviewText}>{item.review}</Text>
        </View>
      )}

      {item.vendor_reply ? (
        <View style={styles.replyContainer}>
          <View style={styles.replyHeader}>
            <Text style={styles.replyLabel}>Your Reply:</Text>
            <Text style={styles.replyDate}>
              {new Date(item.vendor_reply_at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={styles.replyText}>{item.vendor_reply}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.replyButton}
          onPress={() => {
            setSelectedRating(item);
            setReplyText('');
            setReplyModalVisible(true);
          }}
        >
          <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.replyGradient}>
            <Text style={styles.replyButtonText}>📝 Reply to Review</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteRating(item)}
      >
        <Text style={styles.deleteButtonText}>🗑️ Remove</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Loading ratings...</Text>
      </View>
    );
  }

  const distribution = getRatingDistribution();
  const totalRatings = ratings.length;
  const averageRating = getAverageRating();

  return (
    <View style={styles.container}>
      <Header title="Rating Insights" subtitle={stall?.stall_name || 'View customer feedback'} showBack />
      
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#DC2626']} />}
      >
        {/* Summary Stats */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{averageRating}</Text>
            <View style={styles.summaryStars}>
              {getStarRating(parseFloat(averageRating))}
            </View>
            <Text style={styles.summaryLabel}>Average Rating</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalRatings}</Text>
            <Text style={styles.summaryLabel}>Total Reviews</Text>
          </View>
        </View>

        {/* Rating Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rating Distribution</Text>
          {[5, 4, 3, 2, 1].map(star => {
            const count = distribution[star];
            const percentage = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
            return (
              <View key={star} style={styles.distributionRow}>
                <Text style={styles.distributionStar}>{star} ★</Text>
                <View style={styles.distributionBarContainer}>
                  <View style={[styles.distributionBar, { width: `${percentage}%`, backgroundColor: star >= 4 ? '#10B981' : star === 3 ? '#F59E0B' : '#EF4444' }]} />
                </View>
                <Text style={styles.distributionCount}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* Product Performance */}
        {productRatings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Product Performance</Text>
            {productRatings.map(product => (
              <View key={product.id} style={styles.productRatingCard}>
                <Text style={styles.productRatingName}>{product.name}</Text>
                <View style={styles.productRatingRow}>
                  <View style={styles.productRatingStars}>
                    {getStarRating(Math.round(product.averageRating))}
                  </View>
                  <Text style={styles.productRatingScore}>{product.averageRating.toFixed(1)}</Text>
                  <Text style={styles.productRatingCount}>({product.totalRatings} reviews)</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Reviews List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📝 Customer Reviews</Text>
          </View>
          {renderStarFilter()}
          
          {filteredRatings().length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>⭐</Text>
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptyText}>When customers leave reviews, they'll appear here</Text>
            </View>
          ) : (
            <FlatList
              data={filteredRatings()}
              keyExtractor={item => item.id.toString()}
              renderItem={renderRatingCard}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>

      {/* Reply Modal */}
      <Modal
        visible={replyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReplyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reply to Review</Text>
            <Text style={styles.modalSubtitle}>
              Respond to {selectedRating?.consumer?.full_name || 'customer'}
            </Text>
            
            <View style={styles.modalRating}>
              {getStarRating(selectedRating?.rating || 0)}
            </View>
            
            {selectedRating?.review && (
              <View style={styles.modalOriginalReview}>
                <Text style={styles.modalOriginalLabel}>Original review:</Text>
                <Text style={styles.modalOriginalText}>"{selectedRating.review}"</Text>
              </View>
            )}
            
            <TextInput
              style={styles.replyInput}
              placeholder="Type your reply here..."
              placeholderTextColor="#9CA3AF"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              numberOfLines={4}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setReplyModalVisible(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.submitModalButton, submittingReply && styles.disabledButton]}
                onPress={submitReply}
                disabled={submittingReply}
              >
                <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.submitGradient}>
                  <Text style={styles.submitButtonText}>
                    {submittingReply ? 'Sending...' : 'Send Reply'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginTop: 12,
    color: '#6B7280',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  summaryStars: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  starIcon: {
    fontSize: 16,
    marginRight: 2,
  },
  starFilled: {
    color: '#F59E0B',
  },
  starEmpty: {
    color: '#D1D5DB',
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  distributionStar: {
    width: 40,
    fontSize: 12,
    color: '#6B7280',
  },
  distributionBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  distributionBar: {
    height: '100%',
    borderRadius: 4,
  },
  distributionCount: {
    width: 30,
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
  },
  productRatingCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  productRatingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  productRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productRatingStars: {
    flexDirection: 'row',
    marginRight: 8,
  },
  productRatingScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    marginRight: 4,
  },
  productRatingCount: {
    fontSize: 11,
    color: '#6B7280',
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#DC2626',
  },
  filterChipText: {
    fontSize: 12,
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: 'white',
  },
  filterCount: {
    fontSize: 10,
  },
  ratingCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  ratingDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  ratingStars: {
    flexDirection: 'row',
  },
  productInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  productLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 2,
  },
  productName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
  },
  productPrice: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 2,
  },
  reviewContainer: {
    marginBottom: 10,
  },
  reviewLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  reviewText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  replyContainer: {
    backgroundColor: '#FEF3F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#DC2626',
  },
  replyDate: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  replyText: {
    fontSize: 12,
    color: '#374151',
  },
  replyButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  replyGradient: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalRating: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalOriginalReview: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  modalOriginalLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  modalOriginalText: {
    fontSize: 13,
    color: '#374151',
    fontStyle: 'italic',
  },
  replyInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelModalButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelModalText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  submitModalButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});