import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, CountUp } from '@/motion';
import { useTheme } from '@/theme';
import { useMgmtNav, type LabeledTile } from './boardShared';

type Props = {
  tile: LabeledTile;
  atRiskNote?: string;
};

/** Overdue hero ticket — Late board. */
export function LateBoard({ tile, atRiskNote }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const nav = useMgmtNav();
  const ink = colorScheme === 'dark' ? '#2A1814' : '#3A221C';
  const ember = '#F0A27B';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${tile.label} ${tile.tile.count}`}
        onPress={() => nav(tile.tile.href, tile.tile.filter)}
        style={{
          borderRadius: theme.radius.xl,
          backgroundColor: ink,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(240,162,123,0.35)',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: 'rgba(240,162,123,0.16)',
              borderWidth: 1,
              borderColor: 'rgba(240,162,123,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="time" size={26} color={ember} />
          </View>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <AppText
              variant="caption"
              weight="semibold"
              style={{
                color: ember,
                letterSpacing: locale === 'ar' ? 0 : 1.2,
                textTransform: 'uppercase',
              }}
            >
              {tile.label}
            </AppText>
            <CountUp value={tile.tile.count} variant="heading" color={ember} />
          </View>
          <Ionicons
            name={isRTL ? 'arrow-back' : 'arrow-forward'}
            size={18}
            color="rgba(245,241,234,0.7)"
          />
        </View>
      </AnimatedPressable>
      {atRiskNote ? (
        <AppText variant="caption" color="secondary">
          {atRiskNote}
        </AppText>
      ) : null}
    </View>
  );
}
