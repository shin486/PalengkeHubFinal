// src/screens/vendor/VendorOffersScreen.js
// Where a vendor sees and responds to customer haggle offers. The vendor
// has the only "accept" that ends a negotiation — a customer can only
// send an offer or counter one of the vendor's own counters (see
// ProductDetailsScreen.js). Accepting here is what actually creates the
// customer-only special price: useCart.js looks up an 'accepted' row for
// that exact customer + product + unit and applies its price, and it
// reverts once that customer places an order with it (checkout marks it
// 'used').
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useColors } from '../../contexts/ThemeContext';
import { Header } from '../../components/Header';
import { supabase } from '../../../lib/supabase';

const STATUS_LABEL = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Declined',
  cancelled: 'Withdrawn',
  used: 'Completed',
};

export default function VendorOffersScreen({ navigation }) {
  const { user } = useAuth();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [counterFor, setCounterFor] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('haggle_offers')
        .select('*, product:product_id(name, image_url), customer:customer_id(full_name)')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Postgres numeric columns come back as strings over PostgREST —
      // normalized once here so every .toFixed() below can trust these
      // are actual numbers instead of scattering Number()/parseFloat()
      // calls through the render and action handlers.
      setOffers((data || []).map(o => ({
        ...o,
        current_price: Number(o.current_price),
        listed_price: Number(o.listed_price),
      })));
    } catch (err) {
      console.error('Failed to load offers:', err.message);
      Alert.alert('Error', 'Could not load offers. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  // Needs the vendor's own response — sorted first so the list opens on
  // what actually needs attention.
  const needsResponse = offers.filter(o => o.status === 'pending' && o.last_offered_by === 'customer');
  const others = offers.filter(o => !(o.status === 'pending' && o.last_offered_by === 'customer'));

  const respond = async (offer, updates, successMessage) => {
    setBusyId(offer.id);
    try {
      const { error } = await supabase.from('haggle_offers').update(updates).eq('id', offer.id);
      if (error) throw error;
      if (successMessage) Alert.alert('Done', successMessage);
      await load();
    } catch (err) {
      console.error('Failed to respond to offer:', err.message);
      Alert.alert('Error', `Could not update this offer: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const accept = (offer) => respond(
    offer,
    { status: 'accepted' },
    `Accepted — ₱${offer.current_price.toFixed(2)}/${offer.unit} now applies only to ${offer.customer?.full_name || 'this customer'}'s next order of this item.`
  );

  const reject = (offer) => {
    Alert.alert('Decline this offer?', `Reject the ₱${offer.current_price.toFixed(2)} offer from ${offer.customer?.full_name || 'this customer'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => respond(offer, { status: 'rejected' }) },
    ]);
  };

  const openCounter = (offer) => {
    setCounterFor(offer);
    setCounterPrice(offer.current_price.toFixed(2));
  };

  const submitCounter = async () => {
    const price = parseFloat(counterPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Enter a valid counter price.');
      return;
    }
    if (price >= counterFor.listed_price) {
      Alert.alert('Not a Discount', `Your counter (₱${price.toFixed(2)}) should be lower than the listed price (₱${counterFor.listed_price.toFixed(2)}).`);
      return;
    }
    await respond(counterFor, { current_price: price, last_offered_by: 'vendor' });
    setCounterFor(null);
    setCounterPrice('');
  };

  const OfferCard = ({ offer }) => {
    const isMyTurn = offer.status === 'pending' && offer.last_offered_by === 'customer';
    const isTheirTurn = offer.status === 'pending' && offer.last_offered_by === 'vendor';
    const busy = busyId === offer.id;

    return (
      <View style={[styles.card, isMyTurn && styles.cardHighlight]}>
        <View style={styles.cardTop}>
          {offer.product?.image_url ? (
            <Image source={{ uri: offer.product.image_url }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name="pricetag-outline" size={20} color={COLORS.text.quaternary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={1}>{offer.product?.name || 'Product'}</Text>
            <Text style={styles.customerName} numberOfLines={1}>from {offer.customer?.full_name || 'a customer'}</Text>
          </View>
          <View style={[styles.statusBadge, offer.status === 'accepted' && { backgroundColor: COLORS.successLight }, offer.status === 'rejected' && { backgroundColor: COLORS.errorLight }]}>
            <Text style={[styles.statusBadgeText, offer.status === 'accepted' && { color: COLORS.success }, offer.status === 'rejected' && { color: COLORS.error }]}>
              {STATUS_LABEL[offer.status] || offer.status}
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.listedPrice}>Listed ₱{offer.listed_price.toFixed(2)}</Text>
          <Ionicons name="arrow-forward" size={13} color={COLORS.text.tertiary} />
          <Text style={styles.offerPrice}>₱{offer.current_price.toFixed(2)} / {offer.unit}</Text>
        </View>

        {isMyTurn && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => reject(offer)} disabled={busy}>
              <Text style={styles.rejectBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.counterBtn]} onPress={() => openCounter(offer)} disabled={busy}>
              <Text style={styles.counterBtnText}>Counter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => accept(offer)} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color={COLORS.onPrimary} /> : <Text style={styles.acceptBtnText}>Accept</Text>}
            </TouchableOpacity>
          </View>
        )}
        {isTheirTurn && (
          <Text style={styles.waitingText}>Waiting for the customer to respond to your counter.</Text>
        )}
        {offer.status === 'used' && (
          <Text style={styles.waitingText}>Used in order #{offer.used_order_id} — price is back to normal for next time.</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Offers" subtitle="Customer haggle requests" showBack onBackPress={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : offers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={40} color={COLORS.text.quaternary} />
            <Text style={styles.emptyText}>No offers yet</Text>
            <Text style={styles.emptySubtext}>Customer haggle offers on your products will show up here.</Text>
          </View>
        ) : (
          <>
            {needsResponse.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Needs your response ({needsResponse.length})</Text>
                {needsResponse.map(o => <OfferCard key={o.id} offer={o} />)}
              </>
            )}
            {others.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>History</Text>
                {others.map(o => <OfferCard key={o.id} offer={o} />)}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!counterFor} transparent animationType="fade" onRequestClose={() => setCounterFor(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Counter Offer</Text>
            <Text style={styles.modalSubtitle}>
              {counterFor?.product?.name} · Listed ₱{counterFor?.listed_price?.toFixed(2)}
            </Text>
            <View style={styles.modalInputRow}>
              <Text style={styles.modalCurrency}>₱</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="decimal-pad"
                value={counterPrice}
                onChangeText={setCounterPrice}
                placeholder="0.00"
                placeholderTextColor={COLORS.text.quaternary}
                autoFocus
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCounterFor(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSendBtn} onPress={submitCounter} disabled={busyId === counterFor?.id}>
                {busyId === counterFor?.id ? <ActivityIndicator size="small" color={COLORS.onPrimary} /> : <Text style={styles.modalSendText}>Send Counter</Text>}
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
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 12, marginBottom: 8 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.text.primary, marginTop: 12 },
  emptySubtext: { fontSize: 13, color: COLORS.text.tertiary, textAlign: 'center', marginTop: 4 },

  card: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 10 },
  cardHighlight: { borderColor: COLORS.primary, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: COLORS.inputBg },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 15, fontWeight: '700', color: COLORS.text.primary },
  customerName: { fontSize: 12, color: COLORS.text.tertiary, marginTop: 1 },
  statusBadge: { backgroundColor: COLORS.inputBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.text.secondary },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  listedPrice: { fontSize: 13, color: COLORS.text.tertiary, textDecorationLine: 'line-through' },
  offerPrice: { fontSize: 16, fontWeight: '800', color: COLORS.primary },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  rejectBtn: { backgroundColor: COLORS.errorLight },
  rejectBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 13 },
  counterBtn: { backgroundColor: COLORS.inputBg },
  counterBtnText: { color: COLORS.text.primary, fontWeight: '700', fontSize: 13 },
  acceptBtn: { backgroundColor: COLORS.primary },
  acceptBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 13 },

  waitingText: { fontSize: 12, color: COLORS.text.tertiary, marginTop: 10, fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text.primary },
  modalSubtitle: { fontSize: 13, color: COLORS.text.tertiary, marginTop: 4, marginBottom: 16 },
  modalInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, paddingHorizontal: 14 },
  modalCurrency: { fontSize: 20, fontWeight: '800', color: COLORS.text.primary, marginRight: 4 },
  modalInput: { flex: 1, fontSize: 20, fontWeight: '800', color: COLORS.text.primary, paddingVertical: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.inputBg },
  modalCancelText: { fontWeight: '700', color: COLORS.text.primary },
  modalSendBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.primary },
  modalSendText: { fontWeight: '700', color: COLORS.onPrimary },
});
