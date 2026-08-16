import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { formatCompactHours, useLocale } from '@/i18n';
import { HoursOfText } from './HoursOfText';
import { AnimatedPressable, ProgressBar, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import {
  capacityA11yKey,
  capacityStateLabelKey,
  type CapacityState,
  type FactoryCapacityCardModel,
} from '../selectFactoryCapacity';

type Props = {
  card: FactoryCapacityCardModel;
  onPress?: () => void;
};

const TILE = 48;

function stateIcon(state: CapacityState): keyof typeof Ionicons.glyphMap {
  if (state === 'closed') return 'moon-outline';
  if (state === 'noEligibleWorkers' || state === 'unavailable') return 'warning-outline';
  if (state === 'full' || state === 'nearCapacity') return 'alert-circle-outline';
  if (state === 'moderate') return 'remove-circle-outline';
  return 'checkmark-circle-outline';
}

export function FactoryCapacityCard({ card, onPress }: Props) {
  const { t, tPlural, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const blocked = card.state === 'noEligibleWorkers';
  const closed = card.state === 'closed';
  const full = card.state === 'full';
  const alerted = blocked || full || card.state === 'unavailable';

  const accent = blocked || card.state === 'unavailable'
    ? colors.warning
    : full
      ? colors.error
      : card.state === 'nearCapacity'
        ? colors.warning
        : closed
          ? colors.borderStrong
          : colors.brand;

  const fill =
    closed
      ? colors.calendarLoadClosed
      : blocked || card.state === 'unavailable'
        ? colors.warning
        : full || card.state === 'nearCapacity'
          ? colors.calendarLoadBusy
          : card.state === 'moderate'
            ? colors.calendarLoadHalf
            : colors.calendarLoadLight;

  const pillBg = blocked || card.state === 'unavailable' || card.state === 'nearCapacity'
    ? colors.warningSoft
    : full
      ? colors.errorSoft
      : closed
        ? colors.surfaceSecondary
        : colors.brandSoft;
  const pillInk = blocked || card.state === 'unavailable' || card.state === 'nearCapacity'
    ? colors.warning
    : full
      ? colors.error
      : closed
        ? colors.textSecondary
        : colors.brand;

  const a11y =
    blocked || full || closed
      ? t(capacityA11yKey(card.state), { name: card.name })
      : t(capacityA11yKey(card.state), {
          name: card.name,
          percent: card.utilizationPercent,
          hours: card.remainingHours,
        });

  const workersLabel =
    card.eligibleWorkerCount === 0
      ? t('mobile.adminScheduling.capacity.eligibleWorkersZero')
      : tPlural('mobile.adminScheduling.capacity.eligibleWorkers', card.eligibleWorkerCount);

  const inner = (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: alerted ? 1 : 0.55,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.sm + 2,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            width: TILE,
            height: TILE,
            borderRadius: theme.radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alerted ? colors.warningSoft : closed ? colors.surfaceSecondary : colors.brandSoft,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: alerted ? accent : colors.border,
          }}
        >
          {blocked || closed || card.state === 'unavailable' ? (
            <Ionicons name={stateIcon(card.state)} size={18} color={accent} />
          ) : (
            <AppText
              variant="caption"
              weight="semibold"
              dir="ltr"
              style={{ color: accent, fontVariant: ['tabular-nums'], fontSize: 13 }}
            >
              {formatCompactHours(locale, card.remainingHours)}
            </AppText>
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={1}
              style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
            >
              {card.name}
            </AppText>
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
                backgroundColor: pillBg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: pillInk,
                maxWidth: '58%',
              }}
            >
              <Ionicons name={stateIcon(card.state)} size={11} color={pillInk} />
              <AppText
                variant="caption"
                weight="semibold"
                numberOfLines={1}
                style={{ color: pillInk, fontSize: 11, lineHeight: 14 }}
              >
                {t(capacityStateLabelKey(card.state))}
              </AppText>
            </View>
          </View>

          <AppText
            variant="caption"
            color="muted"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {closed
              ? t('mobile.adminScheduling.capacity.emptyClosed')
              : workersLabel}
          </AppText>

          {!blocked && !closed ? (
            <View
              style={{
                borderRadius: theme.radius.md,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 6,
                gap: 6,
              }}
            >
              <ProgressBar
                progress={card.utilizationPercent / 100}
                height={6}
                fillStyle={{ backgroundColor: fill }}
              />
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                <HoursOfText
                  allocated={card.allocatedHours}
                  available={card.availableHours}
                  color="secondary"
                  weight="regular"
                  style={{ fontSize: 11 }}
                />
                <AppText
                  variant="caption"
                  weight="semibold"
                  dir="ltr"
                  style={{ fontSize: 11 }}
                >
                  {formatCompactHours(locale, card.remainingHours)}
                </AppText>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );

  const frame = {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: alerted ? accent : colors.borderStrong,
    backgroundColor: colors.surface,
    overflow: 'hidden' as const,
    ...orderBoardShadow(colorScheme),
  };

  if (onPress) {
    return (
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={frame}
      >
        {inner}
      </AnimatedPressable>
    );
  }

  return (
    <View accessible accessibilityLabel={a11y} style={frame}>
      {inner}
    </View>
  );
}
