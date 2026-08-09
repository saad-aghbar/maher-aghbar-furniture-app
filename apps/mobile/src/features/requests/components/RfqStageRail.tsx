import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme, type ThemeColors } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';

export type RfqWorkspaceStage = 'request' | 'quotation' | 'order';

type Props = {
  stage: RfqWorkspaceStage;
  onChange: (stage: RfqWorkspaceStage) => void;
  hasQuote: boolean;
  hasOrder: boolean;
};

const STAGES: RfqWorkspaceStage[] = ['request', 'quotation', 'order'];

function stageIndex(stage: RfqWorkspaceStage): number {
  return STAGES.indexOf(stage);
}

function stageTint(colors: ThemeColors, key: RfqWorkspaceStage) {
  switch (key) {
    case 'request':
      return { tint: colors.brand, soft: colors.brandSoft };
    case 'quotation':
      return { tint: colors.info, soft: colors.infoSoft };
    case 'order':
      return { tint: colors.success, soft: colors.successSoft };
  }
}

function StageIcon({
  stageKey,
  color,
}: {
  stageKey: RfqWorkspaceStage;
  color: string;
}) {
  const name =
    stageKey === 'request'
      ? 'document-text-outline'
      : stageKey === 'quotation'
        ? 'receipt-outline'
        : 'cube-outline';
  return <Ionicons name={name} size={14} color={color} />;
}

/**
 * Floor-board stage spine for unapproved orders — same language as OrdersStageSpine.
 */
export function RfqStageRail({ stage, onChange, hasQuote, hasOrder }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const current = stageIndex(stage);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  /** Keep progress from collapsing when navigating back. */
  const [peak, setPeak] = useState(current);
  useEffect(() => {
    const fromData = hasOrder ? 2 : hasQuote ? 1 : 0;
    const next = Math.max(current, fromData);
    setPeak((prev) => (next > prev ? next : prev));
  }, [current, hasQuote, hasOrder]);

  const showOrderSegment = peak >= 2 || hasOrder || stage === 'order';
  const progressKeys: RfqWorkspaceStage[] = showOrderSegment
    ? STAGES
    : ['request', 'quotation'];

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

  const available = (key: RfqWorkspaceStage) => {
    if (key === 'request' || key === 'quotation') return true;
    return hasOrder;
  };

  /** Filled progress — based on peak so going back does not erase segments. */
  const filled = (key: RfqWorkspaceStage) => {
    const i = stageIndex(key);
    if (i === 0) return true;
    if (i === 1) return peak >= 1 || hasQuote || current >= 1;
    return peak >= 2 || hasOrder;
  };

  /** Workflow completion only — never mark done just for visiting. */
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
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.5,
        }}
      />

      <View
        style={{
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceSecondary,
              borderWidth: StyleSheet.hairlineWidth,
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
                letterSpacing: locale === 'ar' ? 0 : 1.2,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                fontSize: 11,
                lineHeight: 14,
              }}
            >
              {t('mobile.adminRequest.eyebrow')}
            </AppText>
            <AppText
              variant="caption"
              color="secondary"
              maxFontSizeMultiplier={1.15}
              style={{ fontSize: 11, lineHeight: 15 }}
            >
              {t('mobile.adminRequest.stageHint')}
            </AppText>
          </View>
        </View>

        <View
          style={{
            height: 6,
            borderRadius: theme.radius.full,
            backgroundColor: colors.surfaceSecondary,
            overflow: 'hidden',
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 2,
            padding: 1.5,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
        >
          {progressKeys.map((key) => {
            const on = filled(key);
            const { tint } = stageTint(colors, key);
            return (
              <View
                key={key}
                style={{
                  flex: 1,
                  minWidth: 6,
                  borderRadius: theme.radius.full,
                  backgroundColor: on ? tint : 'transparent',
                  opacity: stage === key ? 1 : on ? 0.5 : 1,
                }}
              />
            );
          })}
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.xs,
          }}
        >
          {STAGES.map((key, index) => {
            const { tint, soft } = stageTint(colors, key);
            const active = stage === key;
            const unlocked = available(key);
            const done = completed(key) && !active;
            const muted = !unlocked && !active;

            return (
              <View key={key} style={{ flex: 1, opacity: muted ? 0.4 : 1 }}>
                <AnimatedPressable
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
                    paddingTop: theme.spacing.sm,
                    paddingBottom: theme.spacing.sm,
                    paddingHorizontal: 6,
                    borderRadius: theme.radius.md,
                    backgroundColor: active ? soft : colors.surfaceSecondary,
                    borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: active ? tint : colors.border,
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
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
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: active || done ? tint : colors.border,
                      }}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={14} color={tint} />
                      ) : (
                        <StageIcon stageKey={key} color={tint} />
                      )}
                    </View>
                    <View
                      style={{
                        position: 'absolute',
                        ...(isRTL ? { left: -2 } : { right: -2 }),
                        top: -2,
                        minWidth: 16,
                        height: 16,
                        paddingHorizontal: 3,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? tint : colors.surface,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: active || done ? tint : colors.border,
                      }}
                    >
                      <AppText
                        variant="caption"
                        weight="semibold"
                        dir="ltr"
                        style={{
                          color: active ? colors.onBrand : tint,
                          fontSize: 9,
                          lineHeight: 11,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {String(index + 1)}
                      </AppText>
                    </View>
                  </View>
                  <AppText
                    variant="caption"
                    numberOfLines={1}
                    align="center"
                    weight={active ? titleWeight : 'regular'}
                    maxFontSizeMultiplier={1.05}
                    style={{
                      fontSize: isRTL ? 10 : 11,
                      lineHeight: 13,
                      textAlign: 'center',
                      color: active ? tint : colors.textSecondary,
                    }}
                  >
                    {labelFor(key)}
                  </AppText>
                </AnimatedPressable>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
