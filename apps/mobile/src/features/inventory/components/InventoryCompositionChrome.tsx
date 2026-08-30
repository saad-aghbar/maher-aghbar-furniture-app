import type { ReactNode } from 'react';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
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
import { InventoryFilterButton } from './InventoryFilterButton';

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
  scanLabel?: string;
  onScan?: () => void;
  canScan?: boolean;
  /** Orders-style top-right filter (Finished / Semi items). */
  onOpenFilters?: () => void;
  filterActiveCount?: number;
  children?: ReactNode;
};

const TOOL_WELL = 40;

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
  scanLabel,
  onScan,
  canScan,
  onOpenFilters,
  filterActiveCount = 0,
  children,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const onMaterialsItems = lifecycle === 'materials' && section === 'items';
  const syncVisible = onMaterialsItems && Boolean(canSync && onSync);
  const createVisible = Boolean(canCreate && onCreate && createLabel);
  const warehouseVisible =
    onMaterialsItems && Boolean(canCreateWarehouse && onCreateWarehouse && warehouseLabel);
  const scanVisible = Boolean(canScan && onScan && scanLabel);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const rowDir = isRTL ? 'row-reverse' : 'row';
  const showFilter = Boolean(onOpenFilters);
  const lifecycleEyebrow =
    lifecycle === 'semiFinished'
      ? t('mobile.inventory.pulseEyebrowSemi')
      : lifecycle === 'finished'
        ? t('mobile.inventory.pulseEyebrowFinished')
        : t('mobile.inventory.pulseEyebrow');

  return (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
      <ToastClearance />
      <View
        style={{
          flexDirection: rowDir,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs, minWidth: 0 }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color:
                lifecycle === 'semiFinished'
                  ? colors.info
                  : lifecycle === 'finished'
                    ? colors.success
                    : colors.brand,
            }}
          >
            {lifecycleEyebrow}
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
        {showFilter ? (
          <InventoryFilterButton onPress={onOpenFilters!} activeCount={filterActiveCount} />
        ) : null}
      </View>

      <InventoryLifecycleTabs active={lifecycle} onChange={onLifecycleChange} />
      <InventorySectionTabs active={section} onChange={onSectionChange} />

      {showSearch && setSearchInput ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Divider compact />
          <View
            style={{
              flexDirection: rowDir,
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <TextField
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder={searchPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            {scanVisible ? (
              <FloorActionButton
                label={scanLabel!}
                accessibilityLabel={scanLabel!}
                icon="qr-code-outline"
                tone="soft"
                iconOnly
                onPress={() => onScan?.()}
              />
            ) : null}
            {syncVisible ? (
              <FloorActionButton
                label={t('mobile.inventory.sync')}
                accessibilityLabel={t('mobile.inventory.syncFromMaterials')}
                icon="sync-outline"
                tone="soft"
                iconOnly
                loading={syncing}
                onPress={() => onSync?.()}
              />
            ) : null}
          </View>
        </View>
      ) : scanVisible ? (
        <View
          style={{
            flexDirection: rowDir,
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: theme.spacing.sm,
          }}
        >
          <FloorActionButton
            label={scanLabel!}
            accessibilityLabel={scanLabel!}
            icon="qr-code-outline"
            tone="soft"
            iconOnly
            onPress={() => onScan?.()}
          />
        </View>
      ) : null}

      {createVisible || warehouseVisible ? (
        <View
          style={{
            flexDirection: rowDir,
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          {createVisible ? (
            <FloorActionButton
              label={createLabel!}
              accessibilityLabel={createLabel!}
              icon="add"
              tone="solid"
              style={{ flex: 1, minWidth: 0 }}
              onPress={() => onCreate?.()}
            />
          ) : null}
          {warehouseVisible ? (
            <FloorActionButton
              label={warehouseLabel!}
              accessibilityLabel={warehouseLabel!}
              icon="business-outline"
              tone="soft"
              style={{ flex: 1, minWidth: 0 }}
              onPress={() => onCreateWarehouse?.()}
            />
          ) : null}
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
  iconOnly,
  style,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'soft' | 'solid';
  loading?: boolean;
  iconOnly?: boolean;
  style?: ViewStyle;
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
        minHeight: TOOL_WELL,
        minWidth: iconOnly ? TOOL_WELL : undefined,
        height: iconOnly ? TOOL_WELL : undefined,
        paddingHorizontal: iconOnly ? 0 : theme.spacing.md,
        paddingVertical: iconOnly ? 0 : theme.spacing.sm,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: solid ? colors.brand : colors.borderStrong,
        backgroundColor: solid ? colors.brand : colors.surface,
        flexDirection: rowDirection(isRTL),
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        overflow: 'hidden',
        ...theme.elevation.card,
        ...style,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={solid ? colors.onBrand : colors.brand} />
      ) : (
        <>
          <Ionicons
            name={icon}
            size={iconOnly ? 18 : 15}
            color={solid ? colors.onBrand : colors.brand}
          />
          {iconOnly ? null : (
            <AppText
              variant="caption"
              weight={locale === 'ar' ? 'medium' : 'semibold'}
              style={{ color: solid ? colors.onBrand : colors.brand, flexShrink: 1 }}
              numberOfLines={1}
            >
              {label}
            </AppText>
          )}
        </>
      )}
    </AnimatedPressable>
  );
}
