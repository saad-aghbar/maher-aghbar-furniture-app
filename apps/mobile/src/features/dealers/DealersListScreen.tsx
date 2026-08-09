import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/BackButton';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { TextField } from '@/components/forms/TextField';
import { ScrollableScreen } from '@/components/layout/ScrollableScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { ListItemEnter, haptics } from '@/motion';
import { useSmartBack } from '@/navigation/useSmartBack';
import { useTheme } from '@/theme';
import { CreateDealerSheet } from './components/CreateDealerSheet';
import { DealerListCard } from './components/DealerListCard';
import { useDealersListQuery } from './query';

function DealersScreenTitle({
  onBack,
  titleWeight,
}: {
  onBack: () => void;
  titleWeight: 'medium' | 'semibold';
}) {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();
  const leadSize = theme.sizes.touch.min;

  return (
    <View style={{ minHeight: leadSize, justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          zIndex: 1,
          justifyContent: 'center',
        }}
      >
        <BackButton onPress={onBack} />
      </View>
      <AppText
        variant="largeTitle"
        weight={titleWeight}
        align="center"
        numberOfLines={1}
        style={{ paddingHorizontal: leadSize + theme.spacing.sm }}
      >
        {t('customers.title')}
      </AppText>
    </View>
  );
}

/**
 * Dealers list — parchment boards with Waiting / In work / Done + Paid / Left.
 */
export function DealersListScreen() {
  const { user } = useAuth();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showOfflineBanner } = useNetwork();
  const router = useRouter();
  const onBack = useSmartBack('/(app)/(admin)/(tabs)' as Href);
  const allowed = can(user, 'customer.read');
  const canCreate = can(user, 'customer.create');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 280);
    return () => clearTimeout(id);
  }, [q]);

  const query = useDealersListQuery({ page: 1, pageSize: 50, q: debouncedQ });

  if (!allowed) {
    return (
      <ScrollableScreen>
        <DealersScreenTitle onBack={onBack} titleWeight={titleWeight} />
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </ScrollableScreen>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <ScrollableScreen>
        <DealersScreenTitle onBack={onBack} titleWeight={titleWeight} />
        <AppText variant="body" color="secondary">
          {t('mobile.loadingSession')}
        </AppText>
      </ScrollableScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <ScrollableScreen>
        <DealersScreenTitle onBack={onBack} titleWeight={titleWeight} />
        {showOfflineBanner ? <OfflineBanner /> : null}
        <ErrorState
          title={t('mobile.adminHome.errorTitle')}
          description={t('mobile.adminHome.errorBody')}
          retryLabel={t('mobile.adminHome.retry')}
          onRetry={() => void query.refetch()}
        />
      </ScrollableScreen>
    );
  }

  const rows = query.data?.data ?? [];

  return (
    <ScrollableScreen
      scrollProps={{
        keyboardShouldPersistTaps: 'handled',
        refreshControl: (
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.brand}
          />
        ),
      }}
    >
      <DealersScreenTitle onBack={onBack} titleWeight={titleWeight} />
      {showOfflineBanner ? <OfflineBanner /> : null}

      <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
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
          {t('mobile.dealers.pulseEyebrow')}
        </AppText>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.dealers.subtitle')}
        </AppText>
      </View>

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'stretch',
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <TextField
            value={q}
            onChangeText={setQ}
            placeholder={t('customers.searchPlaceholder')}
            returnKeyType="search"
            pill
            clearButtonMode="while-editing"
          />
        </View>
        {canCreate ? (
          <PrimaryButton
            label={t('customers.add')}
            onPress={() => {
              void haptics.selection();
              setCreateOpen(true);
            }}
            style={{
              borderRadius: theme.radius.full,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: 0,
              minHeight: theme.sizes.touch.min,
              alignSelf: 'stretch',
            }}
          />
        ) : null}
      </View>

      {rows.length === 0 ? (
        <EmptyState title={t('customers.empty')} description={t('mobile.dealers.emptyBody')} />
      ) : (
        <View style={{ gap: theme.spacing.lg, marginTop: theme.spacing.md }}>
          {rows.map((dealer, index) => (
            <ListItemEnter key={dealer.id} index={index}>
              <DealerListCard
                dealer={dealer}
                onPress={() => router.push(`/(app)/(admin)/dealers/${dealer.id}` as Href)}
              />
            </ListItemEnter>
          ))}
        </View>
      )}

      <CreateDealerSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </ScrollableScreen>
  );
}
