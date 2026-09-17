import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContext';
import { getProductFallbackPhoto } from '../../utils/productPhotoFallbacks';

// Own component (not inline in renderProductItem, which is a plain closure
// called from a loop — can't safely use per-item state there) so each
// thumbnail can track its own image load failure independently. A stale
// image_url (e.g. a leftover link from before the Supabase Storage
// migration) rendered nothing at all with no onError handling — not
// broken, not a placeholder, just blank space.
const FavoriteProductThumb = ({ product, style, placeholderStyle }) => {
  const COLORS = useColors();
  const [imageError, setImageError] = useState(false);
  const fallbackPhoto = (!product.image_url || imageError) ? getProductFallbackPhoto(product.name) : null;

  if (product.image_url && !imageError) {
    return <Image source={{ uri: product.image_url }} style={style} onError={() => setImageError(true)} />;
  }
  if (fallbackPhoto) {
    return <Image source={fallbackPhoto} style={style} resizeMode="cover" />;
  }
  return (
    <View style={placeholderStyle}>
      <Ionicons name="cart-outline" size={24} color={COLORS.text.tertiary} />
    </View>
  );
};

// Same reasoning as FavoriteProductThumb above — stalls have no curated
// fallback photo, but still need onError so a broken image_url falls back
// to the existing gradient/icon instead of rendering blank.
const FavoriteStallAvatar = ({ stall, colors }) => {
  const [imageError, setImageError] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (stall.image_url && !imageError) {
    return <Image source={{ uri: stall.image_url }} style={styles.stallAvatar} onError={() => setImageError(true)} />;
  }
  return (
    <LinearGradient colors={[colors.primary, colors.primaryDark || colors.primary]} style={styles.stallAvatarGradient}>
      <Ionicons name="storefront-outline" size={24} color="#FFFFFF" />
    </LinearGradient>
  );
};

export default function FavoritesScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { t } = useI18n();
  const { user } = useAuth();
  const {
    favoriteProducts,
    favoriteStalls,
    loading,
    toggleProductFavorite,
    toggleStallFavorite,
    refreshFavorites,
  } = useFavorites();
  const [activeTab, setActiveTab] = useState('products');

  // useFavorites() has no shared/global state -- every call site (every
  // ProductCard, HomeScreen, this screen, ProfileScreen...) mounts its
  // own independent copy, fetched once on mount. Toggling a favorite
  // elsewhere never updates THIS screen's already-mounted copy, so
  // without this a favorite added on Home wouldn't show here until a
  // full app reload. refreshFavorites() already existed for exactly
  // this but nothing was calling it.
  useFocusEffect(
    useCallback(() => {
      refreshFavorites();
    }, [refreshFavorites])
  );

  const handleProductPress = (product) => {
    navigation.navigate('ProductDetails', { productId: product.id });
  };

  const handleStallPress = (stall) => {
    navigation.navigate('StallDetails', { stallId: stall.id });
  };

  const renderProductItem = (product) => (
    <TouchableOpacity
      key={product.id}
      style={styles.productCard}
      onPress={() => handleProductPress(product)}
      activeOpacity={0.7}
    >
      <FavoriteProductThumb product={product} style={styles.productImage} placeholderStyle={styles.productImagePlaceholder} />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productPrice}>₱{parseFloat(product.price || 0).toFixed(2)}</Text>
        <Text style={styles.productStall} numberOfLines={1}>{product.stall_name || ''}</Text>
      </View>
      <TouchableOpacity
        style={styles.heartBtn}
        onPress={() => toggleProductFavorite(product)}
      >
        <Ionicons name="heart" size={18} color={COLORS.error || '#EF4444'} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderStallItem = (stall) => (
    <TouchableOpacity
      key={stall.id}
      style={styles.stallCard}
      onPress={() => handleStallPress(stall)}
      activeOpacity={0.7}
    >
      <View style={styles.stallAvatarContainer}>
        <FavoriteStallAvatar stall={stall} colors={COLORS} />
      </View>
      <View style={styles.stallInfo}>
        <Text style={styles.stallName} numberOfLines={1}>{stall.name || t('stalls.vendor_fallback', 'Market Stall')}</Text>
        {stall.stall_number && <Text style={styles.stallNumber}>{t('stalls.stall_number', { number: stall.stall_number })}</Text>}
        {stall.section && <Text style={styles.stallSection}>{stall.section}</Text>}
        {stall.rating > 0 && (
          <Text style={styles.stallRating}>⭐ {parseFloat(stall.rating).toFixed(1)}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.heartBtn}
        onPress={() => toggleStallFavorite(stall)}
      >
        <Ionicons name="heart" size={18} color={COLORS.error || '#EF4444'} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Tab Toggle */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.activeTab]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
            {t('favorites.products')} ({favoriteProducts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stalls' && styles.activeTab]}
          onPress={() => setActiveTab('stalls')}
        >
          <Text style={[styles.tabText, activeTab === 'stalls' && styles.activeTabText]}>
            {t('favorites.stalls')} ({favoriteStalls.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'products' ? (
          favoriteProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="heart-outline" size={44} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('favorites.empty_products')}</Text>
              <Text style={styles.emptyText}>{t('favorites.empty_products_subtitle')}</Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => navigation.navigate('Home')}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[COLORS.primary, COLORS.primaryDark || COLORS.primary]} style={styles.browseGradient}>
                  <Text style={styles.browseBtnText}>{t('favorites.browse_products')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.productsGrid}>
              {favoriteProducts.map(renderProductItem)}
            </View>
          )
        ) : favoriteStalls.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="storefront-outline" size={44} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('favorites.empty_stalls')}</Text>
            <Text style={styles.emptyText}>{t('favorites.empty_stalls_subtitle')}</Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => navigation.navigate('StallsDirectory')}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark || COLORS.primary]} style={styles.browseGradient}>
                <Text style={styles.browseBtnText}>{t('favorites.browse_stalls')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          favoriteStalls.map(renderStallItem)
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSecondary || COLORS.borderLight,
  },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.text.secondary },
  activeTabText: { color: '#FFFFFF', fontWeight: '700' },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  emptyContainer: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text.primary, marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 14, color: COLORS.text.secondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  browseBtn: { borderRadius: 12, overflow: 'hidden' },
  browseGradient: { paddingHorizontal: 24, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  browseBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  productImage: { width: '100%', height: 120, backgroundColor: COLORS.inputBg },
  productImagePlaceholder: { height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.inputBg },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '600', color: COLORS.text.primary, marginBottom: 4 },
  productPrice: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  productStall: { fontSize: 11, color: COLORS.text.tertiary },
  heartBtn: { position: 'absolute', top: 8, right: 8, padding: 6, backgroundColor: COLORS.surface, borderRadius: 16, shadowColor: COLORS.shadowDark || '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  stallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  stallAvatarContainer: { marginRight: 14 },
  stallAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.surfaceSecondary },
  stallAvatarGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  stallInfo: { flex: 1 },
  stallName: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary, marginBottom: 2 },
  stallNumber: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  stallSection: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },
  stallRating: { fontSize: 12, color: COLORS.gold || '#F59E0B', marginTop: 4, fontWeight: '600' },
});