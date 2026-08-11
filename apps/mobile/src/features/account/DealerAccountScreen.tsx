import { Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { DestructiveButton } from '@/components/buttons/DestructiveButton';
import { ExpandableLocaleSwitcher } from '@/components/ExpandableLocaleSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { MoreBoard } from '@/features/more/components/MoreBoard';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { DEALER_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';

type LinkRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function LinkRow({ icon, label, onPress }: LinkRowProps) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <Pressable
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: 48,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.brandSoft,
        }}
      >
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <AppText variant="body" weight="medium" style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      <Ionicons
        name={isRTL ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={colors.textMuted}
      />
    </Pressable>
  );
}

/**
 * Premium Dealer Account hub — company identity, prefs, finance links, security, logout.
 */
export function DealerAccountScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const company = user?.name?.trim() || t('mobile.dealerAccount.companyFallback');

  return (
    <ScrollableScreen
      contentContainerStyle={{
        gap: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'] + DEALER_TAB_BAR_CLEARANCE,
      }}
    >
      {showOfflineBanner ? <OfflineBanner /> : null}

      <View style={{ gap: theme.spacing.xs }}>
        <AppText
          variant="caption"
          weight={locale === 'ar' ? 'regular' : 'medium'}
          style={{
            letterSpacing: locale === 'ar' ? 0 : 1.4,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.dealerAccount.eyebrow')}
        </AppText>
        <AppText
          variant="title"
          weight={titleWeight}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.tabs.account')}
        </AppText>
      </View>

      <MoreBoard
        style={{
          padding: theme.spacing.lg,
          paddingStart: theme.spacing.lg + 4,
          gap: theme.spacing.sm,
          alignItems: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        <AppText variant="caption" color="muted">
          {t('mobile.dealerAccount.company')}
        </AppText>
        <AppText variant="heading" weight={titleWeight}>
          {company}
        </AppText>
        <AppText variant="caption" color="secondary" dir="ltr">
          @{user?.username}
        </AppText>
        {user?.email ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {user.email}
          </AppText>
        ) : null}
        {user?.phone ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {user.phone}
          </AppText>
        ) : null}
      </MoreBoard>

      <MoreBoard
        style={{
          padding: theme.spacing.lg,
          paddingStart: theme.spacing.lg + 4,
          gap: theme.spacing.md,
        }}
      >
        <AppText
          variant="caption"
          weight={locale === 'ar' ? 'regular' : 'medium'}
          style={{
            letterSpacing: locale === 'ar' ? 0 : 1.2,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.dealerAccount.ordersFinance')}
        </AppText>
        {can(user, 'invoice.read') ? (
          <LinkRow
            icon="receipt-outline"
            label={t('mobile.invoices.title')}
            onPress={() => router.push('/(app)/(customer)/invoices' as Href)}
          />
        ) : null}
        {can(user, 'statement.read') ? (
          <LinkRow
            icon="wallet-outline"
            label={t('mobile.account.statementTitle')}
            onPress={() => router.push('/(app)/(customer)/account/statement' as Href)}
          />
        ) : null}
        {can(user, 'sales-order.read') ? (
          <LinkRow
            icon="return-down-back-outline"
            label={t('mobile.returns.title')}
            onPress={() => router.push('/(app)/(customer)/returns' as Href)}
          />
        ) : null}
        {can(user, 'notification.read') ? (
          <LinkRow
            icon="notifications-outline"
            label={t('mobile.dealerAccount.notificationSettings')}
            onPress={() => router.push('/(app)/notifications' as Href)}
          />
        ) : null}
        {can(user, 'ai-chat.read') ? (
          <LinkRow
            icon="chatbubble-ellipses-outline"
            label={t('mobile.dealerAccount.assistant')}
            onPress={() => router.push('/(app)/(customer)/ai-chat' as Href)}
          />
        ) : null}
      </MoreBoard>

      <MoreBoard
        style={{
          padding: theme.spacing.lg,
          paddingStart: theme.spacing.lg + 4,
          gap: theme.spacing.md,
        }}
      >
        <AppText
          variant="caption"
          weight={locale === 'ar' ? 'regular' : 'medium'}
          style={{
            letterSpacing: locale === 'ar' ? 0 : 1.2,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.dealerAccount.preferences')}
        </AppText>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.dealerAccount.language')}
          </AppText>
          <ExpandableLocaleSwitcher />
        </View>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.dealerAccount.theme')}
          </AppText>
          <ThemeSwitcher />
        </View>
        <LinkRow
          icon="shield-checkmark-outline"
          label={t('mobile.dealerAccount.security')}
          onPress={() => router.push('/(app)/(customer)/account/security' as Href)}
        />
      </MoreBoard>

      <DestructiveButton
        label={t('auth.logout')}
        onPress={() => {
          void logout().then(() => router.replace('/(auth)/login' as Href));
        }}
      />
    </ScrollableScreen>
  );
}
