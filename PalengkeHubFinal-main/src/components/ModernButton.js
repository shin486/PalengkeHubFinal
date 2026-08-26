// src/components/ModernButton.js
// Shared, theme-aware button with primary (gradient) / outline / ghost variants,
// an optional loading spinner and an icon slot.
// Backward compatible: callers that passed { title, onPress, gradient, style,
// textStyle } still work; default variant is primary.

import React, { useRef, useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector/icons';
import { useColors } from '../contexts/ThemeContext';
import { customerGradients } from '../theme/customerTheme';

export const ModernButton = ({
  title,
  onPress,
  variant = 'primary', // 'primary' | 'outline' | 'ghost'
  gradient = customerGradients.primary,
  loading = false,
  disabled = false,
  iconName,
  iconPosition = 'left',
  style,
  textStyle,
  activeOpacity = 0.85,
}) => {
  const COLORS = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 3 }).start();
    if (!loading && !disabled && onPress) onPress();
  };

  const isStroke = variant === 'outline' || variant === 'ghost';
  const iconColor = isStroke ? COLORS.primary : '#FFFFFF';
  const textColor = isStroke ? COLORS.primary : '#FFFFFF';

  const containerStyle = useMemo(
    () => [
      styles.button,
      style,
      { transform: [{ scale: scaleAnim }] },
      disabled && { opacity: 0.6 },
      isStroke && { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary },
    ],
    [style, scaleAnim, disabled, isStroke, COLORS],
  );

  const renderContent = () => (
    <>
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <>
          {iconName && iconPosition === 'left' && (
            <Ionicons name={iconName} size={18} color={iconColor} style={styles.iconLeft} />
          )}
          <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
          {iconName && iconPosition === 'right' && (
            <Ionicons name={iconName} size={18} color={iconColor} style={styles.iconRight} />
          )}
        </>
      )}
    </>
  );

  if (isStroke) {
    // Outline / ghost — no gradient, theme border + text
    return (
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={activeOpacity}
        disabled={disabled || loading}
        style={containerStyle}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  // Primary — gradient with scale micro-interaction
  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={disabled || loading}
    >
      <Animated.View style={[styles.button, style, { transform: [{ scale: scaleAnim }], overflow: 'hidden' }]}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {renderContent()}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  iconLeft: { marginRight: 4 },
  iconRight: { marginLeft: 4 },
});
