import { Text, View } from 'react-native';
import { useLocale } from '@/i18n';
import { presentStatus } from '@/lib/presentStatus';
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
        getBadgeContainerStyle(theme, variant),
        { alignSelf: isRTL ? 'flex-end' : 'flex-start' },
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
            backgroundColor: getBadgeDotColor(theme, variant),
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
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
            ...(isRTL
              ? { fontSize: 10, lineHeight: 14 }
              : null),
          },
        ]}
      >
        {display}
      </Text>
    </View>
  );
}
