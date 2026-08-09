import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { Divider } from '@/components/layout/Divider';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  InventorySectionTabs,
  type InventoryHomeSection,
} from './InventorySectionTabs';

type Props = {
  title: string;
  subtitle?: string;
  section: InventoryHomeSection;
  onSectionChange: (section: InventoryHomeSection) => void;
  showSearch?: boolean;
  searchInput?: string;
  setSearchInput?: (v: string) => void;
  searchPlaceholder?: string;
  onSync?: () => void;
  syncing?: boolean;
  canSync?: boolean;
  createLabel?: string;
  onCreate?: () => void;
  canCreate?: boolean;
  children?: ReactNode;
};

/** Floor chrome — stays mounted across section switches (no full-page fade). */
export function InventoryCompositionChrome({
  title,
  subtitle,
  section,
  onSectionChange,
  showSearch = true,
  searchInput = '',
  setSearchInput,
  searchPlaceholder = '',
  onSync,
  syncing,
  canSync,
  createLabel,
  onCreate,
  canCreate,
  children,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { theme, colors } = useTheme();
  const syncVisible = section === 'items' && canSync && onSync;
  const createVisible = Boolean(canCreate && onCreate && createLabel);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <AppText
            variant="caption"
            weight={locale === 'ar' ? 'regular' : 'medium'}
            style={{
              letterSpacing: locale === 'ar' ? 0 : 1.4,
              textTransform: locale === 'ar' ? 'none' : 'uppercase',
              color: colors.brand,
            }}
          >
            {t('mobile.inventory.pulseEyebrow')}
          </AppText>
          <AppText variant="title" weight={titleWeight}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color="muted" weight="regular">
              {subtitle}
            </AppText>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            justifyContent: 'flex-end',
            maxWidth: '46%',
          }}
        >
          {syncVisible ? (
            <FloorActionButton
              label={t('mobile.inventory.sync')}
              accessibilityLabel={t('mobile.inventory.syncFromMaterials')}
              icon="sync-outline"
              tone="soft"
              loading={syncing}
              onPress={onSync}
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

      <InventorySectionTabs active={section} onChange={onSectionChange} />

      {showSearch && setSearchInput ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Divider compact />
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
      ) : null}
      {children}
    </View>
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
  const { locale } = useLocale();
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
        flexDirection: 'row',
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
