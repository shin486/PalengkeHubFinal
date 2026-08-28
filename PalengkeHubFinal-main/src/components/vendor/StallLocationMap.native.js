// src/components/vendor/StallLocationMap.native.js
// The vendor/admin fine-tune calibration map — native only. The pin is
// fixed at screen center; the vendor drags the MAP underneath it (the
// standard "pick a precise point" pattern — Google Maps, Uber, Grab all
// use it, since dragging a small marker precisely on a phone screen is
// far fiddlier than panning the whole map under a fixed crosshair).
// react-native-maps has no web target (see StallLocationMap.web.js for
// that side of the split), which is fine here: this map is a staff tool
// used on-site with a phone, not the customer-facing feature, and the
// spec explicitly says any lightweight map library works for this step.

import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TYPE } from '../../theme/tokens';

const PIN_SIZE = 36;

export default function StallLocationMap({ lat, lng, onChange, height = 240 }) {
  const COLORS = useColors();
  // Only used as the map's starting point — after that it's
  // uncontrolled, and onRegionChangeComplete is what keeps the parent's
  // lat/lng in sync with wherever the vendor pans the map to.
  const [initialRegion] = useState({
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.0015,
    longitudeDelta: 0.0015,
  });

  return (
    <View style={[styles.wrap, { height, borderColor: COLORS.borderLight }]}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        onRegionChangeComplete={(region) => onChange(region.latitude, region.longitude)}
      />

      {/* Fixed pin — the map moves under it, not the other way around */}
      <View style={styles.pinWrap} pointerEvents="none">
        <Ionicons name="location" size={PIN_SIZE} color={COLORS.primary} />
      </View>

      <View style={[styles.hint, { backgroundColor: COLORS.inkSurface }]} pointerEvents="none">
        <Text style={[styles.hintText, { color: COLORS.onInk }]}>Drag the map so the pin sits on your stall</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  pinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    // The Ionicons "location" glyph points down from its own vertical
    // center, so offset by half the width and the full height to land
    // the tip — not the icon's own center — exactly on the map center.
    marginLeft: -(PIN_SIZE / 2),
    marginTop: -PIN_SIZE,
  },
  hint: {
    position: 'absolute',
    bottom: SPACING.sm,
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    opacity: 0.9,
  },
  hintText: {
    fontSize: TYPE.size.caption,
    fontFamily: 'Nunito_700Bold',
    fontWeight: TYPE.weight.semibold,
  },
});
