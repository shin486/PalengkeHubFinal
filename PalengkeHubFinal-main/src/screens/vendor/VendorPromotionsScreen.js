// src/screens/vendor/VendorPromotionsScreen.js
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Switch,
  Alert,
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
import { useColors } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/i18nContext';
import {
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
  const { t } = useI18n();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
                <Ionicons name="image-outline" size={24} color={COLORS.text.tertiary} />
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
            trackColor={{ false: COLORS.border, true: COLORS.success }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.originalPrice}>₱{item.original_price?.toFixed(2)}</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.text.tertiary} />
          <Text style={styles.discountedPrice}>₱{item.discounted_price?.toFixed(2)}</Text>
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{discountText}</Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.text.tertiary} />
          <Text style={styles.dateText}>
            {formatDate(item.start_date)} - {formatDate(item.end_date)}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => { setEditingPromotion(item); setShowModal(true); }}
          >
            <Ionicons name="create-outline" size={14} color={COLORS.primary} />
            <Text style={styles.editBtnText}>{t('common.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => {
              Alert.alert(
                t('vendor.delete_special_price_title'),
                t('vendor.delete_special_price_confirm'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('common.delete'), style: 'destructive', onPress: () => deletePromotion(item.id) },
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={14} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header title={t('vendor.special_prices')} subtitle={stall?.stall_name || t('vendor.special_prices_subtitle')} showBack onBackPress={() => navigation.goBack()} />

      {/* Add Promotion Button */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => { setEditingPromotion(null); setShowModal(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="pricetag-outline" size={20} color={COLORS.text.inverse} />
          <Text style={styles.addButtonText}>{t('vendor.new_special_price')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <VendorSkeletonList count={4} />
      ) : promotions.length === 0 ? (
        <VendorEmptyState
          icon="pricetag-outline"
          title={t('vendor.no_special_prices')}
          message={t('vendor.no_special_prices_msg')}
          actionLabel={t('vendor.create_special_price')}
          onAction={() => { setEditingPromotion(null); setShowModal(true); }}
        />
      ) : (
        <FlatList
          data={promotions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPromotion}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
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

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: vendorBorderRadius.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: COLORS.text.inverse,
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    padding: vendorSpacing.lg,
    paddingBottom: vendorSpacing.xxxl,
  },
  promotionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: vendorBorderRadius.lg,
    padding: vendorSpacing.lg,
    marginBottom: vendorSpacing.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.surfaceSecondary,
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
    color: COLORS.text.primary,
  },
  productMeta: {
    fontSize: 12,
    color: COLORS.text.secondary,
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
    color: COLORS.text.tertiary,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  discountBadge: {
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: vendorBorderRadius.sm,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.success,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: vendorSpacing.md,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
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
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBtnText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: COLORS.errorLight,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
});