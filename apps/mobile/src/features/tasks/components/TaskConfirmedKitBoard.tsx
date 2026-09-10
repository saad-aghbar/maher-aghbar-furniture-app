import { useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getTaskWipIncoming, type WipIncomingLine } from '@/api/modules/tasks';
import { queryKeys } from '@/api/queryKeys';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';

type Props = { taskId: string; enabled?: boolean };

export function TaskConfirmedKitBoard({ taskId, enabled = true }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const incomingQuery = useQuery({
    queryKey: queryKeys.tasks.wipIncoming(taskId),
    queryFn: () => getTaskWipIncoming(taskId),
    enabled,
  });
  const lines: WipIncomingLine[] = useMemo(
    () =>
      (incomingQuery.data?.lines ?? []).filter(
        (l) => l.statusKey === 'RECEIVED' || l.received > 0,
      ),
    [incomingQuery.data?.lines],
  );
  const required = Boolean(incomingQuery.data?.required);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const line of lines) {
        if (!line.thumbDocumentId) continue;
        try {
          next[line.thumbDocumentId] = await resolveDocumentUrl(line.thumbDocumentId);
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [lines]);

  if (!required && lines.length === 0) {
    return (
      <DealerBoard title={t('mobile.tasks.confirmedKitTitle')} titleWeight={titleWeight}>
        <AppText variant="body" color="muted">
          {t('mobile.tasks.confirmedKitEmpty')}
        </AppText>
      </DealerBoard>
    );
  }

  return (
    <DealerBoard title={t('mobile.tasks.confirmedKitTitle')} titleWeight={titleWeight}>
      {lines.length === 0 ? (
        <AppText variant="body" color="muted">
          {t('mobile.tasks.confirmedKitEmpty')}
        </AppText>
      ) : (
        lines.map((line) => {
          const name =
            locale === 'ar'
              ? line.outputNameAr || line.fromStageNameAr || line.fromStageNameEn
              : locale === 'he'
                ? line.outputNameHe || line.fromStageNameHe || line.fromStageNameEn
                : line.outputNameEn || line.fromStageNameEn;
          const uri = line.thumbDocumentId ? thumbs[line.thumbDocumentId] : null;
          return (
            <View
              key={`${line.kitId ?? line.fromStageCode}-${line.predecessorSnapshotNodeId}`}
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: theme.spacing.sm,
                alignItems: 'center',
              }}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: 48, height: 48, borderRadius: theme.radius.lg }}
                />
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: theme.radius.lg,
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                />
              )}
              <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <AppText variant="body" weight={titleWeight}>
                  {name}
                </AppText>
                <AppText variant="caption" color="secondary" style={{ writingDirection: 'ltr' }}>
                  {line.received} / {line.expected}
                </AppText>
              </View>
            </View>
          );
        })
      )}
    </DealerBoard>
  );
}
