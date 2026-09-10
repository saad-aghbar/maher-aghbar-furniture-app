import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { formatSpecRecord } from '@/features/quality/inspectionChecklist';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = {
  returnNumber?: string | null;
  pieceCode?: string | null;
  pieceNo?: number | null;
  productDesc?: string | null;
  decision?: string | null;
  sourceOrderNumber?: string | null;
  recoveryOrderNumber?: string | null;
  specSnapshot?: {
    specifications?: string | null;
    factoryNotes?: string | null;
    orderDimensions?: Record<string, unknown> | null;
    catalogDimensions?: Record<string, unknown> | null;
  } | null;
  quarantineWrittenOff?: boolean;
  finishBlocked?: boolean;
};

export function DismantleRecoverFloorPanel({
  returnNumber,
  pieceCode,
  pieceNo,
  productDesc,
  decision,
  sourceOrderNumber,
  recoveryOrderNumber,
  specSnapshot,
  quarantineWrittenOff,
  finishBlocked,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pieceLabel = pieceCode ?? (pieceNo != null ? `#${pieceNo}` : null);
  const decisionLabel = decision
    ? t(`mobile.returns.dispositionKind.${decision}`)
    : null;
  const specLabel =
    formatSpecRecord(specSnapshot?.orderDimensions) ||
    formatSpecRecord(specSnapshot?.catalogDimensions) ||
    specSnapshot?.specifications?.trim() ||
    specSnapshot?.factoryNotes?.trim() ||
    null;

  return (
    <DealerBoard title={t('mobile.returns.recoveryWorkTitle')} titleWeight={titleWeight}>
      <View
        style={{
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
          ...orderBoardShadow(colorScheme),
        }}
        accessibilityLabel={t('mobile.returns.recoveryWorkTitle')}
      >
        {returnNumber ? (
          <AppText
            variant="caption"
            weight="semibold"
            color="brand"
            dir="ltr"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.returns.recoveryCase', { number: returnNumber })}
          </AppText>
        ) : null}
        {pieceLabel ? (
          <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.returns.recoveryPiece', { piece: pieceLabel })}
          </AppText>
        ) : null}
        {decisionLabel ? (
          <AppText variant="caption" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.returns.recoveryDecision', { decision: decisionLabel })}
          </AppText>
        ) : null}
        {sourceOrderNumber ? (
          <AppText variant="caption" color="muted" dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.returns.recoverySourceOrder', { number: sourceOrderNumber })}
          </AppText>
        ) : null}
        {recoveryOrderNumber ? (
          <AppText variant="caption" color="muted" dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {t('mobile.returns.recoveryWorkOrder', { number: recoveryOrderNumber })}
          </AppText>
        ) : null}
        {productDesc ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {productDesc}
          </AppText>
        ) : null}
        {specLabel ? (
          <AppText
            variant="caption"
            color="secondary"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.returns.recoveryOriginalSpec', { spec: specLabel })}
          </AppText>
        ) : null}
        {quarantineWrittenOff ? (
          <AppText
            variant="caption"
            weight={titleWeight}
            color="success"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {t('mobile.returns.quarantineWrittenOff')}
          </AppText>
        ) : null}
        <AppText style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.returns.recoveryWorkHint')}
        </AppText>
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.returns.recoveryStripHint')}
        </AppText>
        <AppText
          variant="caption"
          weight={titleWeight}
          color={finishBlocked ? 'warning' : 'success'}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {t('mobile.returns.recoveryFinishRule')}
        </AppText>
      </View>
    </DealerBoard>
  );
}
