import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@maher/permissions';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { AppScreen } from '@/components/layout/AppScreen';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import { PurchasingFloorBoard } from './components/PurchasingFloorBoard';
import { useSupplierStatementPdf } from './useSupplierStatementPdf';
import { PurchasingSkeleton } from './components/PurchasingSkeleton';
import { useSupplierDetailQuery, useSupplierInvoicesInfiniteQuery } from './query';
import { flattenSupplierInvoices } from './query';
import { localizedNamed } from './selectPurchase';

type Props = { supplierId: string };
type Bucket = 'open' | 'recent' | 'materials' | 'payments';

export function SupplierDetailScreen({ supplierId }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale, isRTL, formatCurrency, formatDate } = useLocale();
  const { colors, theme } = useTheme();
  const { start: startStatement, sheets: statementSheets } = useSupplierStatementPdf();
  const allowed = can(user, 'supplier.read');
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const backFallback = '/(app)/(admin)/purchasing/suppliers' as Href;
  const [bucket, setBucket] = useState<Bucket>('open');
  const query = useSupplierDetailQuery(supplierId, allowed);
  const invoicesQuery = useSupplierInvoicesInfiniteQuery(
    { supplierId },
    allowed && can(user, 'supplier-invoice.read'),
  );

  const invoices = flattenSupplierInvoices(invoicesQuery.data);
  const outstanding = invoices.reduce((sum, inv) => sum + Number(inv.outstandingAmount ?? 0), 0);
  const paid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount ?? 0), 0);
  const supplier = query.data;
  const name = supplier ? localizedNamed(locale, supplier) : '';

  const tabs: { key: Bucket; label: string; count: number }[] = useMemo(() => {
    const open = supplier?.openPurchaseOrders?.length ?? 0;
    const recent = supplier?.recentPurchaseOrders?.length ?? 0;
    const materials = supplier?.purchaseHistory?.length ?? supplier?.previousPurchases?.length ?? 0;
    return [
      { key: 'open', label: t('mobile.purchasing.summaryOpen'), count: open },
      { key: 'recent', label: t('mobile.purchasing.summaryRecent'), count: recent },
      { key: 'materials', label: t('mobile.purchasing.summaryMaterials'), count: materials },
      { key: 'payments', label: t('mobile.purchasing.summaryPayments'), count: invoices.length },
    ];
  }, [invoices.length, supplier, t]);

  if (!allowed) {
    return (
      <AppScreen backFallback={backFallback}>
        <EmptyState title={t('mobile.noModules')} description={t('mobile.noModulesHint')} />
      </AppScreen>
    );
  }
  if (query.isError && !query.data) {
    return (
      <AppScreen backFallback={backFallback}>
        <ErrorState
          title={t('mobile.purchasing.errorTitle')}
          description={t('mobile.purchasing.errorBody')}
          retryLabel={t('mobile.purchasing.retry')}
          onRetry={() => void query.refetch()}
        />
      </AppScreen>
    );
  }
  if (!supplier) {
    return (
      <AppScreen backFallback={backFallback}>
        <PurchasingSkeleton />
      </AppScreen>
    );
  }

  return (
    <AppScreen backFallback={backFallback}>
      <ScrollView contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing['3xl'] }}>
        <AppText variant="largeTitle" weight={titleWeight} align="center">
          {name}
        </AppText>
        <PurchasingFloorBoard title={t('mobile.purchasing.supplierDetailTitle')}>
          <AppText dir="ltr">{supplier.phone ?? '—'}</AppText>
          <AppText variant="caption" color="muted">
            {supplier.companyName ?? supplier.code}
          </AppText>
          {(supplier.status || 'ACTIVE') !== 'ACTIVE' ? (
            <StatusBadge status="INACTIVE" label={t('mobile.purchasing.supplierInactive')} />
          ) : (
            <StatusBadge status="ACTIVE" label={t('catalog.active')} branded />
          )}
          <SecondaryButton
            label={t('mobile.purchasing.statementPdf')}
            onPress={() => startStatement(supplier.id)}
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
          <SecondaryButton
            label={t('mobile.purchasing.openOrders')}
            onPress={() =>
              router.push(`/(app)/(admin)/purchasing/suppliers/${supplier.id}/orders` as Href)
            }
            style={{ borderRadius: theme.radius.full, minHeight: 44 }}
          />
        </PurchasingFloorBoard>

        <PurchasingFloorBoard title={t('mobile.purchasing.outstandingAp')}>
          <AppText weight="semibold" dir="ltr" style={{ color: colors.warning, fontSize: 22 }}>
            {formatCurrency(outstanding)}
          </AppText>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              justifyContent: 'space-between',
            }}
          >
            <AppText color="muted">{t('mobile.purchasing.paidAp')}</AppText>
            <AppText dir="ltr" style={{ color: colors.success }}>
              {formatCurrency(paid)}
            </AppText>
          </View>
        </PurchasingFloorBoard>

        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.sm,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
          }}
        >
          {tabs.map((tab) => {
            const active = bucket === tab.key;
            return (
              <AnimatedPressable
                key={tab.key}
                variant="button"
                onPress={() => {
                  void haptics.selection();
                  setBucket(tab.key);
                }}
                style={{
                  flex: 1,
                  minWidth: 72,
                  minHeight: 44,
                  borderRadius: theme.radius.lg,
                  backgroundColor: active ? colors.brandSoft : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderBottomWidth: active ? 3 : 0,
                  borderBottomColor: colors.brand,
                }}
              >
                <AppText variant="caption" weight={active ? titleWeight : 'medium'}>
                  {`${tab.label} (${tab.count})`}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>

        {bucket === 'open' ? (
          (supplier.openPurchaseOrders ?? []).length === 0 ? (
            <DealerEmptyPanel text={t('mobile.purchasing.openOrdersEmpty')} />
          ) : (
            (supplier.openPurchaseOrders ?? []).map((po, index) => (
              <ListItemEnter key={po.id} index={index}>
                <OrderLink
                  number={po.number}
                  status={po.status}
                  onPress={() => router.push(`/(app)/(admin)/purchasing/${po.id}` as Href)}
                />
              </ListItemEnter>
            ))
          )
        ) : null}
        {bucket === 'recent' ? (
          (supplier.recentPurchaseOrders ?? []).length === 0 ? (
            <DealerEmptyPanel text={t('mobile.purchasing.recentOrdersEmpty')} />
          ) : (
            (supplier.recentPurchaseOrders ?? []).map((po, index) => (
              <ListItemEnter key={po.id} index={index}>
                <OrderLink
                  number={po.number}
                  status={po.status}
                  onPress={() => router.push(`/(app)/(admin)/purchasing/${po.id}` as Href)}
                />
              </ListItemEnter>
            ))
          )
        ) : null}
        {bucket === 'materials' ? (
          (supplier.purchaseHistory ?? supplier.previousPurchases ?? []).length === 0 ? (
            <DealerEmptyPanel text={t('mobile.purchasing.historyEmpty')} />
          ) : (
            (supplier.purchaseHistory ?? supplier.previousPurchases ?? []).map((row, index) => (
              <ListItemEnter key={`${row.sku}-${index}`} index={index}>
                <PurchasingFloorBoard>
                  <AppText weight="medium">{row.nameEn || row.sku || '—'}</AppText>
                  <AppText variant="caption" color="muted" dir="ltr">
                    {`${row.sku ?? ''} · ${row.purchaseOrderNumber ?? ''}`}
                  </AppText>
                  {row.receiptDate ? (
                    <AppText variant="caption" color="muted" dir="ltr">
                      {formatDate(row.receiptDate)}
                    </AppText>
                  ) : null}
                </PurchasingFloorBoard>
              </ListItemEnter>
            ))
          )
        ) : null}
        {bucket === 'payments' ? (
          invoices.length === 0 ? (
            <DealerEmptyPanel text={t('mobile.purchasing.historyEmpty')} />
          ) : (
            invoices.map((inv, index) => (
              <ListItemEnter key={inv.id} index={index}>
                <OrderLink
                  number={inv.number}
                  status={inv.status}
                  onPress={() =>
                    router.push(`/(app)/(admin)/purchasing/supplier-invoices/${inv.id}` as Href)
                  }
                />
              </ListItemEnter>
            ))
          )
        ) : null}
      </ScrollView>
      {statementSheets}
    </AppScreen>
  );
}

function OrderLink({
  number,
  status,
  onPress,
}: {
  number: string;
  status: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <AnimatedPressable variant="card" onPress={() => { void haptics.selection(); onPress(); }}>
      <PurchasingFloorBoard>
        <AppText weight="medium" dir="ltr">
          {number}
        </AppText>
        <StatusBadge status={status} />
      </PurchasingFloorBoard>
    </AnimatedPressable>
  );
}
