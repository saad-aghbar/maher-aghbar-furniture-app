import { Text, View } from 'react-native';
import { useLocale } from '@/i18n';
import { presentStatus } from '@/lib/presentStatus';
import { resolveAppFontStyle, useTheme } from '@/theme';
import {
  brandedPillChrome,
  getBadgeContainerStyle,
  getBadgeDotColor,
  getBadgeLabelStyle,
  resolveStatusVariant,
  type BadgeVariant,
} from './badgeStyles';
import { displayStatusLabel, looksLikeStatusEnum, normalizeStatusKey } from './statusDisplay';

type StatusBadgeProps = {
  status: string;
  label?: string;
  dot?: boolean;
  /** Army Camo wash + Liquorice type — board chips, not cool-grey defaults. */
  ink?: 'semantic' | 'board';
  /** Cream fill + Army Camo border + Liquorice ink — readable on parchment. */
  branded?: boolean;
  /** Override status-map fill (Staff Types Active / task-floor Ready → wood, not mint). */
  variant?: BadgeVariant;
};

function normalizeStatusKey(status: string): string {
  return status.trim().toUpperCase().replace(/\s+/g, '_');
}

export function StatusBadge({ status, label, dot = false }: StatusBadgeProps) {
  const { theme } = useTheme();
  const { t, locale, isRTL } = useLocale();
  const key = normalizeStatusKey(status);
  const variant = resolveStatusVariant(key);
  const display = label ?? presentStatus(status, t);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={display}
      style={[
        getBadgeContainerStyle(theme, variant, { isRTL, branded: board }),
        { alignSelf: alignStart(isRTL), flexDirection: localeRow(isRTL) },
        chrome
          ? {
              backgroundColor: chrome.backgroundColor,
              borderColor: chrome.borderColor,
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
          getBadgeLabelStyle(theme, variant, board),
          {
            textAlign: textAlignFor(isRTL ? 'rtl' : 'ltr'),
            writingDirection: writingDirectionFor(isRTL),
            flexShrink: 1,
            minWidth: 0,
            ...(chrome ? { color: chrome.color } : null),
          },
        ]}
      >
        {display}
      </AppText>
    </View>
  );
}
