import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { useMaherDensity } from '@/adaptive/density';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  /** Bottom inset so the dock clears the floating pill / home indicator. */
  paddingBottom: number;
  testID?: string;
};

/** Always-visible sign-out bar under Account / More / Profile scroll. */
export function StickyLogoutDock({
  paddingBottom,
  testID = 'account-logout-dock',
}: Props) {
  const { logout } = useAuth();
  const router = useRouter();
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const density = useMaherDensity();

  return (
    <View
      testID={testID}
      style={{
        width: '100%',
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom,
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        alignItems: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth: density.contentMaxWidth }}>
        <DestructiveButton
          testID={`${testID}-button`}
          label={t('auth.logout')}
          onPress={() => {
            void logout().then(() => router.replace('/(auth)/login' as Href));
          }}
          style={{ borderRadius: theme.radius.xl }}
        />
      </View>
    </View>
  );
}
