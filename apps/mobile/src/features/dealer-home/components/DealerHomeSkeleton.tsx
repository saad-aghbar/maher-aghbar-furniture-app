import { View } from 'react-native';
import { DealerSkeleton } from '@/features/dealer-ui';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

export function DealerHomeSkeleton() {
  const { t, isRTL } = useLocale();
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel={t('mobile.dealerUi.loading')}
      accessibilityRole="progressbar"
      style={{ gap: theme.spacing.lg }}
    >
      <DealerSkeleton height={22} width="42%" />
      <DealerSkeleton height={260} width="100%" radius={theme.radius.xl} />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.md,
        }}
      >
        <DealerSkeleton height={112} style={{ width: '47%', flexGrow: 1 }} radius={theme.radius.xl} />
        <DealerSkeleton height={112} style={{ width: '47%', flexGrow: 1 }} radius={theme.radius.xl} />
        <DealerSkeleton height={112} style={{ width: '47%', flexGrow: 1 }} radius={theme.radius.xl} />
        <DealerSkeleton height={112} style={{ width: '47%', flexGrow: 1 }} radius={theme.radius.xl} />
      </View>
      <DealerSkeleton height={18} width="45%" />
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.md }}>
        <DealerSkeleton height={208} width={156} radius={theme.radius.xl} />
        <DealerSkeleton height={208} width={156} radius={theme.radius.xl} />
        <DealerSkeleton height={208} width={156} radius={theme.radius.xl} />
      </View>
    </View>
  );
}
