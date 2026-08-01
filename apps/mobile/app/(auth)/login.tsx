import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import type { Locale } from '@maher/types';
import { ApiClientError } from '../../src/api/client';
import { useAuth } from '../../src/providers/auth-provider';
import { useI18n } from '../../src/providers/i18n-provider';
import { colors, radius, spacing } from '../../src/theme/tokens';
import { Button, Card, Chip, Text, TextField } from '../../src/ui';

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'he', label: 'עברית' },
];

export default function LoginScreen() {
  const { login } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.status === 429) {
          setError(t('auth.rateLimited', 'Too many attempts. Try again later.'));
        } else {
          setError(e.body?.message ?? t('auth.loginError', 'Login failed'));
        }
      } else {
        setError(t('auth.networkError', 'Network error. Check API URL and connection.'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          <View style={styles.logo}>
            <Text variant="display" color="inverse" latin>
              M
            </Text>
          </View>
          <Text variant="title" style={styles.brandName}>
            {t('common.appName', 'Maher Al-Aghbar Furniture')}
          </Text>
          <Text variant="caption" color="secondary" style={styles.brandTagline}>
            {t('mobile.signInSubtitle', 'One login for every role.')}
          </Text>
        </View>

        <Card>
          <Text variant="heading" style={styles.formTitle}>
            {t('auth.login', 'Sign in')}
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text variant="caption" color="error">
                {error}
              </Text>
            </View>
          ) : null}

          <TextField
            label={t('auth.email', 'Email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="admin@maher-aghbar.jo"
            latin
          />

          <View style={styles.passwordWrap}>
            <TextField
              label={t('auth.password', 'Password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              placeholder="••••••••"
              style={styles.passwordInput}
              latin
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword
                  ? t('auth.hidePassword', 'Hide password')
                  : t('auth.showPassword', 'Show password')
              }
              style={styles.toggle}
            >
              {showPassword ? (
                <EyeOff size={20} color={colors.textSecondary} />
              ) : (
                <Eye size={20} color={colors.textSecondary} />
              )}
            </Pressable>
          </View>

          <Button
            label={t('auth.login', 'Sign in')}
            onPress={onSubmit}
            loading={loading}
            disabled={!email || !password}
            fullWidth
            style={styles.submit}
          />
        </Card>

        <View style={styles.localeRow}>
          {LOCALES.map(({ code, label }) => (
            <Chip
              key={code}
              label={label}
              active={locale === code}
              onPress={() => setLocale(code)}
            />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  brandBlock: { alignItems: 'center', gap: spacing.xs },
  logo: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brandName: { textAlign: 'center' },
  brandTagline: { textAlign: 'center', maxWidth: 300 },
  formTitle: { marginBottom: spacing.md },
  errorBox: {
    backgroundColor: colors.errorSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  passwordWrap: { position: 'relative', marginTop: spacing.md },
  passwordInput: { paddingEnd: 52 },
  toggle: {
    position: 'absolute',
    end: spacing.md,
    bottom: 14,
    padding: 2,
  },
  submit: { marginTop: spacing.lg },
  localeRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
});
