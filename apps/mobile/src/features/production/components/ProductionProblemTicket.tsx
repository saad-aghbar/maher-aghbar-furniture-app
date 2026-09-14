import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName, localizeFloorNote } from '@maher/i18n';
import type { ProductionProblemRow } from '@/api/modules/production';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { Divider } from '@/components/layout/Divider';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { VoicePlaybackButton } from '@/features/tasks/components/VoiceNoteControls';
import { ProblemPhotoGallery } from '@/features/tasks/components/ProblemPhotoGallery';
import { formatDuration, useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { productionInsetStyle } from '../productionFloorStyle';

type Props = {
  row: ProductionProblemRow;
  onOpenOrder?: () => void;
  onAnswer?: () => void;
};

const HOT: ReadonlySet<string> = new Set([
  'MATERIAL_MISSING',
  'MATERIAL_DEFECT',
  'SAFETY',
]);

export function problemCategoryLabel(category: string, t: (key: string) => string): string {
  const key = `mobile.tasks.blocker.${category}`;
  const label = t(key);
  return label === key ? category.replace(/_/g, ' ') : label;
}

/**
 * Factory-inbox ticket — order-card recipe with inset ledger + answer dock.
 */
export function ProductionProblemTicket({ row, onOpenOrder, onAnswer }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const answered = Boolean(row.resolution);
  const hot = HOT.has(row.category);
  const accent = hot ? colors.error : answered ? colors.brand : colors.warning;
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const number = row.order?.number ?? row.task.name;
  const category = problemCategoryLabel(row.category, t);
  const stage = row.stage ? localizedName(locale, row.stage, row.stage.code) : null;
  const worker = row.worker?.name?.trim() || null;
  const waited = formatDuration(locale, row.elapsedMinutes);

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: hot ? colors.error : colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          ...(isRTL ? { right: 0 } : { left: 0 }),
          width: 3,
          backgroundColor: accent,
          opacity: hot || !answered ? 0.9 : 0.55,
        }}
      />

      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        <StatusBadge
          status={answered ? 'RESOLVED' : 'OPEN'}
          label={
            answered
              ? t('mobile.tasks.problemsStatusAnswered')
              : t('mobile.tasks.problemsStatusOpen')
          }
          variant={answered ? 'success' : 'error'}
          dot
        />
        {onOpenOrder ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('common.details')}
            onPress={() => {
              void haptics.selection();
              onOpenOrder();
            }}
          >
            <AppText variant="caption" color="brand" weight={titleWeight}>
              {t('common.details')}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </View>

      <View
        style={{
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
        }}
      >
        <View style={{ gap: 4 }}>
          <AppText
            variant="label"
            weight={titleWeight}
            dir="ltr"
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 17 }}
          >
            {number}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={2}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {row.task.name}
          </AppText>
        </View>

        <View
          style={{
            borderRadius: theme.radius.lg,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: hot ? colors.error : colors.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
              gap: 4,
            }}
          >
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{
                color: hot ? colors.error : colors.brand,
                letterSpacing: locale === 'ar' ? 0 : 0.45,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                fontSize: 10,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {category}
            </AppText>
            <AppText
              variant="body"
              style={{
                color: hot ? colors.error : colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {localizeFloorNote(t, locale, row.reason)}
            </AppText>
          </View>
          {stage ? (
            <>
              <Divider compact plain style={{ marginVertical: 0 }} />
              <MetaRow label={t('mobile.tasks.contextStage')} value={stage} isRTL={isRTL} />
            </>
          ) : null}
          <Divider compact plain style={{ marginVertical: 0 }} />
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm + 2,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="person-outline" size={14} color={colors.brand} />
            </View>
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={1}
              style={{
                flex: 1,
                textAlign: isRTL ? 'right' : 'left',
                color: colors.textPrimary,
              }}
            >
              {worker ?? '—'}
            </AppText>
            <AppText variant="caption" color="muted" dir="ltr" style={{ fontSize: 11 }}>
              {waited}
            </AppText>
          </View>
        </View>

        <VoicePlaybackButton documentId={row.voiceDocumentId} />
        <ProblemPhotoGallery
          documentIds={row.photoDocumentIds}
          title={t('mobile.tasks.workerProblemPhotos')}
        />

        {answered ? (
          <View style={productionInsetStyle(theme, colors)}>
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{
                color: colors.brand,
                letterSpacing: locale === 'ar' ? 0 : 0.45,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                fontSize: 10,
              }}
            >
              {t('mobile.tasks.answerFromSupervisor')}
            </AppText>
            {row.resolution ? (
              <AppText variant="body">{row.resolution}</AppText>
            ) : null}
            <VoicePlaybackButton documentId={row.resolutionVoiceDocumentId} />
            <ProblemPhotoGallery
              documentIds={row.resolutionPhotoDocumentIds}
              title={t('mobile.tasks.answerPhotos')}
            />
          </View>
        ) : onAnswer ? (
          <PrimaryButton
            label={t('mobile.tasks.answerProblem')}
            haptic="selection"
            onPress={() => {
              onAnswer();
            }}
            style={{
              borderRadius: theme.radius.full,
              minHeight: theme.sizes.touch.min,
              paddingVertical: 0,
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function MetaRow({
  label,
  value,
  isRTL,
}: {
  label: string;
  value: string;
  isRTL: boolean;
}) {
  const { colors, theme } = useTheme();
  const { locale } = useLocale();

  return (
    <View
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm + 2,
      }}
    >
      <AppText
        variant="caption"
        color="muted"
        style={{
          textTransform: locale === 'en' ? 'uppercase' : 'none',
          letterSpacing: locale === 'en' ? 0.5 : 0,
          fontSize: 10,
          flexShrink: 0,
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="caption"
        weight="medium"
        style={{
          flex: 1,
          textAlign: isRTL ? 'left' : 'right',
          color: colors.textPrimary,
        }}
        numberOfLines={2}
      >
        {value}
      </AppText>
    </View>
  );
}
