import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ParallelBandLinkMode } from '@maher/workflow-domain';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  mode: ParallelBandLinkMode | 'mixed';
  disabled?: boolean;
  saving?: boolean;
  onChange: (mode: ParallelBandLinkMode) => void;
};

/**
 * Between two parallel groups: Together (wait for all) vs two independent lanes.
 */
export function ParallelBandLinkControl({ mode, disabled, saving, onChange }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  const Option = ({
    value,
    label,
    icon,
  }: {
    value: ParallelBandLinkMode;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }) => {
    const active = mode === value;
    return (
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled: Boolean(disabled || saving) }}
        disabled={disabled || saving}
        onPress={() => {
          if (active) return;
          void haptics.selection();
          onChange(value);
        }}
        style={{
          flex: 1,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          borderWidth: active ? 1.5 : 1,
          borderColor: active ? colors.brand : colors.borderStrong,
          backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
          opacity: disabled || saving ? 0.55 : 1,
        }}
      >
        <Ionicons name={icon} size={16} color={active ? colors.brand : colors.textSecondary} />
        <AppText
          variant="caption"
          weight={active ? 'semibold' : 'medium'}
          numberOfLines={2}
          style={{
            flexShrink: 1,
            textAlign: 'center',
            color: active ? colors.brand : colors.textSecondary,
            fontSize: 11,
          }}
        >
          {label}
        </AppText>
      </AnimatedPressable>
    );
  };

  return (
    <View style={{ gap: theme.spacing.xs, alignItems: 'stretch' }}>
      <View style={{ alignItems: 'center' }}>
        <Ionicons name="arrow-down" size={14} color={colors.brand} />
      </View>
      <AppText
        variant="caption"
        color="muted"
        style={{ textAlign: 'center', fontSize: 11 }}
      >
        {t('mobile.production.workflow.bandLinkHint')}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
        }}
      >
        <Option
          value="lanes"
          label={t('mobile.production.workflow.bandLinkLanes')}
          icon="git-branch-outline"
        />
        <Option
          value="together"
          label={t('mobile.production.workflow.bandLinkTogether')}
          icon="git-merge-outline"
        />
      </View>
      {mode === 'mixed' ? (
        <AppText
          variant="caption"
          style={{ textAlign: 'center', fontSize: 11, color: colors.warning }}
        >
          {t('mobile.production.workflow.bandLinkMixed')}
        </AppText>
      ) : null}
    </View>
  );
}
