import type { Locale } from '@maher/types';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { resolveHomePersona } from '../../../src/permissions/can';
import { visibleLinks } from '../../../src/permissions/workspace';
import { useAuth } from '../../../src/providers/auth-provider';
import { useI18n } from '../../../src/providers/i18n-provider';
import { initials } from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { colors, radius, spacing } from '../../../src/theme/tokens';
import { Button, Card, Chip, Screen, Section, Text } from '../../../src/ui';

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'he', label: 'עברית' },
];

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { t, locale, setLocale, direction } = useI18n();
  const router = useNav();
  const Chevron = direction === 'rtl' ? ChevronLeft : ChevronRight;
  const links = visibleLinks(user);
  const persona = user ? resolveHomePersona(user) : 'generic';

  const confirmLogout = () => {
    Alert.alert(
      t('auth.logout', 'Sign out'),
      t('mobile.logoutConfirm', 'Are you sure you want to sign out?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('auth.logout', 'Sign out'),
          style: 'destructive',
          onPress: () => void logout(),
        },
      ],
    );
  };

  return (
    <Screen>
      <Card>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text variant="heading" color="inverse" latin>
              {initials(user?.name)}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text variant="heading" numberOfLines={1}>
              {user?.name}
            </Text>
            <Text variant="caption" color="secondary" latin numberOfLines={1}>
              {user?.email}
            </Text>
            <Text variant="micro" color="brand">
              {t(`mobile.persona.${persona}`, '')}
            </Text>
          </View>
        </View>
        <View style={styles.roles}>
          <Text variant="caption" color="secondary">
            {t('common.rolesLabel', 'Roles')}
          </Text>
          <Text variant="caption">{(user?.roles ?? []).join(' · ') || '—'}</Text>
        </View>
      </Card>

      <Section title={t('common.language', 'Language')}>
        <View style={styles.row}>
          {LOCALES.map(({ code, label }) => (
            <Chip
              key={code}
              label={label}
              active={locale === code}
              onPress={() => setLocale(code)}
            />
          ))}
        </View>
      </Section>

      {links.length > 0 ? (
        <Section title={t('common.workspace', 'Workspace')}>
          <Card padded={false}>
            {links.map((link, index) => (
              <Pressable
                key={link.key}
                accessibilityRole="button"
                onPress={() => router.push(link.href)}
                style={({ pressed }) => [
                  styles.link,
                  index > 0 && styles.linkDivider,
                  pressed && styles.pressed,
                ]}
              >
                <Text variant="body">{t(link.labelKey, link.key)}</Text>
                <Chevron size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title={t('navigation.settings', 'Settings')}>
        <Button
          label={t('auth.logout', 'Sign out')}
          variant="subtle"
          onPress={confirmLogout}
          fullWidth
          icon={<LogOut size={18} color={colors.brand} />}
          style={styles.logout}
        />
        <Text variant="micro" color="tertiary" latin style={styles.version}>
          {`v${Constants.expoConfig?.version ?? '1.0.0'}`}
        </Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: { flex: 1, gap: 2 },
  roles: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    minHeight: 52,
  },
  linkDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
  logout: { borderColor: colors.error },
  version: { textAlign: 'center', marginTop: spacing.sm },
});
