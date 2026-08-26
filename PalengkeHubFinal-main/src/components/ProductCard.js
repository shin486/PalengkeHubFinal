// src/components/ProductCard.js
// Canonical, reusable product card for the customer module.
//
// Improvements over the legacy card (hardcoded cart-icon placeholder, `#FF6B6B`
// price, `#4CAF50` buttons):
//  - Real product images (product.image_url) with a fade-in on load + a
//    cart-outline placeholder fallback (LoadingSpinner-style).
//  - Palette routed through useColors() (via customerTheme tokens).
//  - Wishlist heart toggle (persistent via useFavorites -> FavoritesScreen).
//  - Keeps the voice "read aloud" button + PriceTrendBadge differentiators.
//  - 2-column friendly: width '48%' by default, overridable via `style`;
//    min-height keeps rows an equal height.
//  - Sensible activeOpacity (0.8) + press scale animation.

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../contexts/ThemeContext';
import { useFavorites } from '../hooks/useFavorites';
import { speak } from '../services/voiceService';
import { PriceTrendBadge } from './PriceTrendBadge';

const IMAGE_FADE = 180;

export const ProductCard = ({
  product,
  stall,
  onPress,
  onAddToCart,
  priceTrend,
  discountText,
  hasPromotion = false,
  // Wishlist: "controlled" when onToggleWishlist is provided (correct pattern
  // for lists — avoids N favorites hooks). Falls back to internal useFavorites().
  isWishlisted,
  onToggleWishlist,
  showVoice = true,
  style,
  imageStyle,
}) => {
  const COLORS = useColors();
  const fav = useFavorites();
  const controlled = onToggleWishlist != null;
  const wishlisted = controlled ? !!isWishlisted : fav.isProductFavorite(product?.id);

  const toggleWishlist = () => {
    if (!product?.id) return;
    if (controlled) {
      onToggleWishlist(product);
    } else {
      fav.toggleProductFavorite(product);
    }
  };

  const readAloud = () => {
    if (!product) return;
    speak(
      `${product.name}. Presyo, ${product.price} pesos, bawat ${product.unit || 'unit'}.`,
      { language: 'fil-PH' },
    );
  };

  const [imageError, setImageError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleImageLoad = () => {
    Animated.timing(fadeAnim, { toValue: 1, duration: IMAGE_FADE, useNativeDriver: true }).start();
  };

  const pressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  };
  const pressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start();
  };

  // Original price exists in two shapes across the app (original_price / originalPrice)
  const originalPrice = hasPromotion
    ? (product?.original_price ?? product?.originalPrice ?? product?.price)
    : null;
  const hasOriginal = hasPromotion && originalPrice != null && Number(originalPrice) > 0;
  const safePrice = Number(product?.price) || 0;

    return (
    <Animated.View
      style={[
        styles.cardWrapper,
        { transform: [{ scale: scaleAnim }], backgroundColor: COLORS.surface },
        style,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: COLORS.surface,
            borderColor: COLORS.borderLight,
            shadowColor: COLORS.shadow,
          },
        ]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={0.8}
      >
        <View style={styles.imageContainer}>
          {product?.image_url && !imageError ? (
            <Animated.Image
              source={{ uri: product.image_url }}
              style={[styles.image, { opacity: fadeAnim }, imageStyle]}
              onLoad={handleImageLoad}
              onError={() => setImageError(true)}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: COLORS.inputBg }]}>
              <Ionicons name="cart-outline" size={34} color={COLORS.text.tertiary} />
            </View>
          )}

          {/* Wishlist heart (top-right of image) */}
          <TouchableOpacity
            style={[
              styles.wishlistBtn,
              { backgroundColor: COLORS.surface, shadowColor: COLORS.shadow },
            ]}
            onPress={toggleWishlist}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={wishlisted ? 'heart' : 'heart-outline'}
              size={19}
              color={wishlisted ? COLORS.error : COLORS.text.tertiary}
            />
          </TouchableOpacity>

          {/* Promotion badge */}
          {hasPromotion && discountText ? (
            <View style={[styles.discountBadge, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.discountText}>{discountText}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: COLORS.text.primary }]} numberOfLines={2}>
              {product?.name || 'Product'}
            </Text>
            {showVoice && (
              <TouchableOpacity
                style={styles.speakBtn}
                onPress={readAloud}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="volume-medium-outline" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.priceRow}>
            {hasOriginal ? (
              <Text style={[styles.originalPrice, { color: COLORS.text.tertiary }]}>
                ₱{Number(originalPrice).toFixed(2)}
              </Text>
            ) : null}
            <Text style={[styles.price, { color: COLORS.primary }]}>
              ₱{safePrice.toFixed(2)}
            </Text>
            {product?.unit ? (
              <Text style={[styles.unit, { color: COLORS.text.tertiary }]}>/ {product.unit}</Text>
            ) : null}
          </View>

          {priceTrend ? (
            <PriceTrendBadge currentPrice={safePrice} previousPrice={priceTrend.previous_price} />
          ) : null}

          {stall ? (
            <View style={styles.stallRow}>
              <Ionicons name="storefront-outline" size={12} color={COLORS.text.tertiary} />
              <Text style={[styles.stall, { color: COLORS.text.tertiary }]} numberOfLines={1}>
                {stall?.stall_name || `Stall ${stall?.stall_number}`}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: COLORS.success }]}
            onPress={onAddToCart}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  cardWrapper: {
    width: '48%',
    marginBottom: 12,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: 110,
    backgroundColor: '#F3F4F6',
  },
  imagePlaceholder: {
    width: '100%',
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  body: {
    padding: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  speakBtn: {
    padding: 2,
    marginLeft: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginBottom: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  unit: {
    fontSize: 11,
  },
  stallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  stall: {
    fontSize: 11,
    flexShrink: 1,
  },
  addButton: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

