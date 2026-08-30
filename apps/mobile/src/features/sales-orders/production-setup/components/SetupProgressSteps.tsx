import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Step = { key: string; done: boolean };

type Props = {
  steps: Step[];
  percent: number;
};

const STEP_KEYS = ['setup', 'lines', 'ready', 'released'] as const;

export function SetupProgressSteps({ steps, percent }: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();

  const byKey = new Map(steps.map((s) => [s.key, s.done]));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="caption" color="muted">
          {t('mobile.productionSetup.progressEyebrow')}
        </AppText>
        <AppText variant="caption" weight="semibold" dir="ltr">
          {Math.max(0, Math.min(100, Math.round(percent)))}%
        </AppText>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.surfaceSecondary,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, percent))}%`,
            backgroundColor: colors.brand,
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
        }}
      >
        {STEP_KEYS.map((key) => {
          const done = byKey.get(key) ?? false;
          return (
            <View
              key={key}
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 4,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: done ? colors.brand : colors.border,
                backgroundColor: done ? colors.brandSoft : colors.surfaceSecondary,
              }}
            >
              <AppText
                variant="caption"
                weight={done ? 'semibold' : 'regular'}
                style={{ color: done ? colors.brand : colors.textMuted }}
              >
                {t(`mobile.productionSetup.steps.${key}`)}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
