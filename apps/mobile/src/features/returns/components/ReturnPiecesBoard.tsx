import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { returnCtaStyle } from './returnFloorCta';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { returnWorkOrderHref } from '../selectReturn';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { ReturnPiece } from '../api';
import { dealerPieceJourneyKey, pieceDecisionLabelKey } from '../returnPiece';

type Props = {
  pieces: ReturnPiece[];
  dealerFacing?: boolean;
  onPiecePress?: (piece: ReturnPiece) => void;
};

export function ReturnPiecesBoard({ pieces, dealerFacing, onPiecePress }: Props) {
  const router = useRouter();
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <DealerBoard title={t('mobile.returns.piecesTitle')} titleWeight={titleWeight}>
      {pieces.length === 0 ? (
        <DealerEmptyPanel text={t('mobile.returns.pieceDecideEmpty')} nested />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {pieces.map((piece, index) => {
            const productionHref = piece.productionOrder
              ? (returnWorkOrderHref(piece.productionOrder) as Href)
              : undefined;
            const recoveryHref = piece.recoveryOrder
              ? (returnWorkOrderHref(piece.recoveryOrder) as Href)
              : undefined;
            const caption = dealerFacing
              ? t(dealerPieceJourneyKey(piece))
              : t(pieceDecisionLabelKey(piece.decision));
            const body = (
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
                      width: 3,
                      backgroundColor: colors.brand,
                      opacity: 0.55,
                      ...(isRTL ? { right: 0 } : { left: 0 }),
                    }}
                  />
                  <View
                    style={{
                      backgroundColor: colors.surfaceSecondary,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      ...(isRTL
                        ? { paddingRight: theme.spacing.md + 4 }
                        : { paddingLeft: theme.spacing.md + 4 }),
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <AppText variant="label" weight={titleWeight} dir="ltr" numberOfLines={1}>
                      {piece.code}
                    </AppText>
                    <StatusBadge status={piece.state} dot />
                  </View>
                  <View
                    style={{
                      padding: theme.spacing.md,
                      gap: theme.spacing.sm,
                      ...(isRTL
                        ? { paddingRight: theme.spacing.md + 4 }
                        : { paddingLeft: theme.spacing.md + 4 }),
                    }}
                  >
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {piece.productDesc} · {caption}
                    </AppText>
                    {piece.state === 'RECOVERED' && !dealerFacing ? (
                      <AppText
                        variant="caption"
                        color="success"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {t('mobile.returns.quarantineWrittenOff')}
                      </AppText>
                    ) : null}
                    {piece.productionOrder && !dealerFacing ? (
                      <AppText variant="caption" dir="ltr" color="secondary">
                        {piece.productionOrder.number}
                      </AppText>
                    ) : null}
                    {!dealerFacing && (productionHref || recoveryHref) ? (
                      <View style={{ gap: theme.spacing.sm }}>
                        {productionHref ? (
                          <SecondaryButton
                            label={t('mobile.returns.openProduction')}
                            accessibilityLabel={t('mobile.returns.openProduction')}
                            onPress={() => {
                              void haptics.selection();
                              router.push(productionHref);
                            }}
                            style={returnCtaStyle(theme)}
                          />
                        ) : null}
                        {recoveryHref ? (
                          <SecondaryButton
                            label={t('mobile.returns.openRecovery')}
                            accessibilityLabel={t('mobile.returns.openRecovery')}
                            onPress={() => {
                              void haptics.selection();
                              router.push(recoveryHref);
                            }}
                            style={returnCtaStyle(theme)}
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
            );
            return (
              <ListItemEnter key={piece.id} index={index}>
                {onPiecePress ? (
                  <AnimatedPressable
                    variant="card"
                    accessibilityLabel={piece.code}
                    onPress={() => {
                      void haptics.selection();
                      onPiecePress(piece);
                    }}
                  >
                    {body}
                  </AnimatedPressable>
                ) : (
                  body
                )}
              </ListItemEnter>
            );
          })}
        </View>
      )}
    </DealerBoard>
  );
}
