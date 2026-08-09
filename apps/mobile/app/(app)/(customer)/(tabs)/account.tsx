import { View } from 'react-native';
import { Link, useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { LargeTitleHeader } from '@/components/layout/LargeTitleHeader';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export default function CustomerAccount() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t } = useLocale();
  const { theme } = useTheme();

  return (
    <ScrollableScreen>
      <LargeTitleHeader title={t('mobile.tabs.account')} subtitle={user?.name} />
      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="bodySecondary" color="secondary">
          {user?.username}
        </AppText>
        {can(user, 'ai-chat.read') ? (
          <Link href={'/(app)/(customer)/ai-chat' as Href} asChild>
            <SecondaryButton label={t('mobile.aiChat.title')} onPress={() => undefined} />
          </Link>
        ) : null}
        {can(user, 'invoice.read') ? (
          <Link href={'/(app)/(customer)/invoices' as Href} asChild>
            <SecondaryButton label={t('mobile.invoices.title')} onPress={() => undefined} />
          </Link>
        ) : null}
        {can(user, 'statement.read') ? (
          <Link href={'/(app)/(customer)/account/statement' as Href} asChild>
            <SecondaryButton label={t('mobile.account.statementTitle')} onPress={() => undefined} />
          </Link>
        ) : null}
        {can(user, 'sales-order.read') ? (
          <Link href={'/(app)/(customer)/returns' as Href} asChild>
            <SecondaryButton label={t('mobile.returns.title')} onPress={() => undefined} />
          </Link>
        ) : null}
        <DestructiveButton
          label={t('auth.logout')}
          onPress={() => {
            void logout().then(() => router.replace('/(auth)/login' as Href));
          }}
        />
      </View>
    </ScrollableScreen>
  );
}
