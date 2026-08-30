import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { flexDirectionFor, textAlignFor } from '@/i18n/rtl';
import { useTheme } from '@/theme';

type ListRowProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  /** Force LTR for codes / invoice numbers while keeping RTL alignment. */
  titleDir?: 'auto' | 'ltr';
  trailing?: ReactNode;
  /** Trailing chevron — flips with in-app locale (`writingDirection` / row). */
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shared list-row / card chrome: start-aligned copy, optional trailing,
 * and a direction-aware chevron. Search hits and other list cards reuse this
 * so Arabic/Hebrew flip alignment without per-screen left/right hardcoding.
 */
export function ListRow({
  eyebrow,
  title,
  subtitle,
  titleDir = 'auto',
  trailing,
  chevron = false,
  style,
}: ListRowProps) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const direction = isRTL ? 'rtl' : 'ltr';
  const row = flexDirectionFor(direction);
  const align = textAlignFor(direction);

  return (
    <View
      style={[
        {
          flexDirection: row,
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: theme.sizes.touch.min,
        },
        style,
      ]}
    >
      <View
        style={{
          flex: 1,
          minWidth: 0,
          gap: 2,
          alignItems: isRTL ? 'flex-end' : 'flex-start',
        }}
      >
        {eyebrow ? (
          <AppText variant="caption" color="muted" numberOfLines={1} style={{ alignSelf: 'stretch' }}>
            {eyebrow}
          </AppText>
        ) : null}
        <AppText
          weight="semibold"
          numberOfLines={2}
          dir={titleDir}
          style={{ alignSelf: 'stretch', textAlign: align }}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={3}
            style={{ alignSelf: 'stretch' }}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? <View style={{ flexShrink: 0, maxWidth: '46%' }}>{trailing}</View> : null}
      {chevron ? (
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
    </View>
  );
}
