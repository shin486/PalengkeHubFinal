import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';

export default function StallMap({ 
  latitude, 
  longitude, 
  stallName, 
  stallNumber, 
  section, 
  height = 200,
  interactive = true 
}) {
  const openInGoogleMaps = () => {
    if (!latitude || !longitude) {
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  // ✅ If no valid coordinates, show placeholder
  if (!latitude || !longitude) {
    return (
      <View style={[styles.placeholderContainer, { height }]}>
        <Text style={styles.placeholderText}>📍 Location not available</Text>
        <Text style={styles.placeholderSubtext}>Stall location coming soon</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.container, { height }]} 
      onPress={openInGoogleMaps}
      disabled={!interactive}
      activeOpacity={0.7}
    >
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapEmoji}>🗺️</Text>
        <Text style={styles.mapTitle}>{stallName || 'Stall Location'}</Text>
        <Text style={styles.mapSubtitle}>
          {stallNumber ? `Stall #${stallNumber}` : ''} {section ? `- ${section}` : ''}
        </Text>
        <View style={styles.mapButton}>
          <Text style={styles.mapButtonText}>Tap to view in Google Maps</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    padding: 16,
  },
  mapEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  mapSubtitle: {
    fontSize: 12,
    color: '#3b82f6',
    marginBottom: 12,
    textAlign: 'center',
  },
  mapButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  placeholderContainer: {
    width: '100%',
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
});