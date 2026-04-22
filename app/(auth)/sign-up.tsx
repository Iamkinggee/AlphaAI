import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, Alert,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useAuthStore } from '@/src/store/useAuthStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function InputField({
  icon, label, placeholder, value, onChangeText, secureTextEntry,
  toggleSecure, error, valid, keyboardType, autoCapitalize,
}: {
  icon: IoniconName; label?: string; placeholder: string; value: string;
  onChangeText: (t: string) => void; secureTextEntry?: boolean;
  toggleSecure?: () => void; error?: string; valid?: boolean;
  keyboardType?: any; autoCapitalize?: any;
}) {
  const { theme } = useTheme();
  const borderCol = error ? theme.error : valid ? theme.bullish + '80' : theme.border;

  return (
    <View style={styles.fieldWrap}>
      {label && <Text style={[styles.fieldLabel, { color: theme.textTertiary, fontFamily: 'Inter-Medium' }]}>{label}</Text>}
      <View style={[styles.field, { backgroundColor: theme.surface, borderColor: borderCol }]}>
        <Ionicons name={icon} size={17} color={theme.textTertiary} />
        <TextInput
          style={[styles.input, { color: theme.textPrimary, fontFamily: 'Inter-Regular' }]}
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
        />
        {toggleSecure && (
          <Pressable onPress={toggleSecure} hitSlop={10}>
            <Ionicons name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'} size={17} color={theme.textTertiary} />
          </Pressable>
        )}
        {valid && !toggleSecure && <Ionicons name="checkmark-circle" size={17} color={theme.bullish} />}
      </View>
      {error ? <Text style={[styles.errorMsg, { color: theme.error, fontFamily: 'Inter-Regular' }]}>{error}</Text> : null}
    </View>
  );
}

export default function SignUpScreen() {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [emailErr,  setEmailErr]  = useState('');
  const [passErr,   setPassErr]   = useState('');
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const signUp          = useAuthStore((s) => s.signUp);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const clearError      = useAuthStore((s) => s.clearError);

  const onEmail = (t: string) => {
    setEmail(t);
    setEmailErr(t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? 'Invalid email address' : '');
  };

  const onPass = (t: string) => {
    setPassword(t);
    if (!t) { setPassErr(''); return; }
    const checks: string[] = [];
    if (t.length < 8)         checks.push('8+ characters');
    if (!/[A-Z]/.test(t))     checks.push('uppercase');
    if (!/[0-9]/.test(t))     checks.push('number');
    setPassErr(checks.length ? `Needs: ${checks.join(', ')}` : '');
  };

  // Password strength 0–4
  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8)           s++;
    if (/[A-Z]/.test(password))         s++;
    if (/[0-9]/.test(password))         s++;
    if (/[^A-Za-z0-9]/.test(password))  s++;
    return s;
  })();
  const strengthColor = [theme.border, theme.bearish, theme.approaching, theme.approaching, theme.bullish][strength];
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];

  const isValid = firstName.length > 0 && email.length > 0 && password.length >= 8 && !emailErr && !passErr;

  const handleSignUp = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const ok = await signUp({ email, password, displayName: `${firstName} ${lastName}`.trim() });
      if (ok) {
        await AsyncStorage.setItem('@alphaai/onboarded', 'true');
        router.replace('/(tabs)');
      }
    } catch {
      // signUp store already sets the error state
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + Heading */}
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.top}>
          <View style={[styles.logo, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '40' }]}>
            <Text style={[styles.logoLetter, { color: theme.accentPrimary, fontFamily: 'Inter-Bold' }]}>A</Text>
          </View>
          <Text style={[styles.heading, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Create Account</Text>
          <Text style={[styles.subheading, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>
            Start detecting signals before the crowd
          </Text>
        </Animated.View>

        {/* Form card */}
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>

          {/* Name row */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <InputField icon="person-outline" label="First Name" placeholder="John" value={firstName} onChangeText={setFirstName} autoCapitalize="words" valid={firstName.length > 0} />
            </View>
            <View style={{ flex: 1 }}>
              <InputField icon="person-outline" label="Last Name" placeholder="Doe" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
            </View>
          </View>

          <InputField icon="mail-outline" label="Email" placeholder="trader@alphaai.com" value={email} onChangeText={onEmail} keyboardType="email-address" error={emailErr} valid={email.length > 0 && !emailErr} />

          <InputField icon="lock-closed-outline" label="Password" placeholder="Create a strong password" value={password} onChangeText={onPass} secureTextEntry={!showPass} toggleSecure={() => setShowPass(!showPass)} error={passErr} valid={strength >= 3} />

          {/* Strength meter */}
          {password.length > 0 && (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthBar}>
                {[1,2,3,4].map((lv) => (
                  <View key={lv} style={[styles.strengthSeg, { backgroundColor: strength >= lv ? strengthColor : theme.border }]} />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strengthColor, fontFamily: 'Inter-Medium' }]}>{strengthLabel}</Text>
            </View>
          )}

          {/* CTA */}
          <Pressable
            onPress={handleSignUp}
            disabled={!isValid || loading}
            style={[styles.cta, { backgroundColor: isValid ? theme.accentPrimary : theme.border }]}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <>
                  <Ionicons name="rocket-outline" size={18} color="#000" />
                  <Text style={[styles.ctaText, { fontFamily: 'Inter-Bold' }]}>Create Account</Text>
                </>
            }
          </Pressable>
        </Animated.View>

        {/* Divider + Google */}
        <Animated.View entering={FadeInDown.delay(220).duration(500)} style={styles.orRow}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.orText, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>or</Text>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(500)}>
          <Pressable
            onPress={async () => {
              setGoogleLoading(true);
              if (clearError) clearError();
              const ok = await signInWithGoogle();
              setGoogleLoading(false);
              if (ok) {
                await AsyncStorage.setItem('@alphaai/onboarded', 'true');
                router.replace('/(tabs)');
              }
            }}
            disabled={googleLoading}
            style={[styles.googleBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            {googleLoading
              ? <ActivityIndicator size="small" color={theme.textPrimary} />
              : <Ionicons name="logo-google" size={18} color={theme.textPrimary} />
            }
            <Text style={[styles.googleText, { color: theme.textPrimary, fontFamily: 'Inter-SemiBold' }]}>Continue with Google</Text>
          </Pressable>
        </Animated.View>

        {/* Sign in link */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.signinRow}>
          <Text style={[styles.signinText, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={[styles.signinLink, { color: theme.accentPrimary, fontFamily: 'Inter-SemiBold' }]}>Sign In</Text>
            </Pressable>
          </Link>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { paddingHorizontal: 24, flexGrow: 1 },
  top:          { alignItems: 'center', marginBottom: 28 },
  logo:         { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 16 },
  logoLetter:   { fontSize: 32 },
  heading:      { fontSize: 26, marginBottom: 6 },
  subheading:   { fontSize: 16, textAlign: 'center' },
  card:         { borderRadius: 20, borderWidth: 1, padding: 20, gap: 14, marginBottom: 20 },
  nameRow:      { flexDirection: 'row', gap: 10 },
  fieldWrap:    { gap: 4 },
  fieldLabel:   { fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
  field:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 13 },
  input:        { flex: 1, fontSize: 17, padding: 0 },
  errorMsg:     { fontSize: 14, marginLeft: 2 },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strengthBar:  { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSeg:  { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel:{ fontSize: 14, minWidth: 40, textAlign: 'right' },
  cta:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, marginTop: 4 },
  ctaText:      { fontSize: 18, color: '#000' },
  orRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  divider:      { flex: 1, height: 1 },
  orText:       { fontSize: 15 },
  googleBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  googleText:   { fontSize: 17 },
  signinRow:    { flexDirection: 'row', justifyContent: 'center' },
  signinText:   { fontSize: 16 },
  signinLink:   { fontSize: 16 },
});
