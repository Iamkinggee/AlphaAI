/**
 * AlphaAI — Privacy Policy
 */
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';

const LAST_UPDATED = 'April 1, 2026';

import React from 'react';
interface SectionProps { title: string; children: React.ReactNode }
function Section({ title, children }: SectionProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.textSecondary, fontFamily: 'Inter-Regular' }]}>{children}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 16, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={18} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Privacy Policy</Text>
          <Text style={[styles.updated, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Last updated: {LAST_UPDATED}</Text>
        </View>
        <View style={[styles.iconWrap, { backgroundColor: '#00B67A18' }]}>
          <Ionicons name="shield-checkmark" size={20} color="#00B67A" />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroBanner, { backgroundColor: '#00B67A15', borderColor: '#00B67A30' }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#00B67A" />
          <Text style={[styles.heroText, { color: '#00B67A', fontFamily: 'Inter-Medium' }]}>
            Your privacy matters to us. This policy explains how we collect, use, and protect your data.
          </Text>
        </View>

        <Section title="1. Information We Collect">
          We collect information you provide directly (account registration: email, name, password), information generated through usage (signal interactions, watchlist pairs, app preferences, session data), and technical information (device type, OS version, IP address, crash logs) to improve the Service.
        </Section>

        <Section title="2. How We Use Your Information">
          We use your information to: (a) provide and improve the Service; (b) send signal notifications and alerts you've configured; (c) personalise your experience and detect your risk tier; (d) communicate account updates and service announcements; (e) conduct analytics to improve signal accuracy and UX.
        </Section>

        <Section title="3. Data Storage and Security">
          Your data is stored on secure cloud infrastructure using Supabase (PostgreSQL) with row-level security enforced at the database level. Passwords are hashed using bcrypt. Sensitive data is encrypted in transit using TLS 1.3. We conduct regular security audits.
        </Section>

        <Section title="4. Data Sharing">
          We do not sell your personal data. We may share data with: (a) service providers (cloud infrastructure, analytics) under strict data processing agreements; (b) legal authorities when required by law or court order; (c) successors in the event of a merger or acquisition, with prior notice.
        </Section>

        <Section title="5. Cookies and Tracking">
          The mobile app does not use browser cookies. We use analytics SDKs (e.g., Expo Analytics) to collect anonymised usage metrics. You may opt out of analytics tracking in Settings → Privacy.
        </Section>

        <Section title="6. Push Notifications">
          With your permission, we send push notifications for signal alerts, TP hits, and account events. You can manage notification preferences in Settings → Notifications or your device's system settings at any time.
        </Section>

        <Section title="7. Data Retention">
          We retain your account data for as long as your account is active. Signal history and analytics are retained for 12 months. Upon account deletion, personal data is purged within 30 days, except where retention is required by law.
        </Section>

        <Section title="8. Your Rights">
          Depending on your jurisdiction, you may have the right to: access your data, correct inaccuracies, request deletion ("right to be forgotten"), restrict processing, and data portability. To exercise these rights, contact privacy@alphaai.app.
        </Section>

        <Section title="9. Children's Privacy">
          AlphaAI is not intended for users under the age of 18. We do not knowingly collect data from minors. If you believe a minor has registered, contact us and we will delete their account immediately.
        </Section>

        <Section title="10. International Transfers">
          Your data may be processed in countries outside your own. We ensure appropriate safeguards are in place, such as Standard Contractual Clauses approved by relevant data protection authorities.
        </Section>

        <Section title="11. Changes to This Policy">
          We may update this Privacy Policy periodically. We will notify you of significant changes via in-app notification or email at least 7 days before they take effect.
        </Section>

        <Section title="12. Contact Us">
          For privacy-related inquiries or to exercise your data rights:{'\n'}
          Email: privacy@alphaai.app{'\n'}
          Data Protection Officer: dpo@alphaai.app
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  back:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title:       { fontSize: 20 },
  updated:     { fontSize: 14, marginTop: 2 },
  iconWrap:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scroll:      { flex: 1 },
  content:     { paddingHorizontal: 20, paddingTop: 20 },
  heroBanner:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 24 },
  heroText:    { flex: 1, fontSize: 16, lineHeight: 20 },
  section:     { marginBottom: 22 },
  sectionTitle:{ fontSize: 17, marginBottom: 8 },
  body:        { fontSize: 16, lineHeight: 22 },
});
