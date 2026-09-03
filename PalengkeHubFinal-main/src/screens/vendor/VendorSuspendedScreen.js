// src/screens/vendor/VendorSuspendedScreen.js
// Reached only via App.js's root redirect when a vendor's stall is
// deactivated with deactivation_reason='price_anomaly' — distinct from
// VendorApplicationStatusScreen (never-approved applicants). The vendor
// can still fix the flagged price(s) and message admin from here; they
// just can't reach the rest of VendorDashboard while suspended, since
// "deactivated" should mean something.

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { useColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useVendorProducts } from '../../hooks/useVendorProducts';
import { priceAnomalyService } from '../../services/priceAnomalyService';
import { chatService } from '../../services/chatService';
import { supabase } from '../../../lib/supabase';
import { AddProductModal } from '../../components/vendor/AddProductModal';

export default function VendorSuspendedScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user } = useAuth();

  const [stall, setStall] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingAdminChat, setOpeningAdminChat] = useState(false);
  const [editingAnomaly, setEditingAnomaly] = useState(null);

  const { products, updateProduct } = useVendorProducts(stall?.id);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: stallData } = await supabase
        .from('stalls')
        .select('id, stall_name, stall_number')
        .eq('vendor_id', user.id)
        .maybeSingle();
      setStall(stallData || null);

      const { data: anomalyRows } = await supabase
        .from('price_anomalies')
        .select('*, product:product_id (id, name, price, unit)')
        .eq('vendor_id', user.id)
        .in('status', ['pending', 'deactivated'])
        .order('flagged_at', { ascending: false });
      setAnomalies(anomalyRows || []);
    } catch (error) {
      console.error('Error loading suspension details:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleChatWithAdmin = async () => {
    if (!stall?.id || openingAdminChat) return;
    setOpeningAdminChat(true);
    try {
      const conv = await chatService.getOrCreateAdminConversation(stall.id);
      navigation.navigate('VendorChatDetail', {
        conversationId: conv.id,
        isAdminChat: true,
        stall,
      });
    } catch (error) {
      console.error('Error opening admin chat:', error);
    } finally {
      setOpeningAdminChat(false);
    }
  };

  const openEditor = (anomaly) => {
    const product = products.find(p => p.id === anomaly.product_id) || anomaly.product;
    if (!product) return;
    setEditingAnomaly({ ...anomaly, product });
  };

  const handleSaveFix = async (productData) => {
    if (!editingAnomaly) return;
    const { _priceFlag, ...cleanData } = productData;
    const success = await updateProduct(editingAnomaly.product_id, cleanData);
    if (success) {
      setEditingAnomaly(null);
      if (_priceFlag && stall?.id && user?.id) {
        // Still anomalous even after this edit — record it and leave
        // this item in the list; nothing to auto-resolve.
        await priceAnomalyService.flagAuto({
          productId: editingAnomaly.product_id,
          stallId: stall.id,
          vendorId: user.id,
          unit: cleanData.unit,
          price: cleanData.price,
          marketAvgPrice: _priceFlag.marketAvgPrice,
          deviationPct: _priceFlag.deviationPct,
        });
      } else {
        await priceAnomalyService.autoResolveIfCompliant(editingAnomaly.product_id, cleanData.name, cleanData.price);
      }
      await load();
    }
  };

  const daysLeft = (deadline) => {
    const ms = new Date(deadline).getTime() - Date.now();
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    return days > 0 ? days : 0;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Stall Suspended" />
        <View style={styles.centerContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Stall Suspended" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.bannerCard}>
          <Ionicons name="alert-circle" size={28} color={COLORS.error} />
          <Text style={styles.bannerTitle}>{stall?.stall_name || 'Your stall'} is deactivated</Text>
          <Text style={styles.bannerText}>
            Customers can't see or buy from your stall right now because a flagged price was never
            corrected in time. Fix the price(s) below, then message admin — your stall is reviewed
            and reactivated manually once everything checks out.
          </Text>
        </View>

        <TouchableOpacity style={styles.adminButton} onPress={handleChatWithAdmin} disabled={openingAdminChat} activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.text.inverse} />
          <Text style={styles.adminButtonText}>{openingAdminChat ? 'Opening…' : 'Chat with Admin'}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Flagged prices</Text>
        {anomalies.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No flagged prices found — message admin to have your stall reviewed.</Text>
          </View>
        ) : (
          anomalies.map((a) => (
            <View key={a.id} style={styles.anomalyCard}>
              <View style={styles.anomalyHeader}>
                <Text style={styles.anomalyName} numberOfLines={1}>{a.product?.name || 'Product'}</Text>
                <View style={[styles.statusPill, a.status === 'deactivated' ? styles.statusPillDeactivated : styles.statusPillPending]}>
                  <Text style={styles.statusPillText}>
                    {a.status === 'deactivated' ? 'Caused deactivation' : `${daysLeft(a.deadline)}d left`}
                  </Text>
                </View>
              </View>
              <Text style={styles.anomalyDetail}>
                Flagged at ₱{parseFloat(a.flagged_price).toFixed(2)}
                {a.market_avg_price ? ` — market average is ₱${parseFloat(a.market_avg_price).toFixed(2)}` : ''}
              </Text>
              {a.admin_note ? <Text style={styles.anomalyNote}>Admin note: {a.admin_note}</Text> : null}
              <TouchableOpacity style={styles.fixButton} onPress={() => openEditor(a)} activeOpacity={0.8}>
                <Text style={styles.fixButtonText}>Fix Price</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <AddProductModal
        visible={!!editingAnomaly}
        onClose={() => setEditingAnomaly(null)}
        onSubmit={handleSaveFix}
        editingProduct={editingAnomaly?.product}
      />
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16, paddingBottom: 40 },
  bannerCard: {
    backgroundColor: COLORS.errorLight || '#FEE2E2',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.dark, marginTop: 10, textAlign: 'center' },
  bannerText: { fontSize: 13, color: COLORS.text.medium, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  adminButtonText: { color: COLORS.text.inverse, fontSize: 15, fontWeight: '700' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text.dark, marginBottom: 10 },
  emptyCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16 },
  emptyText: { fontSize: 13, color: COLORS.text.light },
  anomalyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  anomalyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  anomalyName: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text.dark, marginRight: 8 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillDeactivated: { backgroundColor: COLORS.error },
  statusPillPending: { backgroundColor: COLORS.warning },
  statusPillText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  anomalyDetail: { fontSize: 13, color: COLORS.text.medium, marginBottom: 4 },
  anomalyNote: { fontSize: 12, color: COLORS.text.light, fontStyle: 'italic', marginBottom: 8 },
  fixButton: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySurface || COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 6,
  },
  fixButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
});
