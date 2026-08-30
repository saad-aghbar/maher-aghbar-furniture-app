import { Text, View } from 'react-native';
import { statusLabel } from '@maher/i18n';
import { alignStart, localeRow, textAlignFor, useLocale, writingDirectionFor } from '@/i18n';
import { resolveAppFontStyle, useTheme } from '@/theme';
import {
  getBadgeContainerStyle,
  getBadgeDotColor,
  getBadgeLabelStyle,
  resolveStatusVariant,
} from './badgeStyles';

type StatusBadgeProps = {
  status: string;
  label?: string;
  dot?: boolean;
  /** Army Camo wash + Liquorice type — board chips, not cool-grey defaults. */
  ink?: 'semantic' | 'board';
};

function normalizeStatusKey(status: string): string {
  return status.trim().toUpperCase().replace(/\s+/g, '_');
}

export function StatusBadge({
  status,
  label,
  dot = false,
  ink = 'semantic',
}: StatusBadgeProps) {
  const { theme, colors } = useTheme();
  const { locale, isRTL } = useLocale();
  const key = normalizeStatusKey(status);
  const variant = resolveStatusVariant(key);
  const display = label ?? statusLabel(locale, key);
  const board = ink === 'board';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={display}
      style={[
        getBadgeContainerStyle(theme, variant),
        { alignSelf: alignStart(isRTL), flexDirection: localeRow(isRTL) },
        board
          ? {
              backgroundColor: colors.brandSoft,
              borderColor: colors.brand,
            }
          : null,
      ]}
    >
      {dot ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: board ? colors.brandActive : getBadgeDotColor(theme, variant),
          }}
        />
      ) : null}
      <Text
        maxFontSizeMultiplier={isRTL ? 1.15 : 1.35}
        style={[
          getBadgeLabelStyle(theme, variant),
          resolveAppFontStyle(locale, {
            weight: 'medium',
            variant: 'caption',
            systemWeight: theme.typography.weights.medium,
          }),
          {
            textAlign: textAlignFor(isRTL ? 'rtl' : 'ltr'),
            writingDirection: writingDirectionFor(isRTL),
            ...(board ? { color: colors.textPrimary } : null),
          },
        ]}
      >
        {display}
      </Text>
    </View>
  );
}
