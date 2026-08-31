import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  RFQ_PATH_STEPS,
  RFQ_WORKSPACE_STAGES,
  rfqPathReachedIndex,
  rfqPathTone,
  rfqSegmentFilled,
  type RfqPathStep,
  type RfqWorkspaceStage,
} from '../rfqWorkspaceStage';

export type { RfqWorkspaceStage };
export {
  isRfqWaitingForReview,
  rfqIncompleteGaps,
  rfqStageFromData,
} from '../rfqWorkspaceStage';

type Props = {
  stage: RfqWorkspaceStage;
  onChange: (stage: RfqWorkspaceStage) => void;
  hasQuote: boolean;
  hasOrder: boolean;
};

const STAGES = RFQ_WORKSPACE_STAGES;

const STAGE_ICON: Record<RfqWorkspaceStage, keyof typeof Ionicons.glyphMap> = {
  request: 'document-text-outline',
  quotation: 'receipt-outline',
  order: 'cube-outline',
};

/**
 * Request → Quotation → Order spine — period cells on a parchment board.
 * Selected = brandSoft + 3px bottom bar. Never `colors.info`.
 */
export function RfqStageRail({ stage, onChange, hasQuote, hasOrder }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const reached = rfqPathReachedIndex({ hasQuote, hasOrder });

  const labelFor = (key: RfqWorkspaceStage) => {
    switch (key) {
      case 'request':
        return t('mobile.adminRequest.stages.request');
      case 'quotation':
        return t('mobile.adminRequest.stages.quotation');
      case 'order':
        return t('mobile.adminRequest.stages.order');
    }
  };

  const pathLabel = (key: RfqPathStep) => t(`mobile.adminRequest.path.${key}`);

  const available = (key: RfqWorkspaceStage) => {
    if (key === 'request' || key === 'quotation') return true;
    return hasOrder;
  };

  const completed = (key: RfqWorkspaceStage) => {
    if (key === 'request') return hasQuote || hasOrder;
    if (key === 'quotation') return hasOrder;
    return false;
  };

  return (
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
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="git-branch-outline" size={14} color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 2, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{
              color: colors.brand,
              letterSpacing: locale === 'ar' ? 0 : 0.5,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
              lineHeight: 14,
            }}
          >
            {t('mobile.adminRequest.eyebrow')}
          </AppText>
          <View
            accessibilityLabel={t('mobile.adminRequest.stageHint')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {RFQ_PATH_STEPS.map((key, index) => {
              const tone = rfqPathTone(key, reached);
              return (
                <View
                  key={key}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                  }}
                >
                  {index > 0 ? (
                    <AppText
                      variant="caption"
                      color="muted"
                      maxFontSizeMultiplier={1.15}
                      style={{ fontSize: 11, lineHeight: 15, marginHorizontal: 4 }}
                    >
                      {isRTL ? '←' : '→'}
                    </AppText>
                  ) : null}
                  <AppText
                    variant="caption"
                    color={tone === 'upcoming' ? 'muted' : 'secondary'}
                    weight={tone === 'current' ? titleWeight : 'regular'}
                    maxFontSizeMultiplier={1.15}
                    style={{
                      fontSize: 11,
                      lineHeight: 15,
                      opacity: tone === 'upcoming' ? 0.55 : 1,
                    }}
                  >
                    {pathLabel(key)}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.sm + 2,
          ...(isRTL
            ? { paddingRight: theme.spacing.sm + 6 }
            : { paddingLeft: theme.spacing.sm + 6 }),
        }}
      >
        <View
          style={{
            height: 6,
            borderRadius: theme.radius.full,
            backgroundColor: colors.surfaceSecondary,
            overflow: 'hidden',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 2,
            padding: 1.5,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {RFQ_PATH_STEPS.map((key) => {
            const on = rfqSegmentFilled(key, reached);
            return (
              <View
                key={key}
                style={{
                  flex: 1,
                  minWidth: 6,
                  borderRadius: theme.radius.full,
                  backgroundColor: on ? colors.brand : 'transparent',
                  opacity: on && rfqPathTone(key, reached) === 'current' ? 1 : on ? 0.55 : 1,
                }}
              />
            );
          })}
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          {STAGES.map((key) => {
            const active = stage === key;
            const unlocked = available(key);
            const done = completed(key) && !active;
            const muted = !unlocked && !active;
            const ink = done ? colors.success : colors.brand;

            return (
              <AnimatedPressable
                key={key}
                variant="button"
                disabled={muted}
                onPress={() => {
                  if (muted) return;
                  void haptics.selection();
                  onChange(key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: muted }}
                accessibilityLabel={labelFor(key)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 64,
                  opacity: muted ? 0.4 : 1,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: active ? colors.brand : colors.borderStrong,
                  backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                  paddingVertical: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.xs,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                {active ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 3,
                      backgroundColor: colors.brand,
                    }}
                  />
                ) : null}
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: active || done ? ink : colors.border,
                  }}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={14} color={ink} />
                  ) : (
                    <Ionicons
                      name={STAGE_ICON[key]}
                      size={13}
                      color={active ? colors.brand : colors.textSecondary}
                    />
                  )}
                </View>
                <AppText
                  variant="caption"
                  numberOfLines={2}
                  align="center"
                  weight={active ? titleWeight : 'medium'}
                  maxFontSizeMultiplier={1.05}
                  style={{
                    fontSize: 11,
                    lineHeight: 13,
                    color: active ? colors.brand : colors.textSecondary,
                  }}
                >
                  {labelFor(key)}
                </AppText>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
