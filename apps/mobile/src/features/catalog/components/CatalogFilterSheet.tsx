import { type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';

export type CatalogSortBy = 'name' | 'price';
export type CatalogSortDir = 'asc' | 'desc';

export type CatalogFilterDraft = {
  sortBy: CatalogSortBy;
  sortDir: CatalogSortDir;
};

export const defaultCatalogFilterDraft: CatalogFilterDraft = {
  sortBy: 'name',
  sortDir: 'asc',
};

export function countActiveCatalogFilters(draft: CatalogFilterDraft): number {
  let n = 0;
  if (draft.sortBy !== 'name') n += 1;
  if (draft.sortDir !== 'asc') n += 1;
  return n;
}

type CatalogFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  draft: CatalogFilterDraft;
  onChange: (draft: CatalogFilterDraft) => void;
  onApply: () => void;
  onReset: () => void;
};

const SORT_OPTIONS: CatalogSortBy[] = ['name', 'price'];

/**
 * Catalog sort sheet — Orders/Production floor aesthetic.
 */
export function CatalogFilterSheet({
  open,
  onClose,
  draft,
  onChange,
  onApply,
  onReset,
}: CatalogFilterSheetProps) {
  const { t, isRTL } = useLocale();
  const { theme, colors, colorScheme } = useTheme();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.55), 420);
  const activeCount = countActiveCatalogFilters(draft);

  const chipRow = {
    flexDirection: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.catalog.filterTitle')}
      fitContent
      maxHeight={sheetHeight}
    >
      <View style={{ gap: theme.spacing.md }}>
        <FilterSection
          index={0}
          reduce={reduce}
          icon="swap-vertical-outline"
          title={t('mobile.catalog.sortBy')}
          accent={draft.sortBy !== 'name' ? colors.brand : undefined}
        >
          <View style={chipRow}>
            {SORT_OPTIONS.map((opt) => (
              <FloorChip
                key={opt}
                label={t(`mobile.catalog.sort.${opt}`)}
                active={draft.sortBy === opt}
                onPress={() => {
                  void haptics.selection();
                  onChange({ ...draft, sortBy: opt });
                }}
              />
            ))}
          </View>
        </FilterSection>

        <FilterSection
          index={1}
          reduce={reduce}
          icon="arrow-down-outline"
          title={t('mobile.catalog.sortDirection')}
          accent={draft.sortDir !== 'asc' ? colors.brand : undefined}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            <FloorChip
              label={t('mobile.catalog.sortAsc')}
              active={draft.sortDir === 'asc'}
              stretch
              onPress={() => {
                void haptics.selection();
                onChange({ ...draft, sortDir: 'asc' });
              }}
            />
            <FloorChip
              label={t('mobile.catalog.sortDesc')}
              active={draft.sortDir === 'desc'}
              stretch
              onPress={() => {
                void haptics.selection();
                onChange({ ...draft, sortDir: 'desc' });
              }}
            />
          </View>
        </FilterSection>

        <View
          style={{
            paddingTop: theme.spacing.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
            paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
          }}
        >
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.catalog.reset')}
            onPress={() => {
              void haptics.selection();
              onReset();
            }}
            style={{
              flex: 1,
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.md,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: colors.borderStrong,
            }}
          >
            <AppText variant="label" weight="medium" style={{ color: colors.textSecondary }}>
              {t('mobile.catalog.reset')}
            </AppText>
          </AnimatedPressable>

          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.catalog.apply')}
            onPress={() => {
              void haptics.confirmLight();
              onApply();
            }}
            style={{
              flex: 1.35,
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              backgroundColor: colors.brand,
              ...(colorScheme === 'dark'
                ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.35,
                    shadowRadius: 10,
                  }
                : {
                    shadowColor: colors.brand,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.28,
                    shadowRadius: 12,
                  }),
            }}
          >
            <AppText variant="label" weight="semibold" style={{ color: colors.onBrand }}>
              {activeCount > 0
                ? t('mobile.catalog.applyWithCount', { n: String(activeCount) })
                : t('mobile.catalog.apply')}
            </AppText>
            <Ionicons name="checkmark" size={18} color={colors.onBrand} />
          </AnimatedPressable>
        </View>
      </View>
    </BottomSheet>
  );
}

function FilterSection({
  title,
  icon,
  children,
  index,
  reduce,
  accent,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  index: number;
  reduce: boolean;
  accent?: string;
}) {
  const { theme, colors } = useTheme();
  const { isRTL } = useLocale();
  const body = (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surfaceSecondary,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
        overflow: 'hidden',
      }}
    >
      {accent ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: accent,
            opacity: 0.85,
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          ...(isRTL
            ? { paddingRight: accent ? 4 : 0 }
            : { paddingLeft: accent ? 4 : 0 }),
        }}
      >
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
          <Ionicons name={icon} size={16} color={accent ?? colors.brand} />
        </View>
        <AppText
          variant="caption"
          style={{
            flex: 1,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            fontSize: 11,
            lineHeight: 14,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </AppText>
      </View>
      <View
        style={{
          ...(isRTL
            ? { paddingRight: accent ? 4 : 0 }
            : { paddingLeft: accent ? 4 : 0 }),
        }}
      >
        {children}
      </View>
    </View>
  );
  if (reduce) return body;
  return (
    <Animated.View entering={FadeInDown.delay(40 + index * 40).duration(220)}>
      {body}
    </Animated.View>
  );
}

function FloorChip({
  label,
  active,
  onPress,
  stretch,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  stretch?: boolean;
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        minWidth: stretch ? undefined : 96,
        flex: stretch ? 1 : undefined,
        maxWidth: stretch ? undefined : 168,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        minHeight: 40,
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.borderStrong,
        overflow: 'hidden',
        alignItems: isRTL ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
      }}
    >
      {active ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.85,
          }}
        />
      ) : null}
      <AppText
        variant="label"
        weight="semibold"
        numberOfLines={1}
        style={{
          color: active ? colors.brand : colors.textPrimary,
          textAlign: isRTL ? 'right' : 'left',
          paddingLeft: active && !isRTL ? 4 : 0,
          paddingRight: active && isRTL ? 4 : 0,
        }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
