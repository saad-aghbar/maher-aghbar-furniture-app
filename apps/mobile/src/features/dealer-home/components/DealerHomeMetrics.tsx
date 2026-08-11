import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { DealerGlassCard } from '@/features/dealer-ui/DealerGlassCard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type MetricCard = {
  id: string;
  title: string;
  value: string;
  actionLabel: string;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  cards: MetricCard[];
};

/** Fixed tile size — all four metrics share the same footprint. */
const TILE_H = 112;

/** Soft commerce metric tiles — identical sizing, compact content. */
export function DealerHomeMetrics({ cards }: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const dark = colorScheme === 'dark';

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.md,
      }}
    >
      {cards.map((card) => (
        <AnimatedPressable
          key={card.id}
          onPress={() => {
            void haptics.selection();
            card.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${card.title} ${card.value}`}
          style={{ width: '47%', flexGrow: 1, minWidth: 140, height: TILE_H }}
        >
          <DealerGlassCard
            intensity="soft"
            style={{ height: TILE_H, width: '100%' }}
            contentStyle={{
              height: TILE_H,
              paddingVertical: theme.spacing.sm + 2,
              paddingHorizontal: theme.spacing.md,
              gap: 4,
              justifyContent: 'space-between',
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -24,
                ...(isRTL ? { left: -18 } : { right: -18 }),
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.brandSoft,
                opacity: dark ? 0.3 : 0.75,
              }}
            />

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: theme.spacing.xs,
              }}
            >
              <AppText
                variant="caption"
                style={{
                  flex: 1,
                  fontSize: 11,
                  lineHeight: 14,
                  color: colors.textSecondary,
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {card.title}
              </AppText>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
                }}
              >
                <Ionicons name={card.icon} size={15} color={colors.brand} />
              </View>
            </View>

            <AppText
              variant="heading"
              weight={titleWeight}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
                fontSize: 18,
                lineHeight: 22,
                letterSpacing: -0.2,
              }}
            >
              {card.value}
            </AppText>

            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <AppText
                variant="caption"
                weight="medium"
                style={{
                  color: colors.brand,
                  fontSize: 11,
                  lineHeight: 14,
                  flexShrink: 1,
                  textAlign: isRTL ? 'right' : 'left',
                }}
                numberOfLines={1}
              >
                {card.actionLabel}
              </AppText>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={12}
                color={colors.brand}
              />
            </View>
          </DealerGlassCard>
        </AnimatedPressable>
      ))}
    </View>
  );
}
