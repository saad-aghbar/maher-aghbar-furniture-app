import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiClientError } from '../../src/api/client';
import { useAuth } from '../../src/providers/auth-provider';

export default function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login({ username: username.trim(), password });
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.body?.message ?? 'Login failed');
      } else {
        setError('Network error. Check that the API is running.');
      }
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = username.trim().length > 0 && password.length > 0 && !loading;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Maher Al-Aghbar"
        />
        <Text style={styles.tagline}>Sign in to continue</Text>
      </View>

      <View style={styles.form}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          placeholder="admin"
          placeholderTextColor="#a8a29e"
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          placeholder="••••••••"
          placeholderTextColor="#a8a29e"
          editable={!loading}
          onSubmitEditing={() => {
            if (canSubmit) void onSubmit();
          }}
        />

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f2ee',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 220,
    height: 134,
  },
  tagline: {
    fontSize: 16,
    color: '#6b635c',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#44403c',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1c1612',
    backgroundColor: '#fafaf9',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#d93a2b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
