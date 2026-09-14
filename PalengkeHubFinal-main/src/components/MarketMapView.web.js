// src/components/MarketMapView.web.js
// Web renderer for MarketMapScreen — real Leaflet + OpenStreetMap tiles,
// same no-API-key approach as StallLocationMap.web.js. Unlike that file
// (one fixed center pin the vendor drags the map under), this one plots
// every pinned stall as its own marker and fits the view to all of them.
//
// Tapping a pin does NOT navigate — it only reports the tap via
// onPinPress, so the screen can show a preview first (see
// MarketMapScreen's two-tap "preview, then confirm" flow).

import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ensureLeafletCss, ensureDefaultIcon } from '../utils/leafletSetup';
import { MARKET_ANCHOR } from '../services/stallLocationService';

// Must live inside <MapContainer> — useMap only works in that context.
// Re-fits whenever the stall list changes so a fresh fetch reframes the view.
function FitToStalls({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 19);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 19 });
  }, [points, map]);
  return null;
}

// A teardrop pin (inline SVG, no image asset needed — same reasoning as
// leafletSetup's own CSS-from-CDN approach: keep this independent of
// Metro's web bundler asset handling). Plain circles were the original
// shape here, but stalls pinned close together turned into a blob of
// overlapping discs with no way to tell which was which — a pin only
// touches the map at its tip, so even tightly-clustered stalls fan out
// as distinct heads instead of stacking edge-to-edge. iconAnchor points
// at that tip (bottom-center of the SVG), not the shape's center, so the
// pin still marks the exact coordinate rather than floating above it.
function makePinIcon(selected) {
  const size = selected ? 34 : 26;
  const color = selected ? '#B91C1C' : '#DC2626';
  const html = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
         style="display:block;cursor:pointer;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.45));">
      <path d="M12 1.5c-4.28 0-7.75 3.47-7.75 7.75 0 5.79 7.75 13.25 7.75 13.25s7.75-7.46 7.75-13.25c0-4.28-3.47-7.75-7.75-7.75z"
            fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="12" cy="9.25" r="3.2" fill="#FFFFFF"/>
    </svg>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

export default function MarketMapView({ stalls, selectedStallId, onPinPress, height = '100%' }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureLeafletCss();
    ensureDefaultIcon();
    setReady(true);
  }, []);

  const defaultIcon = useMemo(() => (ready ? makePinIcon(false) : null), [ready]);
  const selectedIcon = useMemo(() => (ready ? makePinIcon(true) : null), [ready]);

  if (!ready) {
    return <View style={[styles.wrap, { height }]} />;
  }

  const initialCenter = stalls.length > 0
    ? [stalls[0].lat, stalls[0].lng]
    : [MARKET_ANCHOR.lat, MARKET_ANCHOR.lng];

  return (
    <View style={[styles.wrap, { height }]}>
      <MapContainer
        center={initialCenter}
        zoom={18}
        maxZoom={20}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
        />
        <FitToStalls points={stalls} />
        {stalls.map((stall) => {
          const selected = stall.id === selectedStallId;
          return (
            <Marker
              key={stall.id}
              position={[stall.lat, stall.lng]}
              icon={selected ? selectedIcon : defaultIcon}
              zIndexOffset={selected ? 1000 : 0}
              eventHandlers={{ click: () => onPinPress(stall) }}
            />
          );
        })}
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
});
