// src/screens/customer/MarketMapScreen.js
// Every pinned stall on one map — customers tap a pin to open that
// stall's details. Only stalls with a real captured stall_locations row
// show up here (see fetchAllStallsWithLocations); nothing is guessed
// from a section-based fallback the way OrdersScreen's single-stall map
// sometimes does, so every pin on this screen is a real, vendor- or
// admin-placed location.
//
// Tapping a pin doesn't navigate straight away — it shows a preview
// card for that stall first. Tapping the SAME pin again (or the card's
// "View Stall" button) commits to opening StallDetails. Tapping a
// DIFFERENT pin swaps the preview instead of navigating, so browsing
// several candidates costs nothing; the "X" on the card dismisses it
// without picking anything.
//
// This screen renders no header of its own — MarketMap is a sibling
// route on the same stack as MainTabs (see App.js), which already
// renders one persistent global header above the Stack.Navigator for
// every screen on it. Screens on that stack get their title/back
// button from App.js's getHeaderProps() switch instead of rendering
// their own — the same fix already applied to the Notifications screen
// for the identical redundant-header problem.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import MarketMapView from '../../components/MarketMapView';
import { fetchAllStallsWithLocations } from '../../services/stallLocationService';

function StallPreviewCard({ stall, onViewStall, onClose, styles, COLORS }) {
  const [imageError, setImageError] = useState(false);

  return (
    <View style={styles.previewCard}>
      <TouchableOpacity style={styles.previewClose} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color={COLORS.text.secondary} />
      </TouchableOpacity>

      <View style={styles.previewBody}>
        {stall.image_url && !imageError ? (
          <Image
            source={{ uri: stall.image_url }}
            style={styles.previewImage}
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[styles.previewImage, styles.previewImageFallback]}>
            <Ionicons name="storefront-outline" size={26} color={COLORS.text.tertiary} />
          </View>
        )}

        <View style={styles.previewInfo}>
          <Text style={styles.previewName} numberOfLines={1}>{stall.stall_name || 'Market Stall'}</Text>
          <Text style={styles.previewMeta} numberOfLines={1}>
            Stall #{stall.stall_number || 'N/A'} • {stall.section || 'No section'}
          </Text>
          {!!stall.description && (
            <Text style={styles.previewDescription} numberOfLines={2}>{stall.description}</Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.viewStallButton} onPress={() => onViewStall(stall)} activeOpacity={0.85}>
        <Text style={styles.viewStallButtonText}>View Stall</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.previewHint}>Tap this pin again to view the stall</Text>
    </View>
  );
}

export default function MarketMapScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [stalls, setStalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStall, setSelectedStall] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchAllStallsWithLocations();
      setStalls(data);
    } catch (err) {
      console.error('Error loading market map:', err);
      setError('Failed to load stall locations. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setSelectedStall(null);
    setRefreshing(true);
    load();
  };

  const goToStallDetails = (stall) => {
    navigation.navigate('StallDetails', { stallId: stall.id });
  };

  const handlePinPress = (stall) => {
    setSelectedStall((current) => {
      // Second tap on the pin that's already previewed = confirm.
      if (current && current.id === stall.id) {
        goToStallDetails(stall);
        return current;
      }
      // First tap, or a different pin — (re)show the preview. Any
      // previous preview is simply replaced, not stacked.
      return stall;
    });
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <ScrollView
          contentContainerStyle={styles.centerContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.text.tertiary} />
          <Text style={styles.emptyText}>{error}</Text>
        </ScrollView>
      ) : stalls.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
          <Ionicons name="map-outline" size={40} color={COLORS.text.tertiary} />
          <Text style={styles.emptyText}>No stall locations have been pinned yet.</Text>
          <Text style={styles.emptySubtext}>Check back once vendors have set their stall's location.</Text>
        </ScrollView>
      ) : (
        <View style={styles.mapWrap}>
          <MarketMapView
            stalls={stalls}
            selectedStallId={selectedStall?.id ?? null}
            onPinPress={handlePinPress}
          />
          {selectedStall && (
            <StallPreviewCard
              stall={selectedStall}
              onViewStall={goToStallDetails}
              onClose={() => setSelectedStall(null)}
              styles={styles}
              COLORS={COLORS}
            />
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapWrap: {
    flex: 1,
  },
  centerContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  previewCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    shadowColor: COLORS.shadowDark || '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  previewClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceSecondary || COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBody: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 24,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  previewImageFallback: {
    backgroundColor: COLORS.surfaceSecondary || COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  previewName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  previewMeta: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    marginBottom: 4,
  },
  previewDescription: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  viewStallButton: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
  },
  viewStallButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewHint: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
});
