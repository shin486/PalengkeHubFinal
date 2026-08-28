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
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { PriceText } from './ui/PriceText';
import { VerdictChip } from './ui/VerdictChip';
import { RADIUS, LAYOUT, SPACING, TYPE } from '../theme/tokens';

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
  // Optional, all opt-in — every existing caller renders exactly as
  // before if it doesn't pass these. verdict/rating come from real
  // computed data (never fabricated); compareCount + onComparePress
  // together swap the footer button for "Ikumpara (N)" instead of
  // Add to Cart, since a card offering a comparison isn't also asking
  // for a cart add in the same breath.
  verdict,
  rating,
  ratingCount,
  compareCount,
  onComparePress,
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
        { transform: [{ scale: scaleAnim }], backgroundColor: COLORS.card },
        style,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: COLORS.card,
            borderColor: COLORS.border,
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
            <Badge tone="tomato" style={styles.discountBadge}>{discountText}</Badge>
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

          <View style={styles.priceVerdictRow}>
            <PriceText
              price={safePrice}
              unit={product?.unit}
              originalPrice={hasOriginal ? originalPrice : null}
              style={styles.priceRow}
            />
            {verdict ? <VerdictChip verdict={verdict} /> : null}
          </View>

          {priceTrend ? (
            <PriceTrendBadge currentPrice={safePrice} previousPrice={priceTrend.previous_price} />
          ) : null}

          {rating != null ? (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={COLORS.gold} />
              <Text style={[styles.ratingText, { color: COLORS.text.primary }]}>{Number(rating).toFixed(1)}</Text>
              {ratingCount != null ? (
                <Text style={[styles.ratingCount, { color: COLORS.text.tertiary }]}>({ratingCount})</Text>
              ) : null}
            </View>
          ) : null}

          {stall ? (
            <View style={styles.stallRow}>
              <Ionicons name="storefront-outline" size={12} color={COLORS.text.tertiary} />
              <Text style={[styles.stall, { color: COLORS.text.tertiary }]} numberOfLines={1}>
                {stall?.stall_name || `Stall ${stall?.stall_number}`}
              </Text>
            </View>
          ) : null}

          {compareCount > 1 && onComparePress ? (
            <Button
              variant="secondary"
              size="sm"
              shape="square"
              fullWidth
              onPress={onComparePress}
              style={styles.addButton}
            >
              {`Ikumpara (${compareCount})`}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              shape="square"
              fullWidth
              onPress={onAddToCart}
              style={styles.addButton}
            >
              Idagdag sa Kart
            </Button>
          )}
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
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: LAYOUT.borderWidth,
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
  priceVerdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  priceRow: {
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ratingCount: {
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
    marginTop: 2,
  },
});

