import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { ToastClearance } from '@/components/feedback/Toast';
import { Divider } from '@/components/layout/Divider';
import { SearchActionRow } from '@/components/layout/SearchActionRow';
import { useLocale } from '@/i18n';
import { rowDirection } from '@/i18n/rtl';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { InventorySearchField } from './InventorySearchField';
import {
  InventorySectionTabs,
  type InventoryHomeSection,
} from './InventorySectionTabs';
import {
  InventoryLifecycleTabs,
  type InventoryLifecycle,
} from './InventoryLifecycleTabs';

type Props = {
  title: string;
  subtitle?: string;
  lifecycle: InventoryLifecycle;
  onLifecycleChange: (lifecycle: InventoryLifecycle) => void;
  section: InventoryHomeSection;
  onSectionChange: (section: InventoryHomeSection) => void;
  showSearch?: boolean;
  searchInput?: string;
  setSearchInput?: (v: string) => void;
  searchPlaceholder?: string;
  onSync?: () => void;
  syncing?: boolean;
  canSync?: boolean;
  onRefresh?: () => void;
  createLabel?: string;
  onCreate?: () => void;
  canCreate?: boolean;
  warehouseLabel?: string;
  onCreateWarehouse?: () => void;
  canCreateWarehouse?: boolean;
  children?: ReactNode;
};

/** Floor chrome — stays mounted across section switches (no full-page fade). */
export function InventoryCompositionChrome({
  title,
  subtitle,
  lifecycle,
  onLifecycleChange,
  section,
  onSectionChange,
  showSearch = true,
  searchInput = '',
  setSearchInput,
  searchPlaceholder = '',
  onSync,
  syncing,
  canSync,
  onRefresh,
  createLabel,
  onCreate,
  canCreate,
  warehouseLabel,
  onCreateWarehouse,
  canCreateWarehouse,
  children,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const syncVisible = lifecycle === 'materials' && section === 'items' && canSync && onSync;
  const createVisible = Boolean(canCreate && onCreate && createLabel);
  const warehouseVisible = Boolean(
    canCreateWarehouse && onCreateWarehouse && warehouseLabel,
  );
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
      <ToastClearance />
      <View
        style={{
          flexDirection: rowDirection(isRTL),
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{ color: colors.brand }}
          >
            {t('mobile.inventory.pulseEyebrow')}
          </AppText>
          <AppText variant="title" weight={titleWeight}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="caption"
              weight={locale === 'ar' ? 'regular' : 'medium'}
              style={{ color: colors.brand, textAlign: isRTL ? 'right' : 'left' }}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: rowDirection(isRTL),
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            justifyContent: 'flex-end',
            maxWidth: '46%',
          }}
        >
          {warehouseVisible ? (
            <FloorActionButton
              label={warehouseLabel!}
              accessibilityLabel={warehouseLabel!}
              icon="business-outline"
              tone="soft"
              onPress={() => onCreateWarehouse?.()}
            />
          ) : null}
          {createVisible ? (
            <FloorActionButton
              label={createLabel!}
              accessibilityLabel={createLabel!}
              icon="add"
              tone="solid"
              onPress={() => onCreate?.()}
            />
          ) : null}
        </View>
      </View>

      <InventoryLifecycleTabs active={lifecycle} onChange={onLifecycleChange} />
      <InventorySectionTabs active={section} onChange={onSectionChange} />

      {showSearch && setSearchInput ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Divider compact />
          <SearchActionRow
            trailing={
              <View
                style={{
                  flexDirection: rowDirection(isRTL),
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <FloorIconButton
                  icon="qr-code-outline"
                  accessibilityLabel={t('mobile.inventory.scanBarcode')}
                  onPress={() => {
                    if (section === 'items' && canCreate) onCreate?.();
                  }}
                />
                <FloorIconButton
                  icon="sync-outline"
                  accessibilityLabel={
                    syncVisible
                      ? t('mobile.inventory.syncFromMaterials')
                      : t('mobile.inventory.sync')
                  }
                  loading={syncing}
                  onPress={() => {
                    if (syncVisible) onSync?.();
                    else onRefresh?.();
                  }}
                />
              </View>
            }
          >
            <InventorySearchField
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder={searchPlaceholder}
            />
          </SearchActionRow>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function FloorIconButton({
  icon,
  accessibilityLabel,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  loading?: boolean;
  onPress: () => void;
}) {
  const { colors, theme } = useTheme();
  const size = theme.sizes.touch.min;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={loading}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: colors.brand,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.brand} />
      ) : (
        <Ionicons name={icon} size={18} color={colors.brand} />
      )}
    </AnimatedPressable>
  );
}

function FloorActionButton({
  label,
  accessibilityLabel,
  icon,
  tone,
  loading,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'soft' | 'solid';
  loading?: boolean;
  onPress: () => void;
}) {
  const { locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const solid = tone === 'solid';

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={loading}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 40,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: solid ? colors.brand : colors.borderStrong,
        backgroundColor: solid ? colors.brand : colors.surface,
        flexDirection: rowDirection(isRTL),
        alignItems: 'center',
        gap: theme.spacing.xs,
        overflow: 'hidden',
        ...theme.elevation.card,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={solid ? colors.onBrand : colors.brand} />
      ) : (
        <>
          <Ionicons
            name={icon}
            size={15}
            color={solid ? colors.onBrand : colors.brand}
          />
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'medium' : 'semibold'}
            style={{ color: solid ? colors.onBrand : colors.brand }}
            numberOfLines={1}
          >
            {label}
          </AppText>
        </>
      )}
    </AnimatedPressable>
  );
}
