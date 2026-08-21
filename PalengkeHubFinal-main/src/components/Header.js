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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

// ============================================================
// SPACING CONSTANTS
// ============================================================
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
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
                <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
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
                  <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {showCart && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onCartPress}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cart-outline" size={22} color="#FFFFFF" />
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
      </LinearGradient>
    </>
  );
};

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  header: {
    // Full width gradient - no horizontal padding to avoid white space in dark mode
    shadowColor: 'rgba(198,40,40,0.25)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
  },
  
  // ── Left Section ──
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(198,40,40,0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#C62828',
  },
  cartBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#C62828',
    textAlign: 'center',
    includeFontPadding: false,
  },
});

// ============================================================
// DEFAULT EXPORT
// ============================================================
export default Header;