import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme, type ThemeColors } from '@/theme';
import {
  adminLifecycleAccentKey,
  type AdminOrderLifecycle,
} from '../adminOrderLifecycle';
import {
  OrdersProgressCard,
  type OrdersProgressCardModel,
} from './OrdersProgressCard';

/** All-overview lanes preview a short list; open the section for the rest. */
const PREVIEW_COUNT = 3;

type Props = {
  lifecycleKey: AdminOrderLifecycle;
  title: string;
  items: OrdersProgressCardModel[];
  /**
   * Server COUNT=DATASET total for this lane. Required on All overview —
   * never use loaded page length for the badge (that showed Preparing 0 / In production 8).
   */
  totalCount?: number;
  /** Overview (All) vs single focused lane. */
  mode: 'preview' | 'focused';
  onPressItem: (id: string, kind?: 'order' | 'rfq') => void;
  onPrimaryCta?: (order: OrdersProgressCardModel) => void;
  onOpenFocused?: () => void;
  hint?: string | null;
};

function trayAccent(life: AdminOrderLifecycle, colors: ThemeColors): string {
  switch (adminLifecycleAccentKey(life)) {
    case 'warning':
      return colors.warning;
    case 'success':
      return colors.success;
    case 'info':
      return colors.info;
    case 'muted':
      return colors.textSecondary;
    case 'brand':
    default:
      return colors.brand;
  }
}

/**
 * Contained lifecycle tray — vertical order list.
 * On All, overflow opens the focused section (does not expand in place).
 */
export function AdminLifecycleTray({
  lifecycleKey,
  title,
  items,
  totalCount,
  mode,
  onPressItem,
  onPrimaryCta,
  onOpenFocused,
  hint,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const count = Math.max(0, totalCount ?? items.length);
  const accent = trayAccent(lifecycleKey, colors);
  const isPreview = mode === 'preview';
  const list = isPreview ? items.slice(0, PREVIEW_COUNT) : items;
  // Remaining beyond the preview strip — prefer server total when All overview
  // only has a mixed page of rows in memory.
  const hiddenCount = isPreview
    ? Math.max(0, count - list.length)
    : 0;

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderMuted,
        overflow: 'hidden',
        ...theme.elevation.card,
      }}
    >
      <View
        style={{
          height: 3,
          backgroundColor: accent,
          opacity: 0.85,
        }}
      />

      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.sm,
          gap: 6,
          backgroundColor: colors.surface,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <AppText
              variant="caption"
              color="muted"
              style={{
                letterSpacing: locale === 'ar' ? 0 : 1,
                textTransform: locale === 'ar' ? 'none' : 'uppercase',
                fontSize: 10,
                lineHeight: 12,
              }}
            >
              {t('mobile.orders.trayEyebrow')}
            </AppText>
            <AppText
              variant="title"
              weight={locale === 'ar' ? 'medium' : 'semibold'}
              numberOfLines={1}
              style={{ fontSize: 18, lineHeight: 22 }}
            >
              {title}
            </AppText>
          </View>

          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <View
              style={{
                minWidth: 40,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 7,
                borderRadius: theme.radius.full,
                backgroundColor: `${accent}18`,
                borderWidth: 1,
                borderColor: `${accent}33`,
                alignItems: 'center',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{ color: accent, fontVariant: ['tabular-nums'] }}
              >
                {count}
              </AppText>
            </View>
            {isPreview && onOpenFocused ? (
              <AnimatedPressable
                variant="card"
                accessibilityRole="button"
                accessibilityLabel={t('mobile.orders.trayOpenAll')}
                onPress={() => {
                  void haptics.selection();
                  onOpenFocused();
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={18}
                  color={colors.brand}
                />
              </AnimatedPressable>
            ) : null}
          </View>
        </View>
        {hint ? (
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {hint}
          </AppText>
        ) : isPreview && count > PREVIEW_COUNT ? (
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {t('mobile.orders.trayPreviewHint')}
          </AppText>
        ) : null}
      </View>

      <View
        style={{
          marginHorizontal: theme.spacing.sm,
          marginBottom: theme.spacing.sm,
          borderRadius: theme.radius.lg,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.borderMuted,
          overflow: 'hidden',
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.sm,
        }}
      >
        {list.map((item, index) => (
          <OrdersProgressCard
            key={`${lifecycleKey}-${item.id}-${index}`}
            order={item}
            variant="admin"
            layout="stack"
            onPress={() => onPressItem(item.id, item.kind)}
            onPrimaryCta={onPrimaryCta ? () => onPrimaryCta(item) : undefined}
          />
        ))}

        {isPreview && list.length === 0 && count > 0 && onOpenFocused ? (
          <OpenSectionRow
            isRTL={isRTL}
            label={t('mobile.orders.traySeeAll', { count })}
            onPress={() => {
              void haptics.selection();
              onOpenFocused();
            }}
          />
        ) : null}

        {isPreview && hiddenCount > 0 && list.length > 0 && onOpenFocused ? (
          <OpenSectionRow
            isRTL={isRTL}
            label={t('mobile.orders.traySeeAll', { count: hiddenCount })}
            onPress={() => {
              void haptics.selection();
              onOpenFocused();
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

function OpenSectionRow({
  isRTL,
  label,
  onPress,
}: {
  isRTL: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 52,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: theme.spacing.md,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
      }}
    >
      <AppText variant="label" weight="semibold" color="brand">
        {label}
      </AppText>
      <Ionicons
        name={isRTL ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={colors.brand}
      />
    </AnimatedPressable>
  );
}
