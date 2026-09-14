// src/screens/shared/PrivacyPolicyScreen.js
// Shared Privacy & Policy screen used by BOTH Customer and Vendor profiles.
// Role-specific content is chosen via route.params.role ('customer' | 'vendor').

import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components/Header';
import { useColors } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/i18nContext';

const getContent = (t) => ({
  customer: {
    title: t('privacy_policy.title', 'Privacy & Policy'),
    subtitle: t('privacy_policy.customer_subtitle', 'Your privacy, explained'),
    intro: t(
      'privacy_policy.customer_intro',
      'PalengkeHub is committed to protecting your personal information. This policy explains what we collect, why we collect it, and what rights you have when using our marketplace.'
    ),
    sections: [
      {
        icon: 'shield-checkmark-outline',
        title: t('privacy_policy.data_protection_title', 'Data Protection & Consent Management'),
        body: [
          t(
            'privacy_policy.data_protection_p1',
            'We collect only the information needed to complete your orders: your name, contact details, delivery/pickup preference, payment confirmation, and order history.'
          ),
          t(
            'privacy_policy.data_protection_p2',
            'We never sell or rent your personal data to third parties. Vendors only receive the minimum information required to fulfill your order (e.g. stall pickup instructions).'
          ),
          t(
            'privacy_policy.data_protection_p3',
            'You can withdraw consent at any time. Opt out of marketing notifications in Profile > Notifications, or request full data deletion by contacting support.'
          ),
          t(
            'privacy_policy.data_protection_p4',
            'All personal data is encrypted in transit (HTTPS/TLS) and stored securely. Sensitive fields such as payment tokens are tokenized and never stored on our servers.'
          ),
        ],
      },
      {
        icon: 'person-circle-outline',
        title: t('privacy_policy.rights_title', 'Your Rights & Responsibilities'),
        body: [
          t('privacy_policy.rights_p1', 'You have the right to access, correct, or delete your personal data at any time.'),
          t('privacy_policy.rights_p2', 'You may request a portable copy of your data (name, orders, preferences) by emailing support@palengkehub.com.'),
          t('privacy_policy.rights_p3', 'You are responsible for keeping your account details accurate and your device secure. Report suspicious activity immediately.'),
          t('privacy_policy.rights_p4', 'You may close your account at any time. Order history is retained for compliance for up to 24 months as required by PH tax law.'),
        ],
      },
      {
        icon: 'return-down-forward-outline',
        title: t('privacy_policy.refunds_title', 'Refund & Return Procedures'),
        body: [
          t('privacy_policy.refunds_p1', 'Refunds are processed for paid-but-unfulfilled orders and verified item complaints reported within 24 hours of pickup.'),
          t('privacy_policy.refunds_p2', 'To request a refund: open the order in Orders > Report an Issue, attach a photo if relevant, and submit. Our team reviews within 1 business day.'),
          t('privacy_policy.refunds_p3', 'Approved refunds are returned to the original payment method - GCash credits typically arrive within 3-5 business days; cash refunds are issued at the stall.'),
          t('privacy_policy.refunds_p4', 'Returns are accepted for wrong or damaged items only. The stall must be given the chance to resolve the issue on the spot before escalation.'),
          t('privacy_policy.refunds_p5', 'Refunds for marketplace-level errors (wrong billing, duplicate charge) are processed with priority.'),
        ],
      },
    ],
  },
  vendor: {
    title: t('privacy_policy.title', 'Privacy & Policy'),
    subtitle: t('privacy_policy.vendor_subtitle', 'Vendor data policy'),
    intro: t(
      'privacy_policy.vendor_intro',
      'As a PalengkeHub vendor, this policy explains what stall and business data we collect, how it is used to connect you with customers, and your rights and compliance obligations under Philippine law.'
    ),
    sections: [
      {
        icon: 'shield-checkmark-outline',
        title: t('privacy_policy.vendor_data_transparency_title', 'Data Usage Transparency'),
        body: [
          t(
            'privacy_policy.vendor_data_p1',
            'We collect the information you provide in your vendor application and stall profile: business name, stall number/section, valid ID, bank or GCash payout details, contact information, product listings, and order history.'
          ),
          t(
            'privacy_policy.vendor_data_p2',
            'Your stall data is shown to customers so they can find and order from you. We never publish your personal ID images or payout details to shoppers.'
          ),
          t(
            'privacy_policy.vendor_data_p3',
            'Order data (items, totals, pickup time) is shared with the customer placing the order and with market admins for reconciliation and analytics.'
          ),
          t(
            'privacy_policy.vendor_data_p4',
            'Aggregate analytics (sales, peak times, popular items) are shown in your Reports tab. You may opt out of aggregated benchmark emails at any time.'
          ),
        ],
      },
      {
        icon: 'person-circle-outline',
        title: t('privacy_policy.vendor_rights_title', 'Vendor Rights & Responsibilities'),
        body: [
          t('privacy_policy.vendor_rights_p1', 'You retain ownership of your product and stall data; you may edit or remove your listings at any time through the Products screen.'),
          t('privacy_policy.vendor_rights_p2', 'You have the right to access, correct, or delete your account data. Contact support for a full data export.'),
          t('privacy_policy.vendor_rights_p3', 'You are responsible for keeping prices accurate, maintaining fresh stock, confirming orders promptly, and honoring approved refunds.'),
          t(
            'privacy_policy.vendor_rights_p4',
            'You must comply with the Lipa City Public Market stall rules and the Philippine Data Privacy Act of 2012. Misuse of customer data (e.g. contacting buyers outside the platform for unrelated sales) will result in account suspension.'
          ),
        ],
      },
      {
        icon: 'document-text-outline',
        title: t('privacy_policy.vendor_compliance_title', 'Compliance with Local Regulations & Marketplace Standards'),
        body: [
          t(
            'privacy_policy.vendor_compliance_p1',
            'All vendors must be registered with the Lipa City Public Market and hold valid permits (Mayors permit, FDA/BFAD where applicable). PalengkeHub may request these during application review.'
          ),
          t(
            'privacy_policy.vendor_compliance_p2',
            'We retain transaction and communication records for up to 24 months to comply with PH tax and Data Privacy Act requirements.'
          ),
          t(
            'privacy_policy.vendor_compliance_p3',
            'Marketplace standards require: truthful product listings, accurate pricing, timely order fulfillment, and respectful handling of customer reports/refunds.'
          ),
          t('privacy_policy.vendor_compliance_p4', 'Repeated policy violations may lead to temporary suspension or permanent removal from the platform.'),
        ],
      },
    ],
  },
});

export default function PrivacyPolicyScreen({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { t } = useI18n();
  const role = route?.params?.role === 'vendor' ? 'vendor' : 'customer';
  const content = useMemo(() => getContent(t), [t]);
  const data = content[role];

  // Same fix as HelpSupportScreen.js — the global header is driven by a
  // hand-tracked activeRouteName that this screen never updated, so it
  // kept showing the previous screen's title ("My Profile") stacked
  // above this screen's own header.
  useEffect(() => {
    const updateRoute = () => {
      if (global.updateRouteName) global.updateRouteName('PrivacyPolicy');
      if (global.setActiveRouteName) global.setActiveRouteName('PrivacyPolicy');
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

  const formattedDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <View style={styles.container}>
      <Header
        title={data.title}
        subtitle={data.subtitle}
        showBack
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.introCard}>
          <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} style={styles.introIcon} />
          <Text style={styles.introText}>{data.intro}</Text>
        </View>

        {data.sections.map((section, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.sectionHead}>
              <Ionicons name={section.icon} size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            {section.body.map((para, j) => (
              <Text key={j} style={styles.paragraph}>{para}</Text>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>
          {t('privacy_policy.market_footer', 'PalengkeHub - Lipa City Public Market')}{'\n'}
          {t('privacy_policy.last_updated', 'Last updated: %{date}', { date: formattedDate })}
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
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
      marginBottom: 20,
      gap: 12,
      shadowColor: COLORS.shadowDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    introIcon: {
      marginTop: 2,
    },
    introText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 21,
      color: COLORS.text.primary,
    },
    card: {
      backgroundColor: COLORS.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
      marginBottom: 16,
      shadowColor: COLORS.shadowDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.text.primary,
      flex: 1,
    },
    paragraph: {
      fontSize: 14,
      lineHeight: 22,
      color: COLORS.text.secondary,
      marginBottom: 10,
    },
    footer: {
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 18,
      color: COLORS.text.secondary,
      marginTop: 16,
    },
  });