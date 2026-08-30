import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import { formatInventoryMaterialType } from '../selectInventory';
import { InventorySkuThumb } from './InventorySkuThumb';
import {
  InventoryScanMatchResult,
  type InventoryScanMatchCurrent,
  type InventoryScanMatchKind,
} from './InventoryScanMatchResult';

type Props = {
  current: InventoryScanMatchCurrent;
  /** Parent owns the camera await — this only triggers. */
  onScanPress: () => void;
  scanning?: boolean;
  disabled?: boolean;
  /** When true, MISMATCH may offer “Use scanned material”. */
  allowChangeItem?: boolean;
  resultKind?: InventoryScanMatchKind | null;
  resultScanned?: InventoryItem | null;
  onClearResult: () => void;
  onScanAgain: () => void;
  onUseScanned?: (item: InventoryItem) => void;
};

/**
 * MODE C — VERIFY (presentation only).
 * Parent operation sheet owns scanner await + result state.
 * Never awaits the camera itself — child must not own that continuation.
 */
export function KnownItemLabelConfirm({
  current,
  onScanPress,
  scanning,
  disabled,
  allowChangeItem = true,
  resultKind = null,
  resultScanned = null,
  onClearResult,
  onScanAgain,
  onUseScanned,
}: Props) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const materialTypeLabel = formatInventoryMaterialType(current.materialType, t);
  const kind = resultKind;
  const scanned = resultScanned;
  const busy = Boolean(scanning);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppText
        variant="caption"
        color="muted"
        style={{
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          fontSize: 11,
          lineHeight: 14,
        }}
      >
        {t('mobile.inventory.selectedMaterial')}
      </AppText>

      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor:
            kind === 'MATCH'
              ? colors.success
              : kind === 'MISMATCH' || kind === 'ERROR' || kind === 'UNKNOWN' || kind === 'ARCHIVED'
                ? colors.error
                : kind === 'DISALLOWED'
                  ? colors.warning
                  : colors.borderStrong,
          backgroundColor:
            kind === 'MATCH'
              ? colors.successSoft
              : kind === 'MISMATCH' || kind === 'ERROR' || kind === 'UNKNOWN' || kind === 'ARCHIVED'
                ? colors.errorSoft
                : kind === 'DISALLOWED'
                  ? colors.warningSoft
                  : colors.surface,
          padding: theme.spacing.md,
          gap: theme.spacing.md,
          ...theme.elevation.card,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
          }}
        >
          <InventorySkuThumb uri={current.imageUrl ?? null} size={72} />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <AppText variant="body" weight="semibold">
              {current.name}
            </AppText>
            <AppText variant="caption" color="muted" dir="ltr">
              {[current.sku, materialTypeLabel, current.unit].filter(Boolean).join(' · ')}
            </AppText>
          </View>
        </View>

        {kind !== 'MATCH' ? (
          <AppText variant="caption" color="muted">
            {t('mobile.inventory.scanLabelConfirmHint')}
          </AppText>
        ) : null}

        {kind !== 'MATCH' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mobile.inventory.scanLabelToConfirm')}
            disabled={disabled || busy}
            onPress={() => {
              void haptics.selection();
              onScanPress();
            }}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.brand,
              backgroundColor: colors.brandSoft,
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.sm,
              opacity: disabled || busy ? 0.55 : 1,
            }}
          >
            <Ionicons
              name={busy ? 'hourglass-outline' : 'qr-code-outline'}
              size={20}
              color={colors.brand}
            />
            <AppText variant="label" weight="semibold" color="brand">
              {busy ? t('mobile.inventory.identifyingItem') : t('mobile.inventory.scanLabelToConfirm')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {kind ? (
        <InventoryScanMatchResult
          kind={kind}
          current={current}
          scanned={scanned}
          onScanAgain={onScanAgain}
          onKeepCurrent={onClearResult}
          onUseScanned={
            kind === 'MISMATCH' && allowChangeItem && onUseScanned && scanned
              ? () => {
                  void haptics.confirmLight();
                  onUseScanned(scanned);
                }
              : undefined
          }
        />
      ) : null}
    </View>
  );
}
