import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.44;

export const SkeletonCard = ({ delay = 0, style }) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    setTimeout(() => anim.start(), delay);
    return () => anim.stop();
  }, [delay]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View style={[styles.card, { opacity }, style]}>
      <View style={styles.image} />
      <View style={styles.body}>
        <View style={styles.line1} />
        <View style={styles.line2} />
        <View style={styles.line3} />
      </View>
    </Animated.View>
  );
};

export const SkeletonList = ({ count = 4, cardStyle }) => (
  <View style={styles.grid}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} delay={i * 100} style={cardStyle} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  card: {
    width: CARD_WIDTH,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  image: { height: CARD_WIDTH * 1.1, backgroundColor: '#D0D0D0' },
  body: { padding: 12 },
  line1: { height: 14, backgroundColor: '#D0D0D0', borderRadius: 7, marginBottom: 8, width: '80%' },
  line2: { height: 12, backgroundColor: '#D0D0D0', borderRadius: 6, marginBottom: 6, width: '50%' },
  line3: { height: 18, backgroundColor: '#D0D0D0', borderRadius: 9, marginTop: 4, width: '40%' },
});