import { useState } from 'react';
import type { Href } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { useToast } from '@/components/feedback/Toast';
import { AppScreen } from '@/components/layout/AppScreen';
import { useNetwork } from '@/components/network/NetworkProvider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { SURFACE_TAB_BAR_CLEARANCE } from '@/navigation/tabBarClearance';
import { useTheme } from '@/theme';
import { EditSupplierInvoiceSheet } from './components/EditSupplierInvoiceSheet';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { useSupplierInvoiceQuery } from './query';
import { formatSupplierInvoiceLineMath, localizedNamed } from './selectPurchase';

type Props = { invoiceId: string };

export function SupplierInvoiceDetailScreen({ invoiceId }: Props) {
  const { user } = useAuth();
  const { t, locale, formatCurrency, formatDate, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showOfflineBanner } = useNetwork();
  const { showToast } = useToast();
  const canRead = can(user, 'supplier-invoice.read');
  const canEdit = can(user, 'supplier-invoice.update');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/invoices' as Href;
  const [editOpen, setEditOpen] = useState(false);

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
  const locked = inv.status === 'CANCELLED' || inv.status === 'VOID';

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
        <ListItemEnter index={0}>
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              overflow: 'hidden',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                width: 3,
                backgroundColor: colors.brand,
                opacity: 0.55,
              }}
            />
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                ...(isRTL
                  ? { paddingRight: theme.spacing.lg + 4 }
                  : { paddingLeft: theme.spacing.lg + 4 }),
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <StatusBadge status={inv.status} dot />
              {canEdit && !locked ? (
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.invoices.edit')}
                  onPress={() => {
                    void haptics.selection();
                    setEditOpen(true);
                  }}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: colors.brand,
                    backgroundColor: colors.surface,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="create-outline" size={16} color={colors.brand} />
                  <AppText variant="caption" weight={titleWeight} color="brand">
                    {t('mobile.invoices.edit')}
                  </AppText>
                </AnimatedPressable>
              ) : null}
            </View>
            <View
              style={{
                padding: theme.spacing.lg,
                ...(isRTL
                  ? { paddingRight: theme.spacing.lg + 4 }
                  : { paddingLeft: theme.spacing.lg + 4 }),
              }}
            >
              <AppText
                variant="title"
                weight={titleWeight}
                dir="ltr"
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {inv.number}
              </AppText>
            </View>
          </View>
        </ListItemEnter>

        <ListItemEnter index={1}>
          <PurchasingFloorBoard>
            <Meta label={t('catalog.supplier')} value={localizedNamed(locale, inv.supplier)} />
            {inv.purchaseOrder?.number ? (
              <Meta label={t('catalog.poShort')} value={inv.purchaseOrder.number} />
            ) : null}
            {inv.dueDate ? (
              <Meta label={t('accounting.dueDate')} value={formatDate(inv.dueDate)} />
            ) : null}
          </PurchasingFloorBoard>
        </ListItemEnter>

        <ListItemEnter index={2}>
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
        </ListItemEnter>

        <ListItemEnter index={3}>
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
        </ListItemEnter>
      </ScrollView>

      {canEdit && !locked ? (
        <EditSupplierInvoiceSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          invoice={inv}
          onSaved={() => {
            showToast({
              variant: 'success',
              message: t('mobile.invoices.editSaved'),
            });
            void query.refetch();
          }}
        />
      ) : null}
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
  const { colors, theme } = useTheme();
  const { isRTL } = useLocale();
  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingVertical: 4,
      }}
    >
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </AppText>
      <AppText
        weight="semibold"
        dir="ltr"
        style={{
          flex: 1,
          textAlign: isRTL ? 'left' : 'right',
          color: danger ? colors.error : colors.textPrimary,
        }}
      >
        {value}
      </AppText>
    </View>
  );
}
