// src/components/MarketMapView.native.js
// Native (iOS/Android) renderer for MarketMapScreen — react-native-maps,
// same custom-marker look as the old single-stall StallMap. Fits the
// camera to every pinned stall on load instead of centering on just one.
//
// Tapping a pin does NOT navigate — it only reports the tap via
// onPinPress, so the screen can show a preview first (see
// MarketMapScreen's two-tap "preview, then confirm" flow).

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../contexts/ThemeContext';
import { MARKET_ANCHOR } from '../services/stallLocationService';

export default function MarketMapView({ stalls, selectedStallId, onPinPress, height = '100%' }) {
  const COLORS = useColors();
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || stalls.length === 0) return;
    if (stalls.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: stalls[0].lat,
          longitude: stalls[0].lng,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        300
      );
      return;
    }
    mapRef.current.fitToCoordinates(
      stalls.map((s) => ({ latitude: s.lat, longitude: s.lng })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
    );
  }, [stalls]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: MARKET_ANCHOR.lat,
          longitude: MARKET_ANCHOR.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {stalls.map((stall) => {
          const selected = stall.id === selectedStallId;
          return (
            <Marker
              key={stall.id}
              coordinate={{ latitude: stall.lat, longitude: stall.lng }}
              onPress={() => onPinPress(stall)}
              // Custom-view markers only redraw automatically on first
              // render — without this, a selected-state color/size change
              // silently never repaints on Android. Small stall counts
              // here make the perf cost of always tracking negligible.
              tracksViewChanges
            >
              <View style={styles.pin}>
                <View
                  style={[
                    styles.pinInner,
                    { borderColor: selected ? COLORS.primaryDark || COLORS.primary : COLORS.primary },
                    selected && styles.pinInnerSelected,
                  ]}
                >
                  <Ionicons name="storefront" size={selected ? 18 : 14} color={COLORS.primary} />
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  pinInnerSelected: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
  },
});
