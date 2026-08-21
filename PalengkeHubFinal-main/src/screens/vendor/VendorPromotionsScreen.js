// src/screens/vendor/VendorPromotionsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorPromotions } from '../../hooks/useVendorPromotions';
import { useVendorProducts } from '../../hooks/useVendorProducts';
import { PromotionModal } from '../../components/vendor/PromotionModal';
import { VendorSkeletonList } from '../../components/vendor/VendorLoadingState';
import { VendorEmptyState } from '../../components/vendor/VendorEmptyState';
import {
  vendorColors,
  vendorSpacing,
  vendorBorderRadius,
  vendorShadows,
} from '../../theme/vendorTheme';

const formatDate = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

export default function VendorPromotionsScreen({ navigation }) {
  const { user } = useAuth();
  const [stall, setStall] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStall = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('stalls')
        .select('id, stall_number, stall_name')
        .eq('vendor_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setStall(data);
    } catch (error) {
      console.error('Error fetching stall:', error);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchStall();
    }, [fetchStall])
  );

  const {
    promotions,
    loading,
    createPromotion,
    updatePromotion,
    togglePromotion,
    deletePromotion,
    refreshPromotions,
  } = useVendorPromotions(stall?.id);

  const {
    products,
    loading: productsLoading,
  } = useVendorProducts(stall?.id);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshPromotions(), fetchStall()]);
    setRefreshing(false);
  };

  const handleSubmit = async (payload) => {
    if (editingPromotion) {
      await updatePromotion(editingPromotion.id, payload);
    } else {
      await createPromotion(payload);
    }
    setEditingPromotion(null);
  };

  const renderPromotion = ({ item }) => {
    const isActive = item.is_active;
    const discountText = item.discount_type === 'percentage'
      ? `${item.discount_value}% OFF`
      : `₱${item.discount_value} OFF`;

    return (
      <View style={styles.promotionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.productInfo}>
            {item.product?.image_url ? (
              <Image source={{ uri: item.product.image_url }} style={styles.productImage} />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Ionicons name="image-outline" size={24} color={vendorColors.text.tertiary} />
              </View>
            )}
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={1}>{item.product?.name || 'Product'}</Text>
              <Text style={styles.productMeta}>{item.product?.unit || ''}</Text>
            </View>
          </View>
          <Switch
            value={isActive}
            onValueChange={() => togglePromotion(item)}
            trackColor={{ false: '#D1D5DB', true: vendorColors.success }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>₱{item.original_price?.toFixed(2)}</Text>
          <Ionicons name="arrow-forward" size={14} color={vendorColors.text.tertiary} />
          <Text style={styles.discountedPrice}>₱{item.discounted_price?.toFixed(2)}</Text>
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{discountText}</Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color={vendorColors.text.tertiary} />
          <Text style={styles.dateText}>
            {formatDate(item.start_date)} - {formatDate(item.end_date)}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => setEditingPromotion(item)}
          >
            <Ionicons name="create-outline" size={14} color={vendorColors.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => deletePromotion(item.id)}
          >
            <Ionicons name="trash-outline" size={14} color={vendorColors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Special Prices" subtitle={stall?.stall_name || 'Manage your promotions'} showBack onBackPress={() => navigation.goBack()} />

      {/* Add Promotion Button */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => { setEditingPromotion(null); setShowModal(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="pricetag-outline" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>New Special Price</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <VendorSkeletonList count={4} />
      ) : promotions.length === 0 ? (
        <VendorEmptyState
          icon="pricetag-outline"
          title="No special prices yet"
          message="Create a special price to attract more customers with discounts"
          actionLabel="Create Special Price"
          onAction={() => { setEditingPromotion(null); setShowModal(true); }}
        />
      ) : (
        <FlatList
          data={promotions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPromotion}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[vendorColors.primary]} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <PromotionModal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditingPromotion(null); }}
        onSubmit={handleSubmit}
        editingPromotion={editingPromotion}
        products={products}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: vendorColors.background,
  },
  addButtonContainer: {
    padding: vendorSpacing.lg,
    paddingBottom: 0,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: vendorColors.primary,
    paddingVertical: 14,
    borderRadius: vendorBorderRadius.md,
    shadowColor: vendorColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    padding: vendorSpacing.lg,
    paddingBottom: vendorSpacing.xxxl,
  },
  promotionCard: {
    backgroundColor: vendorColors.surface,
    borderRadius: vendorBorderRadius.lg,
    padding: vendorSpacing.lg,
    marginBottom: vendorSpacing.md,
    borderWidth: 1,
    borderColor: vendorColors.border,
    ...vendorShadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vendorSpacing.md,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: vendorBorderRadius.md,
    marginRight: vendorSpacing.md,
  },
  productImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: vendorBorderRadius.md,
    backgroundColor: vendorColors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: vendorSpacing.md,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: vendorColors.text.primary,
  },
  productMeta: {
    fontSize: 12,
    color: vendorColors.text.secondary,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: vendorSpacing.sm,
  },
  originalPrice: {
    fontSize: 14,
    color: vendorColors.text.tertiary,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: vendorColors.primary,
  },
  discountBadge: {
    backgroundColor: vendorColors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: vendorBorderRadius.sm,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: vendorColors.success,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: vendorSpacing.md,
  },
  dateText: {
    fontSize: 12,
    color: vendorColors.text.secondary,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: vendorColors.divider,
    paddingTop: vendorSpacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: vendorBorderRadius.sm,
  },
  editBtn: {
    backgroundColor: vendorColors.surfaceAlt,
    borderWidth: 1,
    borderColor: vendorColors.border,
  },
  editBtnText: {
    fontSize: 11,
    color: vendorColors.primary,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: vendorColors.dangerLight,
    borderWidth: 1,
    borderColor: vendorColors.danger,
  },
});