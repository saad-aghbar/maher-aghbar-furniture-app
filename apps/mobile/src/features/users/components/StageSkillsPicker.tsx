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

export function StageSkillsPicker({ stages, selectedIds, onChange, loading }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { theme, colors } = useTheme();

  if (loading) {
    return <AppText color="muted">{t('mobile.production.loadingMore')}</AppText>;
  }

  if (!stages.length) {
    return <AppText color="muted">{t('users.noStagesYet')}</AppText>;
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" color="muted">
        {t('users.stageSkillsHint')}
      </AppText>
      {stages.map((stage) => {
        const checked = selectedIds.includes(stage.id);
        return (
          <AnimatedPressable
            key={stage.id}
            variant="button"
            onPress={() => {
              void haptics.selection();
              onChange(
                checked
                  ? selectedIds.filter((id) => id !== stage.id)
                  : [...selectedIds, stage.id],
              );
            }}
            style={{
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: checked ? colors.brand : colors.border,
              backgroundColor: checked ? colors.brandSoft : colors.surface,
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }}
          >
            <AppText variant="body" weight={checked ? 'semibold' : 'regular'}>
              {checked ? '✓ ' : ''}
              {localizedName(locale, stage, stage.code)}
            </AppText>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
