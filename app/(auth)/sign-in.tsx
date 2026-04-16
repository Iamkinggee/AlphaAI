import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useAuthStore } from '@/src/store/useAuthStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function InputField({
  icon, placeholder, value, onChangeText, secureTextEntry,
  toggleSecure, error, keyboardType, autoCapitalize,
}: {
  icon: IoniconName;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  toggleSecure?: () => void;
  error?: string;
  keyboardType?: any;
  autoCapitalize?: any;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <View style={[styles.field, { backgroundColor: theme.surface, borderColor: error ? theme.error : theme.border }]}>
        <Ionicons name={icon} size={18} color={theme.textTertiary} />
        <TextInput
          style={[styles.input, { color: theme.textPrimary, fontFamily: 'Inter-Regular' }]}
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
        />
        {toggleSecure && (
          <Pressable onPress={toggleSecure} hitSlop={8}>
            <Ionicons name={secureTextEntry ? 'eye-outline' : 'eye-off-outline'} size={18} color={theme.textTertiary} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={[styles.error, { color: theme.error, fontFamily: 'Inter-Regular' }]}>{error}</Text> : null}
    </View>
  );
}

export default function SignInScreen() {
  const { theme } = useTheme();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [emailErr, setEmailErr]   = useState('');
  const [passErr, setPassErr]     = useState('');

  const signIn    = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.status === 'loading');
  const authError = useAuthStore((s) => s.error);
  const clearError= useAuthStore((s) => s.clearError);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onEmail = (t: string) => {
    setEmail(t);
    setEmailErr(t.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? 'Invalid email address' : '');
  };
  const onPass = (t: string) => {
    setPassword(t);
    setPassErr(t.length > 0 && t.length < 8 ? 'Minimum 8 characters' : '');
  };

  const handleSignIn = async () => {
    if (!email || !password || emailErr || passErr) return;
    clearError();
    const ok = await signIn({ email, password });
    if (ok) router.replace('/(tabs)');
  };

  const isValid = email.length > 0 && password.length >= 8 && !emailErr && !passErr;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.logoWrap}>
          <View style={[styles.logo, { backgroundColor: theme.accentPrimaryDim, borderColor: theme.accentPrimary + '40' }]}>
            <Text style={[styles.logoText, { color: theme.accentPrimary, fontFamily: 'Inter-Bold' }]}>A</Text>
          </View>
          <Text style={[styles.brand, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>AlphaAI</Text>
          <Text style={[styles.tagline, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Institutional-grade signal detection</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View entering={FadeInDown.delay(150).duration(500)} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary, fontFamily: 'Inter-Bold' }]}>Welcome back</Text>
          <Text style={[styles.cardSub, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Sign in to your account</Text>

          <View style={styles.fields}>
            <InputField icon="mail-outline" placeholder="Email address" value={email} onChangeText={onEmail} keyboardType="email-address" error={emailErr} />
            <InputField icon="lock-closed-outline" placeholder="Password" value={password} onChangeText={onPass} secureTextEntry={!showPass} toggleSecure={() => setShowPass(!showPass)} error={passErr} />
          </View>

          {authError ? (
            <View style={[styles.authError, { backgroundColor: theme.bearishDim, borderColor: theme.bearish + '40' }]}>
              <Ionicons name="alert-circle-outline" size={14} color={theme.bearish} />
              <Text style={[styles.authErrorText, { color: theme.bearish, fontFamily: 'Inter-Regular' }]}>{authError}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSignIn}
            disabled={!isValid || isLoading}
            style={[styles.submitBtn, { backgroundColor: isValid ? theme.accentPrimary : theme.border }]}
          >
            {isLoading
              ? <ActivityIndicator color="#000" />
              : <Text style={[styles.submitText, { fontFamily: 'Inter-Bold' }]}>Sign In</Text>
            }
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotWrap}>
            <Text style={[styles.forgot, { color: theme.accentPrimary, fontFamily: 'Inter-Medium' }]}>Forgot password?</Text>
          </Pressable>
        </Animated.View>

        {/* Divider + Google */}
        <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.orRow}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.orText, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>or</Text>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <Pressable
            onPress={async () => {
              setGoogleLoading(true);
              clearError();
              const ok = await signIn({ email: 'google.user@gmail.com', password: 'GoogleDemo2026!' });
              setGoogleLoading(false);
              if (ok) router.replace('/(tabs)');
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

        {/* Sign up link */}
        <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.signupRow}>
          <Text style={[styles.signupText, { color: theme.textTertiary, fontFamily: 'Inter-Regular' }]}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text style={[styles.signupLink, { color: theme.accentPrimary, fontFamily: 'Inter-SemiBold' }]}>Sign Up</Text>
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
  logoWrap:     { alignItems: 'center', marginBottom: 36 },
  logo:         { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 14 },
  logoText:     { fontSize: 34 },
  brand:        { fontSize: 26, marginBottom: 6 },
  tagline:      { fontSize: 14 },
  card:         { borderRadius: 20, borderWidth: 1, padding: 24, marginBottom: 20 },
  cardTitle:    { fontSize: 22, marginBottom: 6 },
  cardSub:      { fontSize: 14, marginBottom: 24 },
  fields:       { gap: 12 },
  fieldWrap:    { gap: 4 },
  field:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14 },
  input:        { flex: 1, fontSize: 15, padding: 0 },
  error:        { fontSize: 12, marginLeft: 4 },
  authError:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 14 },
  authErrorText:{ flex: 1, fontSize: 13 },
  submitBtn:    { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  submitText:   { fontSize: 16, color: '#000' },
  forgotWrap:   { alignItems: 'center', marginTop: 14 },
  forgot:       { fontSize: 14 },
  orRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  divider:      { flex: 1, height: 1 },
  orText:       { fontSize: 13 },
  googleBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  googleText:   { fontSize: 15 },
  signupRow:    { flexDirection: 'row', justifyContent: 'center' },
  signupText:   { fontSize: 14 },
  signupLink:   { fontSize: 14 },
});
