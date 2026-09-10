import { useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { returnCtaStyle } from './returnFloorCta';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import type { ReturnPiece } from '../api';
import { dealerPieceJourneyKey, pieceDecisionLabelKey } from '../returnPiece';

type Props = {
  piece: ReturnPiece | null;
  dealerFacing?: boolean;
  canCancel?: boolean;
  cancelling?: boolean;
  onClose: () => void;
  onCancel?: () => void;
};

export function ReturnPieceSheet({
  piece,
  dealerFacing,
  canCancel,
  cancelling,
  onClose,
  onCancel,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  if (!piece) return null;
  const lines = piece.recoveryLines ?? [];

  return (
    <BottomSheet
      open={Boolean(piece)}
      onClose={onClose}
      sheetHeight={Math.round(height * 0.62)}
      expandable
      title={t('mobile.returns.pieceDrillTitle', { code: piece.code })}
    >
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md }}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <AppText weight={titleWeight} dir="ltr">
            {piece.code}
          </AppText>
          <StatusBadge status={piece.state} dot />
        </View>
        <AppText variant="caption" color="muted">
          {piece.productDesc}
        </AppText>
        <AppText>
          {dealerFacing
            ? t(dealerPieceJourneyKey(piece))
            : t(pieceDecisionLabelKey(piece.decision))}
        </AppText>
        {piece.receivedCondition ? (
          <AppText variant="caption" color="muted">
            {t('mobile.returns.receiveCondition')}: {piece.receivedCondition}
          </AppText>
        ) : null}
        {lines.length ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText weight={titleWeight}>{t('mobile.returns.recoveryTitle')}</AppText>
            {lines.map((line) => (
              <View
                key={line.id}
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  padding: theme.spacing.md,
                }}
              >
                <AppText>{line.label}</AppText>
                <AppText variant="caption" color="muted" dir="ltr">
                  {String(line.quantity)} {line.unit} · {line.outcome}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        {canCancel && piece.state !== 'CANCELLED' && piece.state !== 'RETURNED' ? (
          <SecondaryButton
            label={t('mobile.returns.cancelPiece')}
            loading={cancelling}
            onPress={onCancel}
            style={returnCtaStyle(theme)}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}
