import { useMutation, useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { can } from '@maher/permissions';
import { promoteProductFromOrderLine, promoteVariantFromOrderLine } from '@/api/modules/catalogAdmin';
import { queryKeys } from '@/api/queryKeys';
import { toastMessageForError } from '@/api/queryClient';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { isApiError } from '@/api/errors';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { CommercialSummaryLine } from '@/api/modules/sales-orders';

type Props = {
  orderId: string;
  lines: CommercialSummaryLine[];
};

export function CatalogPromotionBoard({ orderId, lines }: Props) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const qc = useQueryClient();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const allowed = can(user, 'catalog.manage');
  const custom = lines.filter((line) => String(line.manufacturingComplexity).toUpperCase() === 'CUSTOM');

  const promote = useMutation({
    mutationFn: (args: { lineId: string; productId?: string | null }) =>
      args.productId
        ? promoteVariantFromOrderLine(args.productId, args.lineId)
        : promoteProductFromOrderLine(args.lineId),
    onSuccess: async () => {
      showToast({ variant: 'success', message: t('catalog.promotedFromOrder') });
      await qc.invalidateQueries({ queryKey: queryKeys.salesOrders.detail(orderId) });
    },
    onError: (err) => {
      showToast({
        variant: 'error',
        message: isApiError(err) ? toastMessageForError(err) : t('errors.REQUEST_FAILED'),
      });
    },
  });

  if (!allowed || !custom.length) return null;

  return (
    <DealerBoard title={t('catalog.promoteFromOrder')} titleWeight={titleWeight}>
      <View style={{ gap: theme.spacing.sm }}>
        {custom.map((line) => (
          <View key={line.id} style={{ gap: theme.spacing.xs }}>
            <AppText>{line.description}</AppText>
            <SecondaryButton
              testID="catalog-promote-product"
              label={t('catalog.promoteFromOrder')}
              onPress={() => {
                void haptics.selection();
                promote.mutate({ lineId: line.id });
              }}
              loading={promote.isPending}
            />
            {line.productId ? (
              <SecondaryButton
                testID="catalog-promote-variant"
                label={t('catalog.promoteVariantFromOrder')}
                onPress={() => {
                  void haptics.selection();
                  promote.mutate({ lineId: line.id, productId: line.productId });
                }}
                loading={promote.isPending}
              />
            ) : null}
          </View>
        ))}
      </View>
    </DealerBoard>
  );
}
