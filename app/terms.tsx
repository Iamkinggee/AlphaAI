/**
 * AlphaAI — Terms of Service
 */
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';

const LAST_UPDATED = 'April 1, 2026';

interface SectionProps { title: string; children: string }
function Section({ title, children }: SectionProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.textSecondary, fontFamily: 'Inter-Regular' }]}>{children}</Text>
    </View>
  );
}

export default function TermsScreen() {
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
          <Text style={[styles.title, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Terms of Service</Text>
          <Text style={[styles.updated, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Last updated: {LAST_UPDATED}</Text>
        </View>
        <View style={[styles.iconWrap, { backgroundColor: theme.accentPrimaryDim }]}>
          <Ionicons name="document-text" size={20} color={theme.accentPrimary} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroBanner, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '30' }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.accentPrimary} />
          <Text style={[styles.heroText, { color: theme.accentPrimary, fontFamily: 'Inter-Medium' }]}>
            By using AlphaAI, you agree to these terms. Please read carefully.
          </Text>
        </View>

        <Section title="1. Acceptance of Terms">
          By accessing or using the AlphaAI application ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service. These Terms apply to all users, including visitors, registered users, and premium subscribers.
        </Section>

        <Section title="2. Description of Service">
          AlphaAI provides algorithmic cryptocurrency signal detection, market analysis tools, and AI-powered trading insights based on Smart Money Concepts (SMC). The Service is intended for informational and educational purposes only.
        </Section>

        <Section title="3. Not Financial Advice">
          All signals, analysis, and content provided by AlphaAI are for informational purposes only and do not constitute financial, investment, trading, or any other form of advice. We are not a registered investment advisor, broker-dealer, or financial institution. Trading cryptocurrencies involves substantial risk of loss.
        </Section>

        <Section title="4. Risk Disclosure">
          Cryptocurrency markets are highly volatile and speculative. Past performance of any signal or strategy does not guarantee future results. You acknowledge that you may lose some or all of your invested capital. AlphaAI and its operators shall not be held liable for any financial losses incurred from using the Service.
        </Section>

        <Section title="5. User Accounts">
          You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these Terms.
        </Section>

        <Section title="6. Prohibited Activities">
          You agree not to: (a) use the Service for any illegal purpose; (b) share your account with others; (c) attempt to reverse engineer the detection algorithms; (d) scrape, copy, or redistribute our signals commercially; (e) manipulate markets using our signals in coordination with others.
        </Section>

        <Section title="7. Intellectual Property">
          All content, algorithms, designs, and trademarks within the Service are owned by AlphaAI and protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without prior written consent.
        </Section>

        <Section title="8. Subscription and Billing">
          Premium features require a paid subscription. Subscriptions are billed on a recurring basis. You may cancel at any time; cancellation takes effect at the end of the current billing period. No refunds are issued for partial periods.
        </Section>

        <Section title="9. Limitation of Liability">
          To the maximum extent permitted by law, AlphaAI and its affiliates shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the Service, even if advised of the possibility of such damages.
        </Section>

        <Section title="10. Changes to Terms">
          We may update these Terms from time to time. We will notify you of material changes via the app or email. Continued use of the Service after changes constitutes acceptance of the updated Terms.
        </Section>

        <Section title="11. Governing Law">
          These Terms are governed by the laws of the applicable jurisdiction. Any disputes shall be resolved by arbitration, waiving the right to a jury trial or class action.
        </Section>

        <Section title="12. Contact">
          For questions about these Terms, contact us at: legal@alphaai.app
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  back:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title:       { fontSize: 18 },
  updated:     { fontSize: 12, marginTop: 2 },
  iconWrap:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scroll:      { flex: 1 },
  content:     { paddingHorizontal: 20, paddingTop: 20 },
  heroBanner:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 24 },
  heroText:    { flex: 1, fontSize: 14, lineHeight: 20 },
  section:     { marginBottom: 22 },
  sectionTitle:{ fontSize: 15, marginBottom: 8 },
  body:        { fontSize: 14, lineHeight: 22 },
});
