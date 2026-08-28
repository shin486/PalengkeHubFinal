// src/components/vendor/StallLocationMap.web.js
// Web calibration map — real Leaflet + OpenStreetMap tiles. The pin is
// fixed at screen center; the vendor drags the MAP underneath it (the
// standard "pick a precise point" pattern — Google Maps, Uber, Grab all
// use it, since dragging a small marker precisely on a phone screen is
// far fiddlier than panning the whole map under a fixed crosshair).
// No API key, no billing (unlike Google Maps, which this repo already
// tried once — see the removed GOOGLE_MAPS_API_KEY placeholder in
// VendorProfileScreen's old code — and never finished setting up).
// react-native-maps has no web renderer at all, hence the separate
// platform file; StallLocationMap.native.js covers iOS/Android.
//
// Leaflet's CSS and default marker icons are both pulled from unpkg at
// runtime rather than imported as local modules — Metro (Expo's web
// bundler) doesn't resolve npm-package CSS imports or PNG-as-URL the
// way webpack does, and this sidesteps that entirely.

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useColors } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TYPE } from '../../theme/tokens';

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_VERSION_PATH = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
const PIN_SIZE = 36;

let iconConfigured = false;
function ensureDefaultIcon() {
  if (iconConfigured) return;
  iconConfigured = true;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: `${LEAFLET_VERSION_PATH}marker-icon.png`,
    iconRetinaUrl: `${LEAFLET_VERSION_PATH}marker-icon-2x.png`,
    shadowUrl: `${LEAFLET_VERSION_PATH}marker-shadow.png`,
  });
}

function ensureLeafletCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS_URL;
  document.head.appendChild(link);
}

// Must live inside <MapContainer> — useMapEvents only works in that
// context. Reports the map's center whenever the vendor stops panning
// or zooming, which is exactly "where the fixed pin is now pointing."
function CenterTracker({ onChange }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onChange(c.lat, c.lng);
    },
  });
  return null;
}

export default function StallLocationMap({ lat, lng, onChange, height = 240 }) {
  const COLORS = useColors();
  const [ready, setReady] = useState(false);
  // Center is only ever set once, on mount — the map is uncontrolled
  // after that (react-leaflet has no "controlled center" prop without
  // fighting the user's own drag), and CenterTracker is what keeps the
  // parent's lat/lng in sync with wherever the vendor pans it to.
  const [initialCenter] = useState([lat, lng]);

  useEffect(() => {
    ensureLeafletCss();
    ensureDefaultIcon();
    setReady(true);
  }, []);

  if (!ready) {
    return <View style={[styles.wrap, { height, borderColor: COLORS.borderLight }]} />;
  }

  return (
    <View style={[styles.wrap, { height, borderColor: COLORS.borderLight }]}>
      <MapContainer
        center={initialCenter}
        zoom={19}
        maxZoom={20}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
        />
        <CenterTracker onChange={onChange} />
      </MapContainer>

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
  pinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    // The Ionicons "location" glyph points down from its own vertical
    // center, so offset by half the width and the full height to land
    // the tip — not the icon's own center — exactly on the map center.
    marginLeft: -(PIN_SIZE / 2),
    marginTop: -PIN_SIZE,
    zIndex: 1000,
  },
  hint: {
    position: 'absolute',
    bottom: SPACING.sm,
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    opacity: 0.9,
    zIndex: 1000,
  },
  hintText: {
    fontSize: TYPE.size.caption,
    fontFamily: 'Nunito_700Bold',
    fontWeight: TYPE.weight.semibold,
  },
});
