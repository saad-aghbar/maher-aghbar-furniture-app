import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { ExpectedPackage } from '../api';

type Props = {
  packages: ExpectedPackage[];
  checked: Record<string, boolean>;
  onToggle: (code: string, next: boolean) => void;
  onReportProblem: () => void;
  /** When all packages confirmed — primary complete action (also mirrored in dock). */
  onComplete?: () => void;
  completeBusy?: boolean;
  disabled?: boolean;
};

/**
 * Packaging confirm — PASSED band, expected packages N of N, Report problem.
 * Complete stays in dock; enable only when all checked.
 */
export function PackagingConfirmPanel({
  packages,
  checked,
  onToggle,
  onReportProblem,
  onComplete,
  completeBusy,
  disabled,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const total = packages.length;
  const done = packages.filter((p) => checked[p.code]).length;
  const allDone = total > 0 && done === total;

  const labelFor = (p: ExpectedPackage) =>
    locale.startsWith('ar') && p.labelAr ? p.labelAr : p.labelEn;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.success,
          backgroundColor: colors.successSoft,
          padding: theme.spacing.md,
          ...orderBoardShadow(colorScheme),
        }}
      >
        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: colors.success,
            letterSpacing: locale === 'ar' ? 0 : 1,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.quality.inspectionPassed')}
        </AppText>
        <AppText
          variant="label"
          weight={titleWeight}
          style={{
            color: colors.success,
            marginTop: 4,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.quality.readyForPackaging')}
        </AppText>
      </View>

      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <AppText
            variant="caption"
            weight="semibold"
            style={{
              color: colors.brand,
              letterSpacing: locale === 'ar' ? 0 : 0.6,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              fontSize: 11,
              flex: 1,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.quality.confirmPackages')}
          </AppText>
          <AppText variant="caption" weight="semibold" style={{ color: colors.brand }}>
            {t('mobile.quality.packagesProgress', { done, total })}
          </AppText>
        </View>
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          {packages.length === 0 ? (
            <AppText variant="body" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
              {t('mobile.quality.noExpectedPackages')}
            </AppText>
          ) : (
            packages.map((p) => {
              const on = Boolean(checked[p.code]);
              return (
                <Pressable
                  key={p.code}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  disabled={disabled}
                  onPress={() => {
                    void haptics.selection();
                    onToggle(p.code, !on);
                  }}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.sm,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: on ? colors.success : colors.border,
                    backgroundColor: on ? colors.successSoft : colors.surfaceSecondary,
                    minHeight: theme.sizes.touch.min,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: on ? colors.success : colors.borderStrong,
                      backgroundColor: on ? colors.success : colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {on ? (
                      <AppText
                        variant="caption"
                        weight="semibold"
                        style={{ color: colors.onBrand, fontSize: 12 }}
                      >
                        ✓
                      </AppText>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText
                      variant="label"
                      weight={on ? 'semibold' : 'medium'}
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {labelFor(p)}
                    </AppText>
                    {!on ? (
                      <AppText
                        variant="caption"
                        color="muted"
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                      >
                        {t('mobile.quality.missingPackage')}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
          {!allDone && total > 0 ? (
            <AppText
              variant="caption"
              color="warning"
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {t('mobile.quality.confirmAllPackagesHint')}
            </AppText>
          ) : null}
          {allDone && total > 0 ? (
            <AppText
              variant="caption"
              style={{ textAlign: isRTL ? 'right' : 'left', color: colors.success }}
            >
              {t('mobile.quality.completePackagingHint')}
            </AppText>
          ) : null}
        </View>
      </View>

      {allDone && onComplete ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled || completeBusy}
          onPress={() => {
            void haptics.confirmMedium();
            onComplete();
          }}
          style={{
            minHeight: theme.sizes.touch.min + 8,
            borderRadius: theme.radius.xl,
            backgroundColor: colors.success,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled || completeBusy ? 0.55 : 1,
            ...orderBoardShadow(colorScheme),
          }}
        >
          <AppText variant="label" weight="semibold" style={{ color: colors.onBrand, fontSize: 16 }}>
            {t('mobile.quality.completePackaging')}
          </AppText>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          void haptics.selection();
          onReportProblem();
        }}
        style={{
          minHeight: theme.sizes.touch.min,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.error,
          backgroundColor: colors.errorSoft,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <AppText variant="label" weight="semibold" style={{ color: colors.error }}>
          {t('mobile.quality.reportProblem')}
        </AppText>
      </Pressable>
    </View>
  );
}

export function allPackagesConfirmed(
  packages: ExpectedPackage[],
  checked: Record<string, boolean>,
): boolean {
  if (packages.length === 0) return true;
  return packages.every((p) => checked[p.code]);
}

export function confirmedPackageLabels(
  packages: ExpectedPackage[],
  checked: Record<string, boolean>,
): string[] {
  return packages.filter((p) => checked[p.code]).map((p) => p.labelEn);
}
