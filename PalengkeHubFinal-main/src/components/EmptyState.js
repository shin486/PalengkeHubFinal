import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const EmptyState = ({
  icon = 'cube-outline',
  title = 'Nothing here yet',
  subtitle = '',
  actionLabel = '',
  onAction = null,
  colors = {},
}) => {
  const themeColors = {
    icon: '#9CA3AF',
    title: '#6B7280',
    subtitle: '#9CA3AF',
    background: '#FFFFFF',
    iconBg: '#F3F4F6',
    buttonBg: '#C62828',
    buttonText: '#FFFFFF',
    ...colors,
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: themeColors.iconBg }]}>
        <Ionicons name={icon} size={48} color={themeColors.icon} />
      </View>
      <Text style={[styles.title, { color: themeColors.title }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: themeColors.subtitle }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onAction}
          style={styles.buttonWrapper}
        >
          <LinearGradient
            colors={['#C62828', '#E53935']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Ionicons name="arrow-forward" size={16} color={themeColors.buttonText} />
            <Text style={[styles.buttonText, { color: themeColors.buttonText }]}>{actionLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonWrapper: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});