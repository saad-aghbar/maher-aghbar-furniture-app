import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import {
  getBadgeContainerStyle,
  getBadgeDotColor,
  getBadgeLabelStyle,
  resolvePriorityVariant,
  type PriorityLevel,
} from './badgeStyles';
import { displayStatusLabel, looksLikeStatusEnum } from './statusDisplay';

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
  const { locale, isRTL, t } = useLocale();
  const variant = resolvePriorityVariant(priority);
  const key = `mobile.production.priority.${priorityMessageKey(priority)}`;
  const translated = t(key);
  const display =
    label && !looksLikeStatusEnum(label)
      ? label
      : translated !== key
        ? translated
        : displayStatusLabel(locale, priorityMessageKey(priority));

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={display}
      style={getBadgeContainerStyle(theme, variant, { isRTL })}
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
      <AppText
        variant="caption"
        weight="medium"
        numberOfLines={2}
        maxFontSizeMultiplier={isRTL ? 1.2 : 1.35}
        style={[
          getBadgeLabelStyle(theme, variant),
          {
            flexShrink: 1,
            minWidth: 0,
          },
        ]}
      >
        {display}
      </AppText>
    </View>
  );
}
