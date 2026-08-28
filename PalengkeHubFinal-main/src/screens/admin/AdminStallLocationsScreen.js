// src/screens/admin/AdminStallLocationsScreen.js
//
// Admin verification queue for vendor-captured stall locations
// (build-prompt step 3). Worst-accuracy-first, same drag-to-adjust
// calibration map as the vendor capture flow, plus a full spot-check
// table of every current location regardless of review state.

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Header } from '../../components/Header';
import { WovenBackground } from '../../components/WovenBackground';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TEXT_STYLES } from '../../theme/tokens';
import StallLocationMap from '../../components/vendor/StallLocationMap';
import {
  fetchReviewQueue,
  fetchAllCurrentStallLocations,
  approveStallLocation,
  adjustAndApproveStallLocation,
  flagForReregistration,
  REVIEW_ACCURACY_THRESHOLD,
} from '../../services/stallLocationService';

const TABS = [
  { key: 'queue', label: 'Needs Review' },
  { key: 'all', label: 'All Stalls' },
];

export default function AdminStallLocationsScreen({ navigation }) {
  const { colors: COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [reviewing, setReviewing] = useState(null); // the location row being adjusted
  const [adjustedPin, setAdjustedPin] = useState(null);
  const [flagModalVisible, setFlagModalVisible] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [q, all] = await Promise.all([fetchReviewQueue(), fetchAllCurrentStallLocations()]);
      setQueue(q);
      setAllLocations(all);
    } catch (error) {
      console.error('Error loading stall locations:', error);
      Alert.alert('Error', 'Failed to load stall locations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openAdjust = (loc) => {
    setReviewing(loc);
    setAdjustedPin({ lat: loc.lat, lng: loc.lng });
  };

  const handleApprove = async (loc) => {
    setBusy(true);
    try {
      await approveStallLocation(loc.id);
      await load();
    } catch (error) {
      Alert.alert('Error', 'Could not approve this location.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdjustAndApprove = async () => {
    if (!reviewing || !adjustedPin) return;
    setBusy(true);
    try {
      await adjustAndApproveStallLocation(reviewing.id, adjustedPin);
      setReviewing(null);
      setAdjustedPin(null);
      await load();
    } catch (error) {
      Alert.alert('Error', 'Could not save the adjusted location.');
    } finally {
      setBusy(false);
    }
  };

  const handleFlag = async () => {
    if (!reviewing || !flagReason.trim()) {
      Alert.alert('Reason required', 'Describe why this stall needs to re-register its location.');
      return;
    }
    setBusy(true);
    try {
      await flagForReregistration(reviewing.id, flagReason.trim(), reviewing.stall_id, reviewing.stall?.vendor_id);
      setFlagModalVisible(false);
      setReviewing(null);
      setFlagReason('');
      await load();
    } catch (error) {
      Alert.alert('Error', 'Could not flag this stall for re-registration.');
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (loc, showActions) => {
    const accuracyLabel = loc.accuracy_meters == null ? 'Manual (no GPS)' : `±${Math.round(loc.accuracy_meters)}m`;
    const isPoor = loc.accuracy_meters == null || loc.accuracy_meters > REVIEW_ACCURACY_THRESHOLD;

    return (
      <View key={loc.id} style={styles.row}>
        <View style={styles.rowHeader}>
          <View style={styles.rowHeaderLeft}>
            <Text style={styles.stallName}>{loc.stall?.stall_name || `Stall #${loc.stall?.stall_number}`}</Text>
            <Text style={styles.stallMeta}>#{loc.stall?.stall_number} · {loc.stall?.section}</Text>
          </View>
          <View style={[styles.accuracyBadge, isPoor ? styles.accuracyBadgePoor : styles.accuracyBadgeGood]}>
            <Text style={[styles.accuracyBadgeText, isPoor ? styles.accuracyBadgeTextPoor : styles.accuracyBadgeTextGood]}>
              {accuracyLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.coordText}>{loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}</Text>

        <View style={styles.statusRow}>
          {loc.verified_by_admin ? (
            <View style={styles.statusChip}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
              <Text style={styles.statusChipTextGood}>Verified</Text>
            </View>
          ) : (
            <View style={styles.statusChip}>
              <Ionicons name="time-outline" size={13} color={COLORS.warning} />
              <Text style={styles.statusChipTextWarn}>Pending review</Text>
            </View>
          )}
          {loc.manually_adjusted && (
            <View style={styles.statusChip}>
              <Ionicons name="hand-left-outline" size={13} color={COLORS.text.tertiary} />
              <Text style={styles.statusChipTextNeutral}>Manually adjusted</Text>
            </View>
          )}
          {loc.reregister_reason && (
            <View style={styles.statusChip}>
              <Ionicons name="flag-outline" size={13} color={COLORS.error} />
              <Text style={styles.statusChipTextBad}>Flagged</Text>
            </View>
          )}
        </View>

        {showActions && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(loc)} disabled={busy}>
              <Ionicons name="checkmark" size={15} color={COLORS.onSuccess} />
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => openAdjust(loc)} disabled={busy}>
              <Ionicons name="move-outline" size={15} color={COLORS.primary} />
              <Text style={styles.adjustBtnText}>Adjust</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.flagBtn}
              onPress={() => { setReviewing(loc); setFlagModalVisible(true); }}
              disabled={busy}
            >
              <Ionicons name="flag-outline" size={15} color={COLORS.error} />
              <Text style={styles.flagBtnText}>Flag</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const list = tab === 'queue' ? queue : allLocations;

  return (
    <View style={styles.container}>
      <WovenBackground isDark={isDark} />
      <Header title="Stall Locations" subtitle="Review captured GPS pins" showBack onBackPress={() => navigation.goBack()} />

      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label} {t.key === 'queue' && queue.length > 0 ? `(${queue.length})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={COLORS.text.lighter} />
          <Text style={styles.emptyText}>
            {tab === 'queue' ? 'Nothing needs review right now.' : 'No stall locations captured yet.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
          {list.map((loc) => renderRow(loc, tab === 'queue'))}
        </ScrollView>
      )}

      {/* Adjust & Approve sheet */}
      <Modal visible={!!reviewing && !flagModalVisible && !!adjustedPin} transparent animationType="slide" onRequestClose={() => setReviewing(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Adjust & Approve</Text>
              <TouchableOpacity onPress={() => { setReviewing(null); setAdjustedPin(null); }}>
                <Ionicons name="close" size={22} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
            {adjustedPin && (
              <StallLocationMap
                lat={adjustedPin.lat}
                lng={adjustedPin.lng}
                onChange={(lat, lng) => setAdjustedPin({ lat, lng })}
                height={220}
              />
            )}
            <TouchableOpacity style={styles.confirmBtn} onPress={handleAdjustAndApprove} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator size="small" color={COLORS.onPrimary} /> : (
                <>
                  <Ionicons name="checkmark" size={18} color={COLORS.onPrimary} />
                  <Text style={styles.confirmBtnText}>Save & Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Flag for re-registration */}
      <Modal visible={flagModalVisible} transparent animationType="fade" onRequestClose={() => setFlagModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.flagSheet}>
            <Text style={styles.sheetTitle}>Flag for Re-registration</Text>
            <Text style={styles.flagSubtitle}>The vendor will be notified to redo the capture step on-site.</Text>
            <TextInput
              style={styles.flagInput}
              placeholder="Reason (e.g. pin is in the wrong section)…"
              placeholderTextColor={COLORS.text.lighter}
              value={flagReason}
              onChangeText={setFlagReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.flagActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setFlagModalVisible(false); setReviewing(null); setFlagReason(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.flagConfirmBtn} onPress={handleFlag} disabled={busy}>
                {busy ? <ActivityIndicator size="small" color={COLORS.onError} /> : (
                  <Text style={styles.flagConfirmBtnText}>Flag Stall</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  tab: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.text.secondary },
  tabTextActive: { color: COLORS.onPrimary },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: SPACING.md },
  emptyText: { fontSize: 14, color: COLORS.text.light, textAlign: 'center' },

  listContent: { padding: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.md },
  row: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rowHeaderLeft: { flex: 1 },
  stallName: { ...TEXT_STYLES.h3, color: COLORS.text.primary },
  stallMeta: { fontSize: 12, color: COLORS.text.tertiary, marginTop: 2 },
  coordText: { fontSize: 12, color: COLORS.text.tertiary, fontFamily: 'monospace' },

  accuracyBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm },
  accuracyBadgeGood: { backgroundColor: COLORS.successLight },
  accuracyBadgePoor: { backgroundColor: COLORS.errorLight },
  accuracyBadgeText: { fontSize: 11, fontWeight: '700' },
  accuracyBadgeTextGood: { color: COLORS.success },
  accuracyBadgeTextPoor: { color: COLORS.error },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusChipTextGood: { fontSize: 11, color: COLORS.success, fontWeight: '600' },
  statusChipTextWarn: { fontSize: 11, color: COLORS.warning, fontWeight: '600' },
  statusChipTextNeutral: { fontSize: 11, color: COLORS.text.tertiary, fontWeight: '600' },
  statusChipTextBad: { fontSize: 11, color: COLORS.error, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.success, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm,
  },
  approveBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.onSuccess },
  adjustBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm,
  },
  adjustBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  flagBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.error, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm,
  },
  flagBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.error },

  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, gap: SPACING.md,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { ...TEXT_STYLES.h2, color: COLORS.text.primary },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.onPrimary },

  flagSheet: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, margin: SPACING.lg,
    gap: SPACING.md, alignSelf: 'center', width: '90%',
  },
  flagSubtitle: { fontSize: 12, color: COLORS.text.tertiary },
  flagInput: {
    borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: 14, color: COLORS.text.primary, backgroundColor: COLORS.background, minHeight: 80, textAlignVertical: 'top',
  },
  flagActions: { flexDirection: 'row', gap: SPACING.md },
  cancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.borderLight,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text.secondary },
  flagConfirmBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    backgroundColor: COLORS.error,
  },
  flagConfirmBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.onError },
});
