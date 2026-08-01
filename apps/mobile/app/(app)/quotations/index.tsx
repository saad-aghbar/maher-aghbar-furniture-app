import { localizedName } from '@maher/i18n';
import { Stack } from 'expo-router';
import { ListScreen, statusFilters } from '../../../src/features/shared/ListScreen';
import type { QuotationRow } from '../../../src/features/home/use-home-data';
import { daysUntil, formatMoney } from '../../../src/lib/format';
import { useNav } from '../../../src/lib/nav';
import { useI18n } from '../../../src/providers/i18n-provider';
import { colors } from '../../../src/theme/tokens';
import { ListRow, StatusBadge } from '../../../src/ui';

const FILTERS = statusFilters(
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'REVISION_REQUESTED',
  'EXPIRED',
);

type Row = QuotationRow & {
  total?: unknown;
  expirationDate?: string | null;
  customer?: { nameEn?: string | null; nameAr?: string | null; name?: string | null } | null;
};

export default function QuotationsScreen() {
  const { t, locale } = useI18n();
  const router = useNav();

  return (
    <>
      <Stack.Screen options={{ title: t('navigation.quotations', 'Quotations') }} />
      <ListScreen<Row>
        queryKey="quotations"
        basePath="/quotations"
        filters={FILTERS}
        emptyTitle={t('quotations.empty', 'No quotations found')}
        emptyDescription={t('common.quotesSubtitle', 'Review and electronically accept quotations.')}
        renderItem={(row) => {
          const validUntil = row.validUntil ?? row.expirationDate;
          const days = daysUntil(validUntil);
          const total = row.totalAmount ?? row.total;
          const currency = row.currency ?? 'JOD';
          const expiringSoon = days != null && days >= 0 && days <= 3;
          let expiryHint: string | undefined;
          if (days != null) {
            if (days < 0) expiryHint = t('mobile.expired', 'Expired');
            else if (days === 0) expiryHint = t('mobile.expiresToday', 'Expires today');
            else expiryHint = `${t('mobile.expiresIn', 'Expires in')} ${days}d`;
          }
          return (
            <ListRow
              title={localizedName(
                locale,
                row.customer
                  ? { nameEn: row.customer.nameEn ?? row.customer.name, nameAr: row.customer.nameAr }
                  : null,
                row.number,
              )}
              meta={`${row.number} · ${formatMoney(total, currency)}`}
              description={expiryHint}
              right={<StatusBadge status={row.status} />}
              accent={expiringSoon || (days != null && days < 0) ? colors.warning : undefined}
              onPress={() => router.push(`/quotations/${row.id}`)}
            />
          );
        }}
      />
    </>
  );
}
