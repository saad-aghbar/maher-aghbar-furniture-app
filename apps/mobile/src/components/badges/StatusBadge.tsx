import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { alignStart, localeRow, textAlignFor, useLocale, writingDirectionFor } from '@/i18n';
import { useTheme } from '@/theme';
import {
  getBadgeContainerStyle,
  getBadgeDotColor,
  getBadgeLabelStyle,
  resolveStatusVariant,
} from './badgeStyles';
import { displayStatusLabel, looksLikeStatusEnum, normalizeStatusKey } from './statusDisplay';

type StatusBadgeProps = {
  status: string;
  label?: string;
  dot?: boolean;
  /** Army Camo wash + Liquorice type — board chips, not cool-grey defaults. */
  ink?: 'semantic' | 'board';
};

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
  const display =
    label && !looksLikeStatusEnum(label) ? label : displayStatusLabel(locale, label ?? status);
  const board = ink === 'board';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={display}
      style={[
        getBadgeContainerStyle(theme, variant, { isRTL }),
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
      <AppText
        variant="caption"
        weight="medium"
        numberOfLines={2}
        maxFontSizeMultiplier={isRTL ? 1.2 : 1.35}
        style={[
          getBadgeLabelStyle(theme, variant),
          {
            textAlign: textAlignFor(isRTL ? 'rtl' : 'ltr'),
            writingDirection: writingDirectionFor(isRTL),
            flexShrink: 1,
            minWidth: 0,
            ...(board ? { color: colors.textPrimary } : null),
          },
        ]}
      >
        {display}
      </AppText>
    </View>
  );
}
