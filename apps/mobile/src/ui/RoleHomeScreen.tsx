import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../providers/auth-provider';

type RoleHomeProps = {
  title: string;
  subtitle: string;
  showCycleCount?: boolean;
};

export function RoleHomeScreen({ title, subtitle, showCycleCount }: RoleHomeProps) {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {user ? (
          <Text style={styles.meta}>Signed in as {user.name || user.username}</Text>
        ) : null}
        {showCycleCount ? (
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/(app)/cycle-count')}>
            <Text style={styles.secondaryButtonText}>Cycle count (barcode)</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.button, signingOut && styles.buttonDisabled]}
          onPress={onSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign out</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f2ee',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1c1612',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b635c',
    textAlign: 'center',
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: '#8a8178',
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
    backgroundColor: '#d93a2b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d93a2b',
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#d93a2b',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
