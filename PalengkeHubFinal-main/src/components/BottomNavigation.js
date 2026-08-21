// src/components/BottomNavigation.js

import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

// ============================================================
// COLORS - PalengkeHub Branding
// ============================================================
// Theme-aware colors are now provided by ThemeContext via useColors().
// ============================================================

// ============================================================
// SPACING CONSTANTS
// ============================================================
const SPACING = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function BottomNavigation({
  state,
  navigation,
  descriptors,
  cartCount = 0,
  unreadChatCount = 0,
}) {
  const insets = useSafeAreaInsets();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const animatedValues = useRef({});

  // Initialize animated values for each tab
  useEffect(() => {
    state.routes.forEach((route, index) => {
      if (!animatedValues.current[index]) {
        animatedValues.current[index] = {
          scale: new Animated.Value(1),
          translateY: new Animated.Value(0),
          opacity: new Animated.Value(0),
        };
      }
    });
  }, [state.routes]);

  // ✅ Animate the active tab: pop the icon and fade in its indicator
  useEffect(() => {
    state.routes.forEach((route, index) => {
      const anim = animatedValues.current[index];
      if (!anim) return;
      const isFocused = state.index === index;
      Animated.parallel([
        Animated.spring(anim.translateY, {
          toValue: isFocused ? -3 : 0,
          useNativeDriver: true,
          tension: 220,
          friction: 12,
        }),
        Animated.timing(anim.opacity, {
          toValue: isFocused ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      if (isFocused) {
        Animated.sequence([
          Animated.spring(anim.scale, { toValue: 1.12, useNativeDriver: true, tension: 300, friction: 8 }),
          Animated.spring(anim.scale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 8 }),
        ]).start();
      }
    });
  }, [state.index, state.routes]);

  // Handle tab press with animation
  const handlePress = (route, index) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(route.name);
    }

    // Animate the pressed tab
    const anim = animatedValues.current[index];
    if (anim) {
      Animated.sequence([
        Animated.spring(anim.scale, {
          toValue: 0.88,
          useNativeDriver: true,
          tension: 200,
          friction: 8,
        }),
        Animated.spring(anim.scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 8,
        }),
      ]).start();
    }
  };

  // Get icon name and label for each route
  const getTabConfig = (routeName, isFocused) => {
    const configs = {
      Home: {
        icon: isFocused ? 'home' : 'home-outline',
        label: 'Home',
      },
      Cart: {
        icon: isFocused ? 'cart' : 'cart-outline',
        label: 'PalengKart',
      },
      Orders: {
        icon: isFocused ? 'receipt' : 'receipt-outline',
        label: 'Orders',
      },
      Chats: {
        icon: isFocused ? 'chatbubble' : 'chatbubble-outline',
        label: 'Chats',
      },
      Profile: {
        icon: isFocused ? 'person' : 'person-outline',
        label: 'Profile',
      },
    };
    return configs[routeName] || configs.Home;
  };

  // Render badge
  const renderBadge = (count, max = 9) => {
    if (count === 0) return null;
    return (
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeText}>
          {count > max ? `${max}+` : count}
        </Text>
      </View>
    );
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        { 
          paddingBottom: insets.bottom || SPACING.sm,
        }
      ]}
    >
      <View style={styles.navBar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = getTabConfig(route.name, isFocused);
          const anim = animatedValues.current[index];

          // Determine if this tab should show a badge
          let badgeCount = 0;
          if (route.name === 'Cart') {
            badgeCount = cartCount;
          } else if (route.name === 'Chats') {
            badgeCount = unreadChatCount;
          }

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItem}
              onPress={() => handlePress(route, index)}
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.tabContent,
                  {
                    transform: [
                      { scale: anim?.scale || 1 },
                      { translateY: anim?.translateY || 0 },
                    ],
                  },
                ]}
              >
                <View style={styles.iconWrapper}>
                  <Ionicons
                    name={config.icon}
                    size={20}
                    color={isFocused ? COLORS.primary : COLORS.text.lighter}
                  />
                  {badgeCount > 0 && (
                    <View style={[
                      styles.badgeContainer,
                      styles.badgeOverlay,
                    ]}>
                      <Text style={styles.badgeText}>
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.tabLabel,
                  isFocused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}>
                  {config.label}
                </Text>
                {isFocused && (
                  <Animated.View style={[styles.activeIndicator, { opacity: anim?.opacity || 0 }]} />
                )}
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ============================================================
// STYLES
// ============================================================
const createStyles = (COLORS) => StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 3,
    paddingBottom: 3,
    height: 56,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
    marginBottom: 1,
    overflow: 'visible',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 1,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: COLORS.text.lighter,
    fontWeight: '500',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },

  // ── Badge Styles ──
  badgeContainer: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  badgeOverlay: {
    top: -8,
    right: -10,
    minWidth: 18,
    height: 18,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
});