import type { Href } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { useLocale } from '@/i18n';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { useSupplierInvoiceQuery } from './query';
import { formatSupplierInvoiceLineMath, localizedNamed } from './selectPurchase';

type Props = { invoiceId: string };

export function SupplierInvoiceDetailScreen({ invoiceId }: Props) {
  const { user } = useAuth();
  const { t, locale, formatCurrency, formatDate, isRTL } = useLocale();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const canRead = can(user, 'supplier-invoice.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing' as Href;

  const query = useSupplierInvoiceQuery(invoiceId, canRead);

  if (!canRead) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }

  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={backFallback}>
        {showOfflineBanner ? <OfflineBanner /> : null}
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <ErrorState
            title={t('mobile.purchasing.errorTitle')}
            description={t('mobile.purchasing.errorBody')}
          />
          <PrimaryButton
            label={t('mobile.purchasing.retry')}
            onPress={() => void query.refetch()}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </AppScreen>
    );
  }

  const inv = query.data;
  if (!inv) {
    return (
      <AppScreen backFallback={backFallback}>
        <AppText>{t('mobile.purchasing.loading')}</AppText>
      </AppScreen>
    );
  }

  const outstanding = Number(inv.outstandingAmount) || 0;

  return (
    <AppScreen backFallback={backFallback}>
      {showOfflineBanner ? <OfflineBanner /> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: theme.spacing.md,
          flexGrow: 1,
          paddingBottom:
            theme.spacing['3xl'] +
            SURFACE_TAB_BAR_CLEARANCE +
            Math.max(insets.bottom, theme.spacing.sm),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <AppText
            variant="title"
            weight={titleWeight}
            dir="ltr"
            style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
          >
            {inv.number}
          </AppText>
          <StatusBadge status={inv.status} branded />
        </View>

        <PurchasingFloorBoard>
          <Meta label={t('catalog.supplier')} value={localizedNamed(locale, inv.supplier)} />
          {inv.purchaseOrder?.number ? (
            <Meta label={t('catalog.poShort')} value={inv.purchaseOrder.number} />
          ) : null}
          {inv.dueDate ? (
            <Meta label={t('accounting.dueDate')} value={formatDate(inv.dueDate)} />
          ) : null}
        </PurchasingFloorBoard>

        <PurchasingFloorBoard title={t('accounting.total')}>
          <Meta
            label={t('catalog.outstandingShort')}
            value={formatCurrency(outstanding)}
            danger={outstanding > 0}
          />
          <Meta
            label={t('accounting.total')}
            value={formatCurrency(Number(inv.total) || 0)}
          />
          <Meta
            label={t('catalog.paid')}
            value={formatCurrency(Number(inv.paidAmount) || 0)}
          />
        </PurchasingFloorBoard>

        <PurchasingFloorBoard title={t('catalog.materialsList')}>
          {(inv.lines ?? []).length === 0 ? (
            <AppText variant="caption" color="muted">
              —
            </AppText>
          ) : (
            (inv.lines ?? []).map((line) => (
              <View key={line.id} style={{ gap: 2 }}>
                <AppText weight="semibold" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  {line.description}
                </AppText>
                <AppText variant="caption" color="secondary" dir="ltr">
                  {formatSupplierInvoiceLineMath(
                    locale,
                    line.quantity,
                    line.unitPrice,
                    line.lineTotal,
                  )}
                </AppText>
              </View>
            ))
          )}
        </PurchasingFloorBoard>
      </ScrollView>
    </AppScreen>
  );
}

function Meta({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 11 }}
      >
        {label}
      </AppText>
      <AppText
        weight="semibold"
        style={{
          textAlign: isRTL ? 'right' : 'left',
          color: danger ? colors.warning : colors.textPrimary,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
