import { useColors } from '../../contexts/ThemeContext';
import React, { useState, useMemo } from 'react';
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
import { useFavorites } from '../../hooks/useFavorites';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContext';

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
  } = useFavorites();
  const [activeTab, setActiveTab] = useState('products');

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
      {product.image_url ? (
        <Image source={{ uri: product.image_url }} style={styles.productImage} />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Text style={styles.productEmoji}>🛒</Text>
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productPrice}>₱{parseFloat(product.price || 0).toFixed(2)}</Text>
        <Text style={styles.productStall} numberOfLines={1}>{product.stall_name || ''}</Text>
      </View>
      <TouchableOpacity
        style={styles.heartBtn}
        onPress={() => toggleProductFavorite(product)}
      >
        <Text style={styles.heartIconFilled}>❤️</Text>
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
        {stall.image_url ? (
          <Image source={{ uri: stall.image_url }} style={styles.stallAvatar} />
        ) : (
          <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.stallAvatarGradient}>
            <Text style={styles.stallAvatarEmoji}>🏪</Text>
          </LinearGradient>
        )}
      </View>
      <View style={styles.stallInfo}>
        <Text style={styles.stallName} numberOfLines={1}>{stall.name || 'Stall'}</Text>
        {stall.stall_number && <Text style={styles.stallNumber}>Stall #{stall.stall_number}</Text>}
        {stall.section && <Text style={styles.stallSection}>{stall.section}</Text>}
        {stall.rating > 0 && (
          <Text style={styles.stallRating}>⭐ {parseFloat(stall.rating).toFixed(1)}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.heartBtn}
        onPress={() => toggleStallFavorite(stall)}
      >
        <Text style={styles.heartIconFilled}>❤️</Text>
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
            🛒 {t('favorites.products')} ({favoriteProducts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stalls' && styles.activeTab]}
          onPress={() => setActiveTab('stalls')}
        >
          <Text style={[styles.tabText, activeTab === 'stalls' && styles.activeTabText]}>
            🏪 {t('favorites.stalls')} ({favoriteStalls.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'products' ? (
          favoriteProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>❤️</Text>
              <Text style={styles.emptyTitle}>{t('favorites.empty_products')}</Text>
              <Text style={styles.emptyText}>{t('favorites.empty_products_subtitle')}</Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() => navigation.navigate('Home')}
              >
                <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.browseGradient}>
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
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyTitle}>{t('favorites.empty_stalls')}</Text>
            <Text style={styles.emptyText}>{t('favorites.empty_stalls_subtitle')}</Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => navigation.navigate('StallsDirectory')}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={styles.browseGradient}>
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
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
  },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.text.medium },
  activeTabText: { color: COLORS.text.white },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  emptyContainer: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text.dark, marginBottom: 8 },
  emptyText: { fontSize: 14, color: COLORS.text.light, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  browseBtn: { borderRadius: 12, overflow: 'hidden' },
  browseGradient: { paddingHorizontal: 24, paddingVertical: 14 },
  browseBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productCard: {
    width: '47%',
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
  productEmoji: { fontSize: 40 },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '600', color: COLORS.text.dark, marginBottom: 4 },
  productPrice: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  productStall: { fontSize: 11, color: COLORS.text.lighter },
  heartBtn: { position: 'absolute', top: 8, right: 8, padding: 4 },
  heartIconFilled: { fontSize: 18 },
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
  stallAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6' },
  stallAvatarGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  stallAvatarEmoji: { fontSize: 28 },
  stallInfo: { flex: 1 },
  stallName: { fontSize: 16, fontWeight: '700', color: COLORS.text.dark, marginBottom: 2 },
  stallNumber: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  stallSection: { fontSize: 12, color: COLORS.text.light, marginTop: 2 },
  stallRating: { fontSize: 12, color: '#F59E0B', marginTop: 4 },
});