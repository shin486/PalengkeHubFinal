// src/components/Header.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../contexts/ThemeContext';
import { SPACING, LAYOUT, TEXT_STYLES } from '../theme/tokens';

const { width } = Dimensions.get('window');

// ============================================================
// MAIN COMPONENT
// ============================================================
export const Header = ({
  title,
  subtitle,
  showBack = false,
  onBackPress,
  showNotifications = false,
  showCart = false,
  cartCount = 0,
  onNotificationPress,
  onCartPress,
  rightComponent,
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const COLORS = useColors();
  const styles = createStyles(COLORS);

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigation.goBack();
    }
  };

  // Determine if we should show right actions
  const showRightActions = showNotifications || showCart || rightComponent;

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.md,
            paddingBottom: SPACING.lg,
          },
        ]}
      >
        <View style={styles.headerContent}>
          {/* Left Section: Back Button + Logo */}
          <View style={styles.leftSection}>
            {showBack && (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={24} color={COLORS.text.primary} />
              </TouchableOpacity>
            )}

            <View style={[styles.logoContainer, showBack && styles.logoWithBack]}>
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../assets/palengkehublogo.jpg')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>

          {/* Center Section: Title + Subtitle */}
          <View style={styles.centerSection}>
            <Text style={styles.title} numberOfLines={1}>
              {title || 'PalengkeHub'}
            </Text>
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          {/* Right Section: Action Buttons */}
          {showRightActions && (
            <View style={styles.rightSection}>
              {showNotifications && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onNotificationPress}
                  activeOpacity={0.7}
                >
                  <Ionicons name="notifications-outline" size={22} color={COLORS.text.primary} />
                </TouchableOpacity>
              )}

              {showCart && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onCartPress}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cart-outline" size={22} color={COLORS.text.primary} />
                  {cartCount > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>
                        {cartCount > 9 ? '9+' : cartCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {rightComponent}
            </View>
          )}
        </View>
      </View>
    </>
  );
};

// ============================================================
// STYLES
// ============================================================
const createStyles = (COLORS) => StyleSheet.create({
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: LAYOUT.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: LAYOUT.headerMinHeight,
    paddingHorizontal: SPACING.lg,
  },

  // ── Left Section ──
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: LAYOUT.minTapTarget,
    height: LAYOUT.minTapTarget,
    borderRadius: LAYOUT.minTapTarget / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.wickerSoft,
    marginRight: SPACING.sm,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWithBack: {
    marginLeft: SPACING.xs,
  },
  logoWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.wickerSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  // ── Center Section ──
  centerSection: {
    flex: 1,
    marginHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  title: {
    ...TEXT_STYLES.h2,
    color: COLORS.text.primary,
    includeFontPadding: false,
  },
  subtitle: {
    ...TEXT_STYLES.caption,
    color: COLORS.text.tertiary,
    marginTop: 1,
    includeFontPadding: false,
  },

  // ── Right Section ──
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionButton: {
    width: LAYOUT.minTapTarget,
    height: LAYOUT.minTapTarget,
    borderRadius: LAYOUT.minTapTarget / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.wickerSoft,
    position: 'relative',
  },

  // ── Cart Badge ──
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    includeFontPadding: false,
  },
});

// ============================================================
// DEFAULT EXPORT
// ============================================================
export default Header;
