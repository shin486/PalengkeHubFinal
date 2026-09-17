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

import React, { useState, useRef, useEffect } from 'react';
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
import { useI18n } from '../contexts/i18nContext';
import { useFavorites } from '../hooks/useFavorites';
import { speak } from '../services/voiceService';
import { PriceTrendBadge } from './PriceTrendBadge';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { PriceText } from './ui/PriceText';
import { VerdictChip } from './ui/VerdictChip';
import { RADIUS, LAYOUT, SPACING, TYPE } from '../theme/tokens';
import { getProductFallbackPhoto } from '../utils/productPhotoFallbacks';
import { getProductPriceRange } from '../utils/priceRange';
import { getProductEnglishName } from '../utils/productNameTranslations';

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
  const { t } = useI18n();
  const fav = useFavorites();
  const controlled = onToggleWishlist != null;
  const wishlisted = controlled ? !!isWishlisted : fav.isProductFavorite(product?.id);

  // React Native's native responder system gives a nested touchable
  // exclusive claim to a press, so only the heart's own onPress fires
  // there -- but react-native-web compiles this down to real DOM nodes
  // with real bubbling, which doesn't know about that native semantic.
  // Without stopping it here, tapping the heart also bubbled up to the
  // outer card's onPress and navigated to product details, which could
  // read as "favoriting doesn't work" if the screen changes before a
  // shopper even sees the heart fill in.
  const toggleWishlist = (e) => {
    e?.stopPropagation?.();
    if (!product?.id) return;
    if (controlled) {
      onToggleWishlist(product);
    } else {
      fav.toggleProductFavorite(product);
    }
  };

  const readAloud = (e) => {
    e?.stopPropagation?.();
    if (!product) return;
    speak(
      `${product.name}. Presyo, ${product.price} pesos, bawat ${product.unit || 'unit'}.`,
      { language: 'fil-PH' },
    );
  };

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  // The curated fallback had no error handling of its own -- if that
  // specific bundled asset ever failed to render (a bad require(),
  // corrupted file), there was no third tier to drop to, just a blank
  // box where even the generic icon should have appeared.
  const [fallbackError, setFallbackError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Safety net for a class of bug already found once (a stale/dead
  // image_url — e.g. a leftover link from before a storage migration —
  // that fails to load without ever firing onError on every platform,
  // leaving a permanently blank box instead of the fallback chain
  // below). If neither onLoad nor onError has resolved within a few
  // seconds, force the same fallback anyway.
  useEffect(() => { setImageLoaded(false); }, [product?.image_url]);
  useEffect(() => {
    if (!product?.image_url || imageError || imageLoaded) return;
    const timer = setTimeout(() => setImageError(true), 4000);
    return () => clearTimeout(timer);
  }, [product?.image_url, imageError, imageLoaded]);

  const handleImageLoad = () => {
    setImageLoaded(true);
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
  const fallbackPhoto = (!product?.image_url || imageError) && !fallbackError ? getProductFallbackPhoto(product?.name) : null;

  const priceRange = getProductPriceRange(product);
  const hasPriceRange = !!priceRange;
  const rangeMin = priceRange?.min;
  const rangeMax = priceRange?.max;
  const englishName = getProductEnglishName(product?.name);

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
          ) : fallbackPhoto ? (
            <Animated.Image
              source={fallbackPhoto}
              style={[styles.image, { opacity: fadeAnim }, imageStyle]}
              onLoad={handleImageLoad}
              onError={() => setFallbackError(true)}
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
            <Badge tone="tomatoSolid" style={styles.discountBadge}>{discountText}</Badge>
          ) : null}

          {/* This thumbnail is too small for a real gallery — vendors can
              save up to 3 photos (image_urls), but this card only ever
              showed the cover photo with no sign more existed. Mirrors the
              vendor-side ModernProductCard.js photoCountBadge. */}
          {Array.isArray(product?.image_urls) && product.image_urls.length > 1 ? (
            <View style={styles.photoCountBadge}>
              <Ionicons name="images-outline" size={9} color="#FFFFFF" />
              <Text style={styles.photoCountText}>{product.image_urls.length}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <View style={styles.nameCol}>
              <Text style={[styles.name, { color: COLORS.text.primary }]} numberOfLines={2}>
                {product?.name || 'Product'}
              </Text>
              {/* Reserve this line's height unconditionally (design-system
                  Product Card bilingual convention, e.g. "Kamatis" / "Tomato")
                  so a product without a mapped translation doesn't end up
                  shorter than its grid neighbor that has one -- same
                  uneven-row trap the cardWrapper minHeight comment above
                  already had to work around once. */}
              <Text style={[styles.nameEnglish, { color: COLORS.text.tertiary }]} numberOfLines={1}>
                {englishName || ' '}
              </Text>
            </View>
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
              price={hasPriceRange ? rangeMin : safePrice}
              maxPrice={hasPriceRange ? rangeMax : undefined}
              unit={product?.unit}
              originalPrice={hasOriginal ? originalPrice : null}
              stacked
              style={styles.priceRow}
              amountStyle={styles.priceAmount}
            />
            {verdict ? <VerdictChip verdict={verdict} /> : null}
          </View>

          {/* Fixed-height slot regardless of whether a badge actually
              renders inside it -- PriceTrendBadge can itself return null
              (negligible delta, no valid previous price) even when
              priceTrend is truthy, so "conditionally render the row" was
              exactly the uneven-grid trap the name-subtitle fix above and
              the cardWrapper minHeight already had to work around once:
              a card with a real, visible price move ends up one whole
              badge taller than its row-mate without one. */}
          <View style={styles.trendSlot}>
            {priceTrend ? (
              <PriceTrendBadge currentPrice={safePrice} previousPrice={priceTrend.previous_price} />
            ) : null}
          </View>

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
              {t('product_card.compare_count', `Ikumpara (${compareCount})`, { count: compareCount })}
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
              {t('product_card.add_to_cart', 'Idagdag sa Kart')}
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
    // Card height is otherwise fully content-driven -- a card whose
    // product has a rating, a stall row, and a price-trend badge ends up
    // visibly taller than a neighbor missing all three, which is what
    // makes a 2-column grid look uneven row to row. Pinning a shared
    // minHeight (sized for the tallest realistic combination: image +
    // 2-line name + English subtitle + price + trend badge + rating +
    // stall + button) keeps every card the same height; one with less
    // optional content just gets a little empty space below its button
    // instead of being visibly shorter than its row-mate.
    minHeight: 330,
  },
  card: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: LAYOUT.borderWidth,
  },
  // 1:1 square (design system "Product Card": aspect-ratio 1/1), not a
  // fixed pixel height -- a fixed height on a variable-width card (2-up
  // on a phone, more columns at wider breakpoints) crops a different
  // fraction of the photo per column count, which is what read as an
  // uneven, "not smooth" grid; a square scales with the card so every
  // photo keeps the same crop and every row lines up cleanly.
  //
  // The aspect ratio lives on this container, not on the <Image> itself
  // -- React Native Web's Image doesn't reliably honor aspectRatio on
  // its own (it fell back to each photo's natural, usually portrait,
  // proportions, producing a wildly uneven grid instead of a square
  // one). A plain View's aspectRatio is far more consistently supported
  // across native and web, so the image/placeholder below just fill it.
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  // Explicit top radius on the image itself, not just reliance on the
  // parent card's overflow:hidden clip — that clip doesn't reliably
  // round an Image's own corners on every platform (React Native Web
  // in particular), which is what left this square on the web preview.
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
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
  photoCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  photoCountText: {
    fontSize: 9,
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
  nameCol: {
    flex: 1,
  },
  // ".pcard .nm"/".en" -- no font-family override in the design system,
  // inherits the body's Nunito (this file never set Baloo 2 here, so no
  // family fix needed, just size/weight).
  name: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  nameEnglish: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 1,
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
  // ".priceline .amt" has no font-family override, inheriting the
  // body's Nunito -- PriceText's shared default pulls in the Baloo 2
  // display font instead (meant only for actual heading elements). Kept
  // as a local opt-in via PriceText's amountStyle rather than changing
  // that shared default, since other not-yet-reviewed screens use it too.
  priceAmount: {
    fontFamily: 'Nunito_900Black',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  // Matches PriceTrendBadge's own rendered height (paddingVertical 3+3,
  // ~15px line at fontSize 12, marginBottom 4) so reserving this slot
  // when the badge is absent doesn't leave a visibly different gap than
  // when it's present.
  trendSlot: {
    minHeight: 25,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ratingCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  stallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  stall: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  addButton: {
    marginTop: 2,
  },
});

