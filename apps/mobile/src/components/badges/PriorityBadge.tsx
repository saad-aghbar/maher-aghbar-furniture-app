import { Text, View } from 'react-native';
import { useLocale } from '@/i18n';
import { resolveAppFontStyle, useTheme } from '@/theme';
import {
  getBadgeContainerStyle,
  getBadgeDotColor,
  getBadgeLabelStyle,
  resolvePriorityVariant,
  type PriorityLevel,
} from './badgeStyles';

type PriorityBadgeProps = {
  priority: PriorityLevel;
  label?: string;
  dot?: boolean;
};

function priorityMessageKey(priority: PriorityLevel): string {
  if (priority === 'medium') return 'NORMAL';
  return priority.toUpperCase();
}

/**
 * Localized priority chip — labels follow the active locale.
 */
export function PriorityBadge({ priority, label, dot = true }: PriorityBadgeProps) {
  const { theme } = useTheme();
  const { locale, t } = useLocale();
  const variant = resolvePriorityVariant(priority);
  const key = `mobile.production.priority.${priorityMessageKey(priority)}`;
  const translated = t(key);
  const display =
    label ??
    (translated !== key
      ? translated
      : ({
          low: 'Low',
          medium: 'Medium',
          high: 'High',
          urgent: 'Urgent',
        }[priority]));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={display}
      style={getBadgeContainerStyle(theme, variant)}
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
        style={[
          getBadgeLabelStyle(theme, variant),
          resolveAppFontStyle(locale, {
            weight: 'medium',
            variant: 'caption',
            systemWeight: theme.typography.weights.medium,
          }),
        ]}
      >
        {display}
      </Text>
    </View>
  );
}
