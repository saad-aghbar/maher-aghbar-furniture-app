import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ReturnRequest } from '../api';
import { dealerPieceJourneyKey, pieceDecisionLabelKey } from '../returnPiece';

type Props = {
  row: ReturnRequest;
  dealerFacing?: boolean;
};

export function ReturnLinkageCard({ row, dealerFacing }: Props) {
  const router = useRouter();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pieces = row.pieces ?? [];
  const reships = row.reshipDeliveries ?? [];
  if (!pieces.length && !row.workOrders?.length && !reships.length && !row.salesOrder) {
    return null;
  }

  const LinkRow = ({
    title,
    caption,
    href,
  }: {
    title: string;
    caption?: string;
    href?: Href;
  }) => {
    const body = (
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          minHeight: theme.sizes.touch.min,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText variant="label" weight={titleWeight} dir="ltr" numberOfLines={1}>
            {title}
          </AppText>
          {caption ? (
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {caption}
            </AppText>
          ) : null}
        </View>
        {href ? (
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.textMuted}
          />
        ) : null}
      </View>
    );
    const hrefText = typeof href === 'string' ? href : JSON.stringify(href);
    if (!href || (dealerFacing && !hrefText.includes('/invoices/'))) return body;
    return (
      <AnimatedPressable
        variant="button"
        accessibilityLabel={title}
        onPress={() => {
          void haptics.selection();
          router.push(href);
        }}
      >
        {body}
      </AnimatedPressable>
    );
  };

  return (
    <DealerBoard title={t('mobile.returns.linkageTitle')} titleWeight={titleWeight}>
      <View style={{ gap: theme.spacing.sm }}>
        {row.salesOrder ? (
          <LinkRow
            title={row.salesOrder.number}
            caption={t('mobile.returns.linkageOriginal')}
            href={`/(app)/(admin)/orders/${row.salesOrder.id}` as Href}
          />
        ) : null}
        {pieces.map((piece) => {
          const work = piece.productionOrder ?? piece.recoveryOrder;
          return (
            <View key={piece.id} style={{ gap: theme.spacing.xs }}>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                <AppText variant="label" weight={titleWeight} dir="ltr">
                  {piece.code}
                </AppText>
                <StatusBadge status={piece.state} dot />
              </View>
              <AppText variant="caption" color="muted">
                {dealerFacing
                  ? t(dealerPieceJourneyKey(piece))
                  : t(pieceDecisionLabelKey(piece.decision))}
              </AppText>
              {work && !dealerFacing ? (
                <LinkRow
                  title={work.number}
                  caption={
                    work.originType === 'RETURN_RECOVERY'
                      ? t('mobile.returns.linkageRecovery')
                      : t('mobile.returns.linkageWork')
                  }
                  href={`/(app)/(admin)/production/${work.id}/plan` as Href}
                />
              ) : null}
            </View>
          );
        })}
        {reships.map((delivery) => (
          <LinkRow
            key={delivery.id}
            title={delivery.number}
            caption={
              delivery.deliveryDate
                ? `${t('mobile.returns.linkageReship')} · ${delivery.deliveryDate.slice(0, 10)}`
                : t('mobile.returns.linkageReship')
            }
            href={`/(app)/(admin)/deliveries/${delivery.id}` as Href}
          />
        ))}
        {(row.chargeInvoices ?? []).map((invoice) => (
          <LinkRow
            key={invoice.id}
            title={invoice.number}
            caption={t('mobile.returns.chargeInvoice')}
            href={
              (dealerFacing
                ? `/(app)/(customer)/invoices/${invoice.id}`
                : `/(app)/(admin)/invoices/${invoice.id}`) as Href
            }
          />
        ))}
      </View>
    </DealerBoard>
  );
}
