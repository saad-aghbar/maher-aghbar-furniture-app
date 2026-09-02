import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { productionInsetStyle } from '../productionFloorStyle';

export type ManageExceptionAction = 'change_worker' | 'change_datetime' | 'reschedule_future';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Future-only actions when task has not started. */
  allowRescheduleFuture?: boolean;
  onSelect: (action: ManageExceptionAction) => void;
};

/**
 * Explicit Admin exception path for active production.
 * Does not auto-replan or move downstream work.
 */
export function ProductionManageSheet({
  open,
  onClose,
  allowRescheduleFuture = true,
  onSelect,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [confirmAction, setConfirmAction] = useState<ManageExceptionAction | null>(null);

  const rows: Array<{
    action: ManageExceptionAction;
    title: string;
    body: string;
    hidden?: boolean;
  }> = [
    {
      action: 'change_worker',
      title: t('mobile.production.manage.changeWorker'),
      body: t('mobile.production.manage.changeWorkerHint'),
    },
    {
      action: 'change_datetime',
      title: t('mobile.production.manage.changeDateTime'),
      body: t('mobile.production.manage.changeDateTimeHint'),
    },
    {
      action: 'reschedule_future',
      title: t('mobile.production.manage.rescheduleFuture'),
      body: t('mobile.production.manage.rescheduleFutureHint'),
      hidden: !allowRescheduleFuture,
    },
  ];

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setConfirmAction(null);
        onClose();
      }}
      title={t('mobile.production.manage.title')}
    >
      <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        <AppText variant="caption" color="muted">
          {t('mobile.production.manage.subtitle')}
        </AppText>

        {confirmAction ? (
          <DealerBoard title={t('mobile.production.manage.confirmTitle')} titleWeight={titleWeight}>
            <View style={{ gap: theme.spacing.md }}>
              <AppText variant="body">{t('mobile.production.manage.confirmBody')}</AppText>
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                }}
              >
                <ActionChip
                  label={t('mobile.production.cancel')}
                  onPress={() => setConfirmAction(null)}
                />
                <ActionChip
                  label={t('mobile.production.manage.confirmContinue')}
                  primary
                  onPress={() => {
                    void haptics.confirmMedium();
                    const action = confirmAction;
                    setConfirmAction(null);
                    onSelect(action);
                  }}
                />
              </View>
            </View>
          </DealerBoard>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {rows
              .filter((r) => !r.hidden)
              .map((row) => (
                <AnimatedPressable
                  key={row.action}
                  variant="card"
                  onPress={() => {
                    void haptics.selection();
                    setConfirmAction(row.action);
                  }}
                  style={productionInsetStyle(theme, colors)}
                >
                  <AppText variant="label" weight={titleWeight}>
                    {row.title}
                  </AppText>
                  <AppText variant="caption" color="muted" style={{ marginTop: 4 }}>
                    {row.body}
                  </AppText>
                </AnimatedPressable>
              ))}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

function ActionChip({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="button"
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? colors.brand : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: primary ? colors.brand : colors.border,
      }}
    >
      <AppText
        variant="label"
        weight="medium"
        style={{ color: primary ? colors.onBrand : colors.textPrimary }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
