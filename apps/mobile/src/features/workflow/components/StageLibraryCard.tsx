import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import type { StageDefinition } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { formatDuration, useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';

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

function Mark({
  icon,
  label,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;
  accessibilityLabel?: string;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: label ? theme.spacing.sm + 2 : 0,
        paddingVertical: label ? 5 : 0,
        borderRadius: theme.radius.full,
        backgroundColor: label ? colors.surface : 'transparent',
        borderWidth: label ? 1 : 0,
        borderColor: colors.border,
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
        <Ionicons name={icon} size={14} color={colors.brand} />
      </View>
      {label ? (
        <AppText variant="caption" weight="medium" color="brand">
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

type Props = {
  row: StageDefinition;
  locked?: boolean;
  caption?: string;
  index?: number;
  onPress: () => void;
};

/** Showroom tile for the stage library — name first, no department codes. */
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

  return (
    <ListItemEnter index={index} staggerMs={28}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={name}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: locked ? colors.brandSoft : colors.border,
          backgroundColor: locked ? colors.brandSoft : colors.surface,
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
            width: 88,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            backgroundColor: locked ? 'transparent' : colors.brandSoft,
            opacity: locked ? 0 : 0.55,
          }}
        />
        <View
          style={{
            paddingVertical: theme.spacing.lg,
            paddingHorizontal: theme.spacing.md,
            gap: theme.spacing.md,
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
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons
                name={stageGlyph(row, locked)}
                size={22}
                color={colors.brand}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              {caption ? (
                <AppText
                  variant="caption"
                  weight="semibold"
                  style={{
                    color: colors.brand,
                    letterSpacing: locale === 'ar' ? 0 : 1.1,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    fontSize: 10,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {caption}
                </AppText>
              ) : null}
              <AppText
                variant="heading"
                weight={titleWeight}
                numberOfLines={2}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {name}
              </AppText>
            </View>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons
                name={
                  locked ? 'lock-closed' : isRTL ? 'chevron-back' : 'chevron-forward'
                }
                size={14}
                color={locked ? colors.brand : colors.textMuted}
              />
            </View>
          </View>

          {hasMarks ? (
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingStart: 52 + theme.spacing.md,
              }}
            >
              {hours ? <Mark icon="time-outline" label={hours} /> : null}
              {row.requiresPhotos ? (
                <Mark
                  icon="camera-outline"
                  accessibilityLabel={t('mobile.production.workflow.requiresPhotos')}
                />
              ) : null}
              {row.requiresInspection ? (
                <Mark
                  icon="shield-checkmark-outline"
                  accessibilityLabel={t('mobile.production.workflow.requiresInspection')}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </AnimatedPressable>
    </ListItemEnter>
  );
}

export function StageLibrarySection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const { locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: 6, paddingHorizontal: 2 }}>
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            color: colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 1.4,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
        {hint ? (
          <AppText
            variant="caption"
            color="muted"
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {hint}
          </AppText>
        ) : null}
        <View
          style={{
            width: 36,
            height: 2,
            borderRadius: 1,
            backgroundColor: colors.brand,
            opacity: 0.35,
            alignSelf: isRTL ? 'flex-end' : 'flex-start',
          }}
        />
      </View>
      <View style={{ gap: theme.spacing.md }}>{children}</View>
    </View>
  );
}
