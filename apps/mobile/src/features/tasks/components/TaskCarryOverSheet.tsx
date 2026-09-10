import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { apiGet, apiPost } from '@/api/client';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type PreviewMove = {
  taskId: string;
  taskName: string;
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
  reason: string;
};

type Preview = {
  mode: 'tomorrow' | 'overtime';
  remainingMinutes: number;
  moves: PreviewMove[];
};

type Props = {
  open: boolean;
  taskId: string;
  remainingMinutes: number;
  allowOvertime?: boolean;
  onClose: () => void;
  onCommitted: () => void;
};

export function TaskCarryOverSheet({
  open,
  taskId,
  remainingMinutes,
  allowOvertime = true,
  onClose,
  onCommitted,
}: Props) {
  const { t, formatDateTime, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [mode, setMode] = useState<'tomorrow' | 'overtime'>('tomorrow');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void apiGet<Preview>(
      `/tasks/${encodeURIComponent(taskId)}/carry-over/preview?mode=${mode}&remainingMinutes=${remainingMinutes}`,
    )
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [open, taskId, mode, remainingMinutes]);

  const remainder = preview?.moves.find((m) => m.reason === 'remainder');
  const others = (preview?.moves ?? []).filter((m) => m.reason !== 'remainder');

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.tasks.carryOverTitle')}
      overlay
      expandable
    >
      <View style={{ gap: theme.spacing.md }}>
        {(['tomorrow', 'overtime'] as const)
          .filter((opt) => opt === 'tomorrow' || allowOvertime)
          .map((opt) => {
          const active = mode === opt;
          return (
            <AnimatedPressable
              key={opt}
              variant="button"
              onPress={() => {
                void haptics.selection();
                setMode(opt);
              }}
              style={{
                minHeight: 40,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: active ? colors.brand : colors.border,
                backgroundColor: active ? colors.brandSoft : colors.surface,
                padding: theme.spacing.sm,
                overflow: 'hidden',
              }}
            >
              {active ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: 3,
                    backgroundColor: colors.brand,
                    ...(isRTL ? { right: 0 } : { left: 0 }),
                  }}
                />
              ) : null}
              <AppText variant="body" weight={titleWeight}>
                {opt === 'tomorrow'
                  ? t('mobile.tasks.carryOverTomorrow')
                  : t('mobile.tasks.carryOverOvertime')}
              </AppText>
            </AnimatedPressable>
          );
        })}

        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        {remainder ? (
          <AppText variant="caption" color="secondary" style={{ writingDirection: 'ltr' }}>
            {formatDateTime(remainder.newStart)} → {formatDateTime(remainder.newEnd)}
          </AppText>
        ) : null}
        {others.length > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="caption" color="muted">
              {t('mobile.tasks.carryOverMoves')}
            </AppText>
            {others.map((move) => (
              <AppText key={move.taskId} variant="caption" color="secondary">
                {move.taskName}
              </AppText>
            ))}
          </View>
        ) : null}

        <PrimaryButton
          label={t('mobile.tasks.carryOverConfirm')}
          loading={saving}
          onPress={() => {
            setSaving(true);
            void apiPost(`/tasks/${encodeURIComponent(taskId)}/carry-over`, {
              mode,
              remainingMinutes,
            })
              .then(() => {
                void haptics.confirmMedium();
                onCommitted();
                onClose();
              })
              .catch(() => void haptics.error())
              .finally(() => setSaving(false));
          }}
        />
        <SecondaryButton label={t('mobile.tasks.back')} onPress={onClose} />
      </View>
    </BottomSheet>
  );
}
