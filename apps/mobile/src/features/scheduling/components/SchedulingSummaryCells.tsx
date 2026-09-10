import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { AdminScheduleStat } from '../selectAdminScheduling';
import type { TowerFocus } from '../selectFactoryTower';

const ICONS: Record<AdminScheduleStat['key'], keyof typeof Ionicons.glyphMap> = {
  today: 'today-outline',
  week: 'calendar-outline',
  unscheduled: 'file-tray-outline',
  atRisk: 'alert-circle-outline',
  conflicts: 'warning-outline',
  overtime: 'time-outline',
};

const ROWS: AdminScheduleStat['key'][][] = [
  ['today', 'week', 'unscheduled'],
  ['atRisk', 'conflicts', 'overtime'],
];

type Props = {
  stats: AdminScheduleStat[];
  focus: TowerFocus;
  onSelect: (key: TowerFocus) => void;
};

export function SchedulingSummaryCells({ stats, focus, onSelect }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const byKey = new Map(stats.map((s) => [s.key, s]));

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
          gap: theme.spacing.sm,
          padding: theme.spacing.sm + 2,
          ...(isRTL ? { paddingRight: theme.spacing.sm + 6 } : { paddingLeft: theme.spacing.sm + 6 }),
        }}
      >
        {ROWS.map((row) => (
          <View
            key={row.join('-')}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            {row.map((key) => {
              const stat = byKey.get(key);
              const selected = focus === key;
              const value = stat?.value ?? 0;
              return (
                <AnimatedPressable
                  key={key}
                  variant="button"
                  onPress={() => {
                    void haptics.selection();
                    onSelect(selected ? null : key);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 72,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: selected ? colors.brand : colors.border,
                    backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
                    padding: theme.spacing.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name={ICONS[key]} size={16} color={colors.brand} />
                  <AppText
                    variant="caption"
                    style={{
                      color: colors.textSecondary,
                      textTransform: locale === 'ar' ? 'none' : 'uppercase',
                      letterSpacing: locale === 'ar' ? 0 : 0.4,
                      textAlign: 'center',
                    }}
                  >
                    {t(`mobile.adminScheduling.stats.${key}`)}
                  </AppText>
                  <AppText variant="title" weight={titleWeight} style={{ color: colors.textPrimary }}>
                    {value}
                  </AppText>
                  {selected ? (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 10,
                        right: 10,
                        height: 3,
                        backgroundColor: colors.brand,
                        borderTopLeftRadius: 2,
                        borderTopRightRadius: 2,
                      }}
                    />
                  ) : null}
                </AnimatedPressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
