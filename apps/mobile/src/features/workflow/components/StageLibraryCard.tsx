import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import type { StageDefinition } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { formatDuration, useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';

const MEDIA = 56;

function stageGlyph(
  row: StageDefinition,
  locked: boolean,
): keyof typeof Ionicons.glyphMap {
  if (row.code === 'MATERIAL_PREP') return 'layers-outline';
  if (row.code === 'INSPECTION') return 'shield-checkmark-outline';
  if (row.code === 'PACKAGING') return 'cube-outline';
  if (row.code === 'DELIVERY') return 'car-outline';
  if (locked) return 'lock-closed';
  if (row.schedulingResourceMode === 'RESOURCE_CONSTRAINED') return 'cube-outline';
  return 'people-outline';
}

type Props = {
  row: StageDefinition;
  locked?: boolean;
  caption?: string;
  index?: number;
  onPress: () => void;
};

/** Floor stage card — rail, header band, icon well, inset marks. */
export function StageLibraryCard({ row, locked = false, caption, index = 0, onPress }: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const name = localizedName(locale, row, row.code);
  const hours =
    row.estimatedHours != null && Number(row.estimatedHours) > 0
      ? formatDuration(locale, Math.round(Number(row.estimatedHours) * 60))
      : null;
  const hasMarks = Boolean(hours || row.requiresPhotos || row.requiresInspection);
  const railColor = locked ? colors.textMuted : colors.brand;
  const railOpacity = locked ? 0.35 : 0.55;
  const badgeLabel = caption ?? (locked ? t('mobile.production.workflow.lockedCaption') : null);

  return (
    <ListItemEnter index={index}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: locked ? colors.border : colors.borderStrong,
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
            width: 3,
            backgroundColor: railColor,
            opacity: railOpacity,
            ...(isRTL ? { right: 0 } : { left: 0 }),
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
          {badgeLabel ? (
            <StatusBadge
              status={caption ? 'ACTIVE' : 'DRAFT'}
              label={badgeLabel}
              branded={Boolean(caption)}
              dot
            />
          ) : (
            <View />
          )}
          <AppText variant="caption" color="brand" weight={titleWeight}>
            {t('common.details')}
          </AppText>
        </View>

        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={name}
          onPress={() => {
            void haptics.selection();
            onPress();
          }}
          style={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
            ...(isRTL
              ? { paddingRight: theme.spacing.lg + 4 }
              : { paddingLeft: theme.spacing.lg + 4 }),
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                width: MEDIA,
                height: MEDIA,
                borderRadius: theme.radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brandSoft,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name={stageGlyph(row, locked)} size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
              <AppText
                variant="label"
                weight={titleWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left', fontSize: 16 }}
              >
                {name}
              </AppText>
            </View>
          </View>

          {hasMarks ? (
            <View
              style={{
                borderRadius: theme.radius.lg,
                backgroundColor: colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              }}
            >
              {hours ? (
                <MetaRow label={t('mobile.production.workflow.typicalHours')} value={hours} />
              ) : null}
              {row.requiresPhotos ? (
                <MetaRow
                  label={t('mobile.production.workflow.requiresPhotos')}
                  value={t('mobile.production.workflow.required')}
                />
              ) : null}
              {row.requiresInspection ? (
                <MetaRow
                  label={t('mobile.production.workflow.requiresInspection')}
                  value={t('mobile.production.workflow.required')}
                />
              ) : null}
            </View>
          ) : null}
        </AnimatedPressable>
      </View>
    </ListItemEnter>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const { isRTL, locale } = useLocale();
  const { colors } = useTheme();

  return (
    <View style={{ gap: 2 }}>
      <AppText
        variant="caption"
        color="muted"
        style={{
          textAlign: isRTL ? 'right' : 'left',
          fontSize: 10,
          letterSpacing: locale === 'ar' ? 0 : 0.4,
          textTransform: locale === 'ar' ? 'none' : 'uppercase',
        }}
      >
        {label}
      </AppText>
      <AppText
        variant="bodySecondary"
        weight="medium"
        style={{ textAlign: isRTL ? 'right' : 'left', color: colors.textPrimary }}
      >
        {value}
      </AppText>
    </View>
  );
}

/** Slim section board — sibling stage cards sit below, not inside. */
export function StageLibrarySection({
  title,
  hint,
  count,
}: {
  title: string;
  hint?: string;
  count?: number;
}) {
  const { locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <DealerBoard
      title={title}
      titleWeight={titleWeight}
      trailing={
        count != null ? (
          <AppText variant="caption" weight={titleWeight} dir="ltr" color="muted">
            {String(count)}
          </AppText>
        ) : undefined
      }
    >
      {hint ? (
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      ) : null}
    </DealerBoard>
  );
}
