// src/components/vendor/StallLocationCapture.js
//
// The vendor's "set/update my stall location" flow (build-prompt step 1).
// Same component powers both the first-time capture and the later
// "Update Stall Location" action — re-registration is explicitly meant
// to go through this, not a raw coordinate field.
//
// States: idle -> sampling -> (result | no-gps fallback) -> saving -> done

import React, { useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TEXT_STYLES } from '../../theme/tokens';
import StallLocationMap from './StallLocationMap';
import {
  collectGpsSamples,
  computeCapturedLocation,
  saveStallLocation,
  REVIEW_ACCURACY_THRESHOLD,
  MARKET_ANCHOR,
} from '../../services/stallLocationService';

const STAGE = {
  IDLE: 'idle',
  SAMPLING: 'sampling',
  RESULT: 'result',
  NO_GPS: 'no_gps',
  SAVING: 'saving',
};

export default function StallLocationCapture({ visible, stallId, capturedBy = 'vendor', reason = null, onClose, onSaved }) {
  const COLORS = useColors();
  const styles = createStyles(COLORS);

  const [stage, setStage] = useState(STAGE.IDLE);
  const [sampleCount, setSampleCount] = useState(0);
  const [result, setResult] = useState(null); // { lat, lng, accuracyMeters, needsReview }
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false);
  const [error, setError] = useState(null);
  // Guards the async GPS result against landing after the vendor has
  // already skipped to manual placement — sampling keeps running in the
  // background (there's no cheap way to cancel a live GPS watch), but
  // its eventual result must not clobber a state the vendor already moved
  // past.
  const skippedRef = useRef(false);

  const reset = useCallback(() => {
    setStage(STAGE.IDLE);
    setSampleCount(0);
    setResult(null);
    setManuallyAdjusted(false);
    setError(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const startCapture = async () => {
    skippedRef.current = false;
    setStage(STAGE.SAMPLING);
    setSampleCount(0);
    setError(null);
    try {
      const samples = await collectGpsSamples({
        onSample: (_sample, count) => setSampleCount(count),
      });
      if (skippedRef.current) return;
      const computed = computeCapturedLocation(samples);
      if (!computed) {
        // Every sample was worse than the 50m noise threshold, or the
        // device never produced one (e.g. no sky view in a covered
        // market) — this IS the no-GPS edge case, not an error.
        setResult({ lat: MARKET_ANCHOR.lat, lng: MARKET_ANCHOR.lng, accuracyMeters: null, needsReview: true });
        setStage(STAGE.NO_GPS);
        return;
      }
      setResult(computed);
      setStage(STAGE.RESULT);
    } catch (err) {
      if (skippedRef.current) return;
      if (err.message === 'LOCATION_PERMISSION_DENIED') {
        setError('Location permission is required to capture your stall\'s position.');
      } else {
        setError('Could not read GPS. You can still place the pin manually below.');
      }
      setResult({ lat: MARKET_ANCHOR.lat, lng: MARKET_ANCHOR.lng, accuracyMeters: null, needsReview: true });
      setStage(STAGE.NO_GPS);
    }
  };

  // A vendor who already knows their stall is under a roof with no GPS
  // lock shouldn't have to wait through a sampling window that's going to
  // fail anyway — this jumps straight to the same manual-placement map
  // the automatic no-GPS fallback uses.
  const skipToManual = () => {
    skippedRef.current = true;
    setError(null);
    setResult({ lat: MARKET_ANCHOR.lat, lng: MARKET_ANCHOR.lng, accuracyMeters: null, needsReview: true });
    setStage(STAGE.NO_GPS);
  };

  const handlePinChange = (lat, lng) => {
    setResult((prev) => ({ ...prev, lat, lng }));
    setManuallyAdjusted(true);
  };

  const handleConfirm = async () => {
    if (!result) return;
    setStage(STAGE.SAVING);
    try {
      const saved = await saveStallLocation(stallId, {
        lat: result.lat,
        lng: result.lng,
        accuracyMeters: result.accuracyMeters,
        capturedBy,
        captureMethod: result.accuracyMeters == null ? 'manual_no_gps' : 'gps',
        manuallyAdjusted,
      });
      onSaved?.(saved);
      Alert.alert('Saved', 'Stall location saved. It will be reviewed if the signal was weak.');
      reset();
      onClose?.();
    } catch (err) {
      console.error('Error saving stall location:', err);
      Alert.alert('Error', 'Could not save the stall location. Please try again.');
      setStage(result.accuracyMeters == null ? STAGE.NO_GPS : STAGE.RESULT);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {reason ? 'Re-register Stall Location' : 'Set Stall Location'}
            </Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>

          {reason && (
            <View style={styles.reasonBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          )}

          {stage === STAGE.IDLE && (
            <View style={styles.idle}>
              <View style={styles.idleIcon}>
                <Ionicons name="navigate-outline" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.idleText}>
                Stand at your stall, then tap start. This takes about 10–15 seconds.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={startCapture} activeOpacity={0.85}>
                <Ionicons name="locate-outline" size={18} color={COLORS.onPrimary} />
                <Text style={styles.primaryBtnText}>Start Capture</Text>
              </TouchableOpacity>
            </View>
          )}

          {stage === STAGE.SAMPLING && (
            <View style={styles.idle}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.idleText}>Reading GPS… {sampleCount} sample{sampleCount === 1 ? '' : 's'} collected</Text>
              <Text style={styles.idleSubtext}>Hold your phone steady with a clear view of the sky if possible.</Text>
              <TouchableOpacity onPress={skipToManual} activeOpacity={0.7}>
                <Text style={styles.skipLink}>Under a roof? Skip to manual placement</Text>
              </TouchableOpacity>
            </View>
          )}

          {(stage === STAGE.RESULT || stage === STAGE.NO_GPS || stage === STAGE.SAVING) && result && (
            <View style={styles.result}>
              {error && (
                <View style={styles.warningBanner}>
                  <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.warningText}>{error}</Text>
                </View>
              )}

              {stage === STAGE.NO_GPS && !error && (
                <View style={styles.warningBanner}>
                  <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.warningText}>
                    No usable GPS signal here (fully covered market roofs often block it). Drag the map
                    below so the pin lands on your stall — it's centered on the market.
                  </Text>
                </View>
              )}

              {stage === STAGE.RESULT && result.needsReview && (
                <View style={styles.warningBanner}>
                  <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                  <Text style={styles.warningText}>
                    GPS signal is weak here (~{Math.round(result.accuracyMeters)}m accuracy). Try an open
                    area, or continue and fine-tune manually below. This will be sent for admin review.
                  </Text>
                </View>
              )}

              {stage === STAGE.RESULT && !result.needsReview && (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
                  <Text style={styles.successText}>
                    Good signal — accuracy ~{Math.round(result.accuracyMeters)}m
                  </Text>
                </View>
              )}

              <StallLocationMap
                lat={result.lat}
                lng={result.lng}
                onChange={handlePinChange}
                height={220}
              />

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={startCapture} activeOpacity={0.85} disabled={stage === STAGE.SAVING}>
                  <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.secondaryBtnText}>Retry GPS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.confirmBtn]}
                  onPress={handleConfirm}
                  activeOpacity={0.85}
                  disabled={stage === STAGE.SAVING}
                >
                  {stage === STAGE.SAVING ? (
                    <ActivityIndicator size="small" color={COLORS.onPrimary} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={COLORS.onPrimary} />
                      <Text style={styles.primaryBtnText}>Confirm Location</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.md,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...TEXT_STYLES.h2,
    color: COLORS.text.primary,
  },
  reasonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.primary,
  },
  idle: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xl,
  },
  idleIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  idleSubtext: {
    fontSize: 12,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    maxWidth: 260,
  },
  skipLink: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textDecorationLine: 'underline',
    marginTop: SPACING.sm,
  },
  result: {
    gap: SPACING.md,
  },
  warningBanner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text.primary,
    lineHeight: 17,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  successText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  confirmBtn: {
    flex: 1,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onPrimary,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
