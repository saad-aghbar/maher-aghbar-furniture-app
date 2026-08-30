import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp, softFadeDown, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { barFill, useMgmtNav, type LabeledTile } from './boardShared';
import type { MgmtBlockedItem, MgmtEvent } from '../../api';
import { mapMgmtHref } from '../../mapMgmtHref';
import { haptics } from '@/motion';
import { useRouter } from 'expo-router';

type Props = {
  tiles: LabeledTile[];
  blocked: MgmtBlockedItem[];
  blockedCount: number;
  events: MgmtEvent[];
  blockedTitle: string;
};

/** Stage load bars + blocked tickets — Production board. */
export function ProductionBoard({
  tiles,
  blocked,
  blockedCount,
  events,
  blockedTitle,
}: Props) {
  const { isRTL, formatDateTime } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const nav = useMgmtNav();
  const router = useRouter();
  const max = Math.max(...tiles.map((t) => t.tile.count), blockedCount, 1);

  return (
    <View style={{ gap: theme.spacing.md }}>
      {tiles.map(({ tile, label }, index) => {
        const Row = reduce || index > 2 ? View : Animated.View;
        const enter = reduce || index > 2 ? {} : { entering: softFadeDown(40 + index * 35) };
        return (
          <Row key={tile.key} {...enter}>
            <AnimatedPressable
              variant="card"
              accessibilityRole="button"
              accessibilityLabel={`${label} ${tile.count}`}
              onPress={() => nav(tile.href, tile.filter)}
              style={{
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                backgroundColor: colors.surface,
                padding: theme.spacing.md,
                gap: 8,
                ...orderBoardShadow(colorScheme),
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <AppText variant="label" weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                  {label}
                </AppText>
                <CountUp value={tile.count} variant="title" color={colors.brand} />
              </View>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.border,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.round(barFill(tile.count, max) * 100)}%`,
                    height: '100%',
                    borderRadius: 4,
                    backgroundColor:
                      tile.key.includes('blocked') || tile.key.includes('due')
                        ? colors.warning
                        : colors.brand,
                    alignSelf: isRTL ? 'flex-end' : 'flex-start',
                  }}
                />
              </View>
            </AnimatedPressable>
          </Row>
        );
      })}

      {events.slice(0, 3).map((ev, i) => {
        const when = (() => {
          try {
            return formatDateTime(ev.at);
          } catch {
            return '';
          }
        })();
        const body = (
          <View
            key={`${ev.at}-${i}`}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
              alignItems: 'center',
              paddingVertical: theme.spacing.xs,
            }}
          >
            <AppText variant="caption" color="muted" style={{ minWidth: 52 }}>
              {when}
            </AppText>
            <AppText variant="bodySecondary" style={{ flex: 1 }} numberOfLines={2}>
              {ev.label}
            </AppText>
          </View>
        );
        if (!ev.href) return body;
        return (
          <AnimatedPressable
            key={`${ev.at}-${i}`}
            variant="button"
            accessibilityRole="button"
            onPress={() => {
              void haptics.selection();
              router.push(mapMgmtHref(ev.href!));
            }}
          >
            {body}
          </AnimatedPressable>
        );
      })}

      {blocked.length > 0 || blockedCount > 0 ? (
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.warning,
            backgroundColor: colors.warningSoft,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="label" weight="semibold" style={{ color: colors.warning }}>
            {blockedTitle}
            {blockedCount > 0 ? ` · ${blockedCount}` : ''}
          </AppText>
          {blocked.slice(0, 3).map((b) => (
            <AnimatedPressable
              key={b.id}
              variant="button"
              accessibilityRole="button"
              onPress={() => nav(b.href, b.filter)}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
                alignItems: 'center',
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.08)',
                backgroundColor: colors.surface,
                padding: theme.spacing.sm,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="body" weight="medium" numberOfLines={1}>
                  {b.title}
                </AppText>
                <AppText variant="caption" color="secondary" numberOfLines={1}>
                  {b.why}
                </AppText>
              </View>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={16}
                color={colors.textMuted}
              />
            </AnimatedPressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
