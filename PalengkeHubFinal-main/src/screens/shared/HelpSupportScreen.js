// src/screens/shared/HelpSupportScreen.js
// Shared Help & Support hub used by BOTH Customer and Vendor profiles.
// Navigate with { role: 'customer' } or { role: 'vendor' } route params to get
// role-tailored FAQs, contact channels, and troubleshooting guides.

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { useColors } from '../../contexts/ThemeContext';

const SUPPORT_EMAIL = 'support@palengkehub.com';

const CONTENT = {
  customer: {
    intro: 'Get answers about ordering, payments, pickups and refunds - or reach the PalengkeHub support team directly.',
    faqs: [
      {
        q: 'How do I place an order?',
        a: "Open the Home tab, pick a stall or product, add items to your cart, then tap Checkout. Once the vendor confirms, you will receive a Pickup Pass with your pickup details.",
      },
      {
        q: 'How do I track my order?',
        a: 'Go to the Orders tab to follow live updates: Ordered > Confirmed > Preparing > Ready for pickup > Completed. Push notifications are sent at every step.',
      },
      {
        q: 'What payment methods can I use?',
        a: 'Depending on what you selected at checkout, you can pay via GCash or in cash when you pick up your order at the market.',
      },
      {
        q: 'Where do I pick up my order?',
        a: 'Each stall lists its exact location inside Lipa City Public Market. Your Pickup Pass shows the stall number plus a map so you can find it easily.',
      },
      {
        q: 'How do I change my language?',
        a: "Go to Profile > Language and choose English or Filipino. The app defaults to English.",
      },
      {
        q: 'Is my personal data safe?',
        a: 'Yes. We only collect what is needed to run your orders and we never sell your data. See Privacy & Policy in your Profile for the full details.',
      },
    ],
    guideTitle: 'Order issue resolution & refund guidance',
    guides: [
      {
        icon: 'alert-circle-outline',
        title: 'Wrong or missing item',
        steps: [
          'Open the order in your Orders tab.',
          'Message the vendor first via Chat - most issues are fixed right away.',
          'If unresolved, tap Report an Issue to file a report with market admins.',
        ],
      },
      {
        icon: 'cash-outline',
        title: 'Requesting a refund',
        steps: [
          'Refunds cover paid-but-unfulfilled orders and verified item complaints.',
          'File within 24 hours of pickup through Report an Issue.',
          'Approved GCash refunds are processed within 3-5 business days; cash refunds at the stall.',
        ],
      },
      {
        icon: 'time-outline',
        title: 'Order stuck in Pending?',
        steps: [
          'Vendors confirm orders manually - allow up to 30 minutes.',
          'Still nothing? Message the vendor in Chat or contact support below.',
        ],
      },
    ],
    chatLabel: 'Chat Support',
    chatHint: 'Message support or a vendor',
  },
  vendor: {
    intro: 'Guides for managing your products, fulfilling orders, and running your stall - plus direct access to the PalengkeHub support team.',
    faqs: [
      {
        q: 'How do I add or update products?',
        a: 'Open the Products tab and tap Add Product. Set your name, price, stock and photo. Edits go live for customers instantly.',
      },
      {
        q: 'How do I manage incoming orders?',
        a: 'The Orders tab shows new orders first. Tap an order to Confirm it, mark it Preparing while packing, then Ready when the customer can pick up.',
      },
      {
        q: 'When do customers pick up orders?',
        a: 'Customers see your stall location and pickup instructions in their Pickup Pass. Have the order packed and marked Ready before they arrive.',
      },
      {
        q: 'Why is my product not showing to customers?',
        a: 'Check that stock is greater than zero and the product is toggled available. Products with zero stock are hidden automatically.',
      },
      {
        q: 'How do I see my sales performance?',
        a: 'The Reports tab shows daily sales, top products and order trends so you can track what sells best.',
      },
      {
        q: 'What are my responsibilities as a vendor?',
        a: 'Keep prices accurate, maintain fresh stock, confirm orders promptly, and honor approved refunds. See Privacy & Policy for your full rights and duties.',
      },
    ],
    guideTitle: 'Troubleshooting: products & orders',
    guides: [
      {
        icon: 'cube-outline',
        title: 'Product not appearing in search',
        steps: [
          'Verify stock is above zero and availability is ON.',
          'Make sure the product name is spelled clearly for search.',
          'Re-open the product and re-save if changes did not publish.',
        ],
      },
      {
        icon: 'receipt-outline',
        title: 'Cannot confirm an order',
        steps: [
          'Refresh the Orders tab - statuses sync in real time.',
          'Check your internet connection and pull down to refresh.',
          'If it persists, report it via Report an Issue in your Profile.',
        ],
      },
      {
        icon: 'trending-down-outline',
        title: 'Sales look wrong in Reports',
        steps: [
          'Reports only count completed orders - cancelled ones are excluded.',
          'Pull to refresh to reload the latest figures.',
        ],
      },
    ],
    chatLabel: 'Chat Admin Support',
    chatHint: 'Talk to market administrators',
  },
};

export default function HelpSupportScreen({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const role = route?.params?.role === 'vendor' ? 'vendor' : 'customer';
  const data = CONTENT[role];
  const [openFaq, setOpenFaq] = useState(-1);
  const [openGuide, setOpenGuide] = useState(-1);
  const [emailSent, setEmailSent] = useState(false);

  // App.js's global header is driven by a hand-tracked `activeRouteName`,
  // not React Navigation's real current route — screens have to set it
  // themselves on focus (see ChatDetailScreen.js for the original
  // pattern). This screen never did, so activeRouteName stayed stuck on
  // whatever screen you navigated from (usually "Profile"), and the
  // global header rendered THAT screen's title ("My Profile") stacked
  // above this screen's own "Help & Support" header.
  useEffect(() => {
    const updateRoute = () => {
      if (global.updateRouteName) global.updateRouteName('HelpSupport');
      if (global.setActiveRouteName) global.setActiveRouteName('HelpSupport');
    };
    const resetRoute = () => {
      if (global.updateRouteName) global.updateRouteName('Profile');
      if (global.setActiveRouteName) global.setActiveRouteName('Profile');
    };
    updateRoute();
    const unsubscribeFocus = navigation.addListener('focus', updateRoute);
    const unsubscribeBlur = navigation.addListener('blur', resetRoute);
    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      resetRoute();
    };
  }, [navigation]);

  const openChat = () => {
    if (role === 'vendor') {
      navigation.navigate('VendorDashboard', { screen: 'VendorChats' });
    } else {
      navigation.navigate('Chats');
    }
  };

  const openEmail = () => {
    const subject = encodeURIComponent(`PalengkeHub ${role} support request`);
    const body = encodeURIComponent('Please describe your issue here...');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`.replace(/%20/g, '+')).catch(() => {});
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 2500);
  };

  return (
    <View style={styles.container}>
      <Header
        title="Help & Support"
        subtitle={role === 'vendor' ? 'Vendor support center' : 'Customer support center'}
        showBack
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.introCard}>
          <Ionicons name="hand-left-outline" size={22} color={COLORS.primary} />
          <Text style={styles.introText}>{data.intro}</Text>
        </View>

        <Text style={styles.sectionTitle}>Contact Support</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.contactRow} onPress={openChat} activeOpacity={0.7}>
            <View style={[styles.contactIcon, { backgroundColor: COLORS.accentSoft || '#E0F2FE' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>{data.chatLabel}</Text>
              <Text style={styles.contactHint}>{data.chatHint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.text.lighter} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contactRow, { borderBottomWidth: 0 }]}
            onPress={openEmail}
            activeOpacity={0.7}
          >
            <View style={[styles.contactIcon, { backgroundColor: COLORS.accentSoft || '#FEF3C7' }]}>
              <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>Email Us</Text>
              <Text style={styles.contactHint}>{SUPPORT_EMAIL}</Text>
            </View>
            {emailSent ? (
              <Ionicons name="checkmark" size={18} color={COLORS.success} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={COLORS.text.lighter} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <View style={styles.card}>
          {data.faqs.map((f, i) => (
            <View key={i} style={i < data.faqs.length - 1 && styles.divider}>
              <TouchableOpacity
                style={styles.faqHead}
                onPress={() => setOpenFaq(openFaq === i ? -1 : i)}
                activeOpacity={0.7}
              >
                <Text style={[styles.faqQ, openFaq === i && { color: COLORS.primary }]}>{f.q}</Text>
                <Ionicons name={openFaq === i ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.text.lighter} />
              </TouchableOpacity>
              {openFaq === i && <Text style={styles.faqA}>{f.a}</Text>}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{data.guideTitle}</Text>
        {data.guides.map((g, i) => (
          <TouchableOpacity
            key={i}
            style={styles.guideCard}
            onPress={() => setOpenGuide(openGuide === i ? -1 : i)}
            activeOpacity={0.7}
          >
            <View style={styles.guideHeadRow}>
              <Ionicons name={g.icon} size={20} color={COLORS.primary} />
              <Text style={styles.guideTitle}>{g.title}</Text>
              <Ionicons
                name={openGuide === i ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={COLORS.text.lighter}
                style={{ marginLeft: 'auto' }}
              />
            </View>
            {openGuide === i && (
              <View style={{ marginTop: 10, gap: 8 }}>
                {g.steps.map((s, j) => (
                  <View key={j} style={styles.stepRow}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>{j + 1}</Text></View>
                    <Text style={styles.stepText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        ))}

        <Text style={styles.footer}>
          PalengkeHub - Lipa City Public Market{'\n'}Typical response time: within 24 hours
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    body: { padding: 16, paddingBottom: 40 },
    introCard: {
      flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: COLORS.surface,
      borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: 20,
    },
    introText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.text.medium },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text.dark, marginBottom: 10, marginTop: 4 },
    card: {
      backgroundColor: COLORS.surface, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 16,
      borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: 20,
    },
    divider: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
    contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
    contactIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    contactTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text.dark },
    contactHint: { fontSize: 13, color: COLORS.text.lighter, marginTop: 2 },
    faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
    faqQ: { flex: 1, fontSize: 14.5, fontWeight: '700', color: COLORS.text.dark, marginRight: 10 },
    faqA: { fontSize: 14, lineHeight: 21, color: COLORS.text.medium, paddingBottom: 14 },
    guideCard: {
      backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, borderWidth: 1,
      borderColor: COLORS.borderLight, marginBottom: 12,
    },
    guideHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    guideTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text.dark, flex: 1 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    stepNum: {
      width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.accentSoft || '#FEE2E2',
      alignItems: 'center', justifyContent: 'center',
    },
    stepNumText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
    stepText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLORS.text.medium },
    footer: { textAlign: 'center', fontSize: 12, lineHeight: 18, color: COLORS.text.lighter, marginTop: 12 },
  });