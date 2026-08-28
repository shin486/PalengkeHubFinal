// src/services/stallLocationService.js
//
// Stall geolocation capture, review-queue CRUD, and the two pure
// customer-facing helpers (haversine distance, directions deep link).
// See create-stall-locations-table.sql for the schema this reads/writes.

import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';

// A plain 2x2m stall needs single-digit-meter precision; a lone GPS
// reading on a phone is commonly 5-50m off. Sampling for a few seconds
// and averaging the good readings is the standard mitigation without
// needing survey-grade hardware.
const SAMPLE_WINDOW_MS = 8000;
const NOISE_THRESHOLD_METERS = 50;
const REVIEW_THRESHOLD_METERS = 15;

// Lipa City Public Market's real coordinates — verified against
// OpenStreetMap's own geocoder (Nominatim), which has it mapped as an
// actual building outline (C.B. Lopez Street, Poblacion, Lipa), not
// guessed. Used only as the map's starting center for a manual (no-GPS)
// placement, never written to a record as if it were a real reading.
export const MARKET_ANCHOR = { lat: 13.9435722, lng: 121.1609541 };

// ============================================================
// GPS CAPTURE
// ============================================================

// Collects location samples for SAMPLE_WINDOW_MS via a live watch
// (not repeated one-shot calls — watchPositionAsync lets the GPS chip
// keep refining its fix between samples instead of cold-starting each
// time). Resolves with the raw sample list; computeCapturedLocation
// below turns that into the actual record to save.
export const collectGpsSamples = async ({ onSample } = {}) => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('LOCATION_PERMISSION_DENIED');
  }

  const samples = [];

  return new Promise((resolve, reject) => {
    let subscription;
    const finish = async () => {
      if (subscription) subscription.remove();
      resolve(samples);
    };

    const timer = setTimeout(finish, SAMPLE_WINDOW_MS);

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 500,
        distanceInterval: 0,
      },
      (loc) => {
        const sample = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracyMeters: loc.coords.accuracy ?? null,
          timestamp: loc.timestamp,
        };
        samples.push(sample);
        onSample?.(sample, samples.length);
      }
    )
      .then((sub) => {
        subscription = sub;
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// Filters noise, averages the rest, and keeps the single most precise
// sample's own accuracy as the confidence value — per the spec, the
// confidence figure must never be smoothed away by the averaging.
// Returns null if every sample was noise (or there were none), which
// callers treat as "GPS unusable here, fall back to manual placement."
export const computeCapturedLocation = (samples) => {
  const clean = samples.filter(
    (s) => s.accuracyMeters != null && s.accuracyMeters <= NOISE_THRESHOLD_METERS
  );
  if (clean.length === 0) return null;

  const lat = clean.reduce((sum, s) => sum + s.lat, 0) / clean.length;
  const lng = clean.reduce((sum, s) => sum + s.lng, 0) / clean.length;
  const accuracyMeters = Math.min(...clean.map((s) => s.accuracyMeters));

  return {
    lat,
    lng,
    accuracyMeters,
    sampleCount: clean.length,
    needsReview: accuracyMeters > REVIEW_THRESHOLD_METERS,
  };
};

export const REVIEW_ACCURACY_THRESHOLD = REVIEW_THRESHOLD_METERS;

// ============================================================
// CUSTOMER-FACING HELPERS (pure functions, no network/GPS)
// ============================================================

export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return null;
  if (meters < 1000) return `~${Math.round(meters)}m away`;
  return `~${(meters / 1000).toFixed(1)}km away`;
}

export function getDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// ============================================================
// CRUD — vendor capture, admin review queue
// ============================================================

// Marks any existing current row for this stall as history, then
// inserts the new one as current — this is what "don't silently
// overwrite, keep history" means at the data layer. Not a single
// UPDATE, so the previous pin is preserved verbatim.
export const saveStallLocation = async (stallId, {
  lat,
  lng,
  accuracyMeters,
  capturedBy,
  captureMethod = 'gps',
  manuallyAdjusted = false,
}) => {
  const { error: demoteError } = await supabase
    .from('stall_locations')
    .update({ is_current: false })
    .eq('stall_id', stallId)
    .eq('is_current', true);
  if (demoteError) throw demoteError;

  const { data, error } = await supabase
    .from('stall_locations')
    .insert({
      stall_id: stallId,
      lat,
      lng,
      accuracy_meters: accuracyMeters,
      captured_by: capturedBy,
      capture_method: captureMethod,
      manually_adjusted: manuallyAdjusted,
      // A weak-signal or manual-placement capture always starts
      // unverified, regardless of who captured it, so it lands in
      // the admin queue rather than silently going live unreviewed.
      verified_by_admin: accuracyMeters != null && accuracyMeters <= REVIEW_THRESHOLD_METERS && capturedBy === 'admin',
      is_current: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchCurrentStallLocation = async (stallId) => {
  const { data, error } = await supabase
    .from('stall_locations')
    .select('*')
    .eq('stall_id', stallId)
    .eq('is_current', true)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const fetchStallLocationHistory = async (stallId) => {
  const { data, error } = await supabase
    .from('stall_locations')
    .select('*')
    .eq('stall_id', stallId)
    .order('captured_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// Worst-accuracy-first, matching the spec's queue ordering. Rows with
// a null accuracy (manual/no-GPS placements) sort last within Postgres'
// default nulls-last ordering for desc — they still need review (the
// filter below catches them via verified_by_admin), just not by "how
// bad was the GPS" since there wasn't any.
export const fetchReviewQueue = async () => {
  const { data, error } = await supabase
    .from('stall_locations')
    .select('*, stall:stall_id (id, stall_number, stall_name, section)')
    .eq('is_current', true)
    .or(`verified_by_admin.eq.false,accuracy_meters.gt.${REVIEW_THRESHOLD_METERS}`)
    .order('accuracy_meters', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
};

// Full list for the optional spot-check table — every current
// location regardless of review state.
export const fetchAllCurrentStallLocations = async () => {
  const { data, error } = await supabase
    .from('stall_locations')
    .select('*, stall:stall_id (id, stall_number, stall_name, section)')
    .eq('is_current', true)
    .order('accuracy_meters', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
};

export const approveStallLocation = async (locationId) => {
  const { error } = await supabase
    .from('stall_locations')
    .update({ verified_by_admin: true, verified_at: new Date().toISOString() })
    .eq('id', locationId);
  if (error) throw error;
};

export const adjustAndApproveStallLocation = async (locationId, { lat, lng }) => {
  const { error } = await supabase
    .from('stall_locations')
    .update({
      lat,
      lng,
      manually_adjusted: true,
      verified_by_admin: true,
      verified_at: new Date().toISOString(),
    })
    .eq('id', locationId);
  if (error) throw error;
};

// Flags the current record for re-registration and notifies the
// vendor — it does NOT delete or demote the row, so the disputed pin
// stays visible/queryable until the vendor's redo capture supersedes
// it via saveStallLocation's own demote-then-insert.
export const flagForReregistration = async (locationId, reason, stallId, vendorId) => {
  const { error } = await supabase
    .from('stall_locations')
    .update({ reregister_reason: reason, verified_by_admin: false })
    .eq('id', locationId);
  if (error) throw error;

  if (vendorId) {
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: vendorId,
      type: 'stall_location_reregister',
      title: 'Stall location needs re-registration',
      message: reason,
      data: { stall_id: stallId, location_id: locationId },
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (notifError) console.warn('Could not notify vendor of re-registration flag:', notifError.message);
  }
};
