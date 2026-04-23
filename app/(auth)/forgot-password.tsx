import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors } from '@/src/constants/colors';
import { Fonts, FontSizes } from '@/src/constants/fonts';
import { Spacing, BorderRadius } from '@/src/constants/spacing';
import { apiClient } from '@/src/services/apiClient';
import { API } from '@/src/constants/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const validateEmail = (text: string) => {
    setEmail(text);
    if (text.length === 0) {
      setEmailError('');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      setEmailError('Invalid email address');
    } else {
      setEmailError('');
    }
  };

  const handleReset = async () => {
    if (!email || emailError) return;
    setIsLoading(true);
    try {
      await apiClient.post(API.AUTH.FORGOT_PASSWORD, { email });
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setIsLoading(false);
      setIsSent(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Back Button */}
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            {isSent
              ? 'Check your inbox for a password reset link.'
              : 'Enter your email and we\'ll send you a reset link.'}
          </Text>
        </Animated.View>

        {isSent ? (
          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.sentContainer}>
            <View style={styles.sentIcon}>
              <Text style={{ fontSize: 50 }}>✉️</Text>
            </View>
            <Text style={styles.sentText}>Email sent to</Text>
            <Text style={styles.sentEmail}>{email}</Text>
            <Pressable
              onPress={() => router.replace('/(auth)/sign-in')}
              style={styles.backToSignIn}
              accessibilityLabel="Back to sign in"
            >
              <Text style={styles.backToSignInText}>Back to Sign In</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View
                style={[
                  styles.inputContainer,
                  emailError ? styles.inputError : email.length > 0 ? styles.inputValid : null,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="trader@alphaai.com"
                  placeholderTextColor={Colors.textDisabled}
                  value={email}
                  onChangeText={validateEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Email input"
                />
              </View>
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </View>

            <Pressable
              onPress={handleReset}
              disabled={!email || !!emailError || isLoading}
              style={[
                styles.resetButton,
                (!email || !!emailError || isLoading) && styles.resetButtonDisabled,
              ]}
              accessibilityLabel="Send reset link"
            >
              <Text style={styles.resetButtonText}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing['7xl'],
  },
  backButton: {
    marginBottom: Spacing['3xl'],
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: FontSizes.md,
    fontFamily: 'Inter-Medium',
    color: Colors.accentPrimary,
  },
  title: {
    fontSize: FontSizes['3xl'],
    fontFamily: 'Inter-Bold',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    marginBottom: Spacing['3xl'],
    lineHeight: 22,
  },
  form: {
    gap: Spacing.xl,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Medium',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.lg,
    height: 52,
    justifyContent: 'center',
  },
  inputError: {
    borderColor: Colors.bearish + '60',
  },
  inputValid: {
    borderColor: Colors.bullish + '40',
  },
  input: {
    fontSize: FontSizes.md,
    fontFamily: 'Inter-Regular',
    color: Colors.textPrimary,
  },
  errorText: {
    fontSize: FontSizes.xs,
    fontFamily: 'Inter-Regular',
    color: Colors.bearish,
  },
  resetButton: {
    backgroundColor: Colors.accentPrimary,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonDisabled: {
    opacity: 0.4,
  },
  resetButtonText: {
    fontSize: FontSizes.lg,
    fontFamily: 'Inter-SemiBold',
    color: Colors.background,
  },
  sentContainer: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
  },
  sentIcon: {
    marginBottom: Spacing['2xl'],
  },
  sentText: {
    fontSize: FontSizes.lg,
    fontFamily: 'Inter-Regular',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  sentEmail: {
    fontSize: FontSizes.lg,
    fontFamily: 'Inter-Medium',
    color: Colors.accentPrimary,
    marginBottom: Spacing['3xl'],
  },
  backToSignIn: {
    backgroundColor: Colors.card,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing['3xl'],
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  backToSignInText: {
    fontSize: FontSizes.md,
    fontFamily: 'Inter-Medium',
    color: Colors.textPrimary,
  },
});
