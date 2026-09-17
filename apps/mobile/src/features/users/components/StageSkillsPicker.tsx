import { View } from 'react-native';
import { localizedName } from '@maher/i18n';
import type { StageDefinition } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  stages: StageDefinition[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
};

/**
 * Worker stage skills — OrdersFilterSheet chips, start rail when selected.
 */
export function StageSkillsPicker({ stages, selectedIds, onChange, loading }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const align = { textAlign: isRTL ? 'right' : 'left' } as const;

  if (loading) {
    return (
      <AppText variant="caption" color="muted" style={align}>
        {t('mobile.production.loadingMore')}
      </AppText>
    );
  }

  if (!stages.length) {
    return (
      <AppText variant="caption" color="muted" style={align}>
        {t('users.noStagesYet')}
      </AppText>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          borderRadius: theme.radius.lg,
          backgroundColor: colors.surfaceSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
        }}
      >
        <AppText variant="caption" color="muted" style={align}>
          {t('users.stageSkillsHint')}
        </AppText>
      </View>
      {stages.map((stage) => {
        const checked = selectedIds.includes(stage.id);
        const label = localizedName(locale, stage, stage.code);
        return (
          <AnimatedPressable
            key={stage.id}
            variant="button"
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={label}
            onPress={() => {
              void haptics.selection();
              onChange(
                checked
                  ? selectedIds.filter((id) => id !== stage.id)
                  : [...selectedIds, stage.id],
              );
            }}
            style={{
              minHeight: 40,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: checked ? colors.brandSoft : colors.surfaceSecondary,
              borderWidth: 1.5,
              borderColor: checked ? colors.brand : colors.border,
              overflow: 'hidden',
              alignItems: isRTL ? 'flex-end' : 'flex-start',
              justifyContent: 'center',
            }}
          >
            {checked ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: colors.brand,
                  opacity: 0.55,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                }}
              />
            ) : null}
            <AppText
              variant="label"
              weight={checked ? titleWeight : 'medium'}
              numberOfLines={1}
              style={{
                color: checked ? colors.brand : colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
                paddingLeft: checked && !isRTL ? 4 : 0,
                paddingRight: checked && isRTL ? 4 : 0,
              }}
            >
              {label}
            </AppText>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
