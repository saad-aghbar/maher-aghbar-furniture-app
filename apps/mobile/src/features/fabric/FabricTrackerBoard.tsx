import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { FabricRowBody } from './FabricRowBody';
import type { FabricStatusSurface, FabricTrackerRow } from './selectFabricTracker';
import { fabricGroupReadiness } from './selectFabricTracker';

type Variant = 'tracker' | 'order' | 'plan' | 'production';

type Props = {
  rows: FabricTrackerRow[];
  onPressItem?: (row: FabricTrackerRow) => void;
  compact?: boolean;
  /** Query state — the board stays on screen instead of vanishing mid-load. */
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Readiness counts from the tracker payload (`ready` of `required`). */
  ready?: number;
  required?: number;
  variant?: Variant;
  /** Stage-specific line, e.g. upholstery waiting on a named fabric. */
  blockingNote?: string | null;
};

function titleKey(variant: Variant): string {
  if (variant === 'plan') return 'mobile.purchasing.fabricReadinessTitle';
  return 'mobile.orderDetail.fabric';
}

function surfaceFor(variant: Variant): FabricStatusSurface {
  if (variant === 'plan') return 'plan';
  if (variant === 'production') return 'ops';
  return 'ops';
}

/**
 * Shared fabric board — order detail, production plan, production detail.
 * The surrounding screen already has order identity, so rows do not repeat SO.
 * Renders nothing only when the order genuinely has no fabric requirement.
 */
export function FabricTrackerBoard({
  rows,
  onPressItem,
  loading = false,
  error = false,
  onRetry,
  ready,
  required,
  variant = 'tracker',
  blockingNote,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (!loading && !error && rows.length === 0) return null;

  const computed = fabricGroupReadiness(rows);
  const readyCount = rows.length ? computed.ready : (ready ?? 0);
  const requiredCount = rows.length ? computed.required : (required ?? 0);
  const overridden = rows.some((r) => r.overridden);
  const railPad = isRTL
    ? { paddingRight: theme.spacing.lg + 4 }
    : { paddingLeft: theme.spacing.lg + 4 };
  const surface = surfaceFor(variant);

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
          backgroundColor: blockingNote ? colors.warning : colors.brand,
          opacity: blockingNote ? 0.9 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />

      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...railPad,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
        }}
      >
        <Ionicons name="color-palette-outline" size={16} color={colors.brand} />
        <AppText variant="caption" weight="semibold" style={{ color: colors.brand, flex: 1 }}>
          {t(titleKey(variant))}
        </AppText>
        {rows.length > 0 ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {t('mobile.purchasing.fabricReadyCount', {
              ready: readyCount,
              required: requiredCount,
            })}
          </AppText>
        ) : null}
      </View>

      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md, ...railPad }}>
        {loading && rows.length === 0 ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <ActivityIndicator size="small" color={colors.brand} />
            <AppText variant="caption" color="muted">
              {t('mobile.purchasing.fabricLoading')}
            </AppText>
          </View>
        ) : null}

        {error && rows.length === 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="caption" style={{ color: colors.error }}>
              {t('mobile.purchasing.fabricLoadFailed')}
            </AppText>
            {onRetry ? (
              <AnimatedPressable
                variant="button"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.purchasing.fabricRetry')}
                onPress={() => {
                  void haptics.selection();
                  onRetry();
                }}
              >
                <AppText variant="caption" weight={titleWeight} style={{ color: colors.brand }}>
                  {t('mobile.purchasing.fabricRetry')}
                </AppText>
              </AnimatedPressable>
            ) : null}
          </View>
        ) : null}

        {blockingNote ? (
          <View
            style={{
              borderRadius: theme.radius.lg,
              backgroundColor: colors.warningSoft,
              padding: theme.spacing.sm,
            }}
          >
            <AppText variant="caption" style={{ color: colors.warning }}>
              {blockingNote}
            </AppText>
          </View>
        ) : null}

        {overridden ? (
          <AppText variant="caption" style={{ color: colors.warning }}>
            {t('mobile.purchasing.fabricOverriddenNote')}
          </AppText>
        ) : null}

        {rows.map((row) => {
          const body = (
            <FabricRowBody
              row={row}
              showOrder={false}
              disclose={Boolean(onPressItem)}
              surface={surface}
            />
          );
          if (!onPressItem) {
            return <View key={row.id}>{body}</View>;
          }
          return (
            <AnimatedPressable
              key={row.id}
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={`${row.label} ${row.role ?? ''}`.trim()}
              onPress={() => {
                void haptics.selection();
                onPressItem(row);
              }}
            >
              {body}
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}
