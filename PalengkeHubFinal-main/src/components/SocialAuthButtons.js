// Google/Facebook sign-in tiles. Styling adapted from the squircle icon
// dock at https://uiverse.io/Itskrish01/modern-mouse-31 (gradient tile,
// soft shadow, press-scale) — true CSS clip-path squircles and
// backdrop-blur don't exist in React Native, so the shape is approximated
// with borderRadius and the dark glass container swapped for a card that
// matches this app's actual light theme, using the app's existing
// PressableScale for the press feedback instead of the original's
// hover-only web transition.
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { PressableScale } from './ui/PressableScale';
import { useColors } from '../contexts/ThemeContext';
import { hapticLight } from '../theme/motion';

const GoogleIcon = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24 c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <Path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <Path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <Path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571 c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24 C44,22.659,43.862,21.35,43.611,20.083z"/>
  </Svg>
);

const FacebookIcon = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF">
    <Path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
  </Svg>
);

const PROVIDERS = [
  { id: 'google', label: 'Google', Icon: GoogleIcon, gradient: ['#FFFFFF', '#F1F3F4'], borderColor: '#DADCE0' },
  { id: 'facebook', label: 'Facebook', Icon: FacebookIcon, gradient: ['#1877F2', '#0C5DC7'], borderColor: 'transparent' },
];

// onPress receives the provider id ('google' | 'facebook').
// loadingProvider shows a spinner on just that one tile mid-flow.
export const SocialAuthButtons = ({ onPress, loadingProvider = null, disabled = false, label = 'Continue with' }) => {
  const COLORS = useColors();
  const styles = createStyles(COLORS);
  const isBusy = !!loadingProvider;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {PROVIDERS.map(({ id, label: providerLabel, Icon, gradient, borderColor }) => {
          const isLoadingThis = loadingProvider === id;
          return (
            <PressableScale
              key={id}
              onPress={() => {
                if (disabled || isBusy) return;
                hapticLight();
                onPress(id);
              }}
              disabled={disabled || isBusy}
              style={styles.tileShadow}
              accessibilityRole="button"
              accessibilityLabel={`Continue with ${providerLabel}`}
            >
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.tile, { borderColor }]}
              >
                {isLoadingThis
                  ? <ActivityIndicator color={id === 'google' ? COLORS.text.tertiary : '#FFFFFF'} />
                  : <Icon size={24} />
                }
              </LinearGradient>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.tertiary,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  tileShadow: {
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
