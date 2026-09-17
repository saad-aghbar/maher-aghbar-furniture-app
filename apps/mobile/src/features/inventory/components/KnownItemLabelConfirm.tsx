import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { CodeField } from '@/components/forms/CodeField';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import { formatInventoryMaterialType } from '../selectInventory';
import { InventorySkuThumb } from './InventorySkuThumb';
import { InventoryBoardCard } from './InventoryBoardCard';
import {
  InventoryScanMatchResult,
  type InventoryScanMatchCurrent,
  type InventoryScanMatchKind,
  type ScannedFabricBundle,
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
  /** Set when the scan resolved to an order-linked fabric bundle. */
  resultFabric?: ScannedFabricBundle | null;
  onOpenFabric?: (bundle: ScannedFabricBundle) => void;
  onClearResult: () => void;
  onScanAgain: () => void;
  onUseScanned?: (item: InventoryItem) => void;
  onTypedCode?: (code: string) => void;
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
  resultFabric = null,
  onOpenFabric,
  onClearResult,
  onScanAgain,
  onUseScanned,
  onTypedCode,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const materialTypeLabel = formatInventoryMaterialType(current.materialType, t);
  const kind = resultKind;
  const scanned = resultScanned;
  const busy = Boolean(scanning);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [typedCode, setTypedCode] = useState('');
  const accent =
    kind === 'MATCH'
      ? colors.success
      : kind === 'MISMATCH' || kind === 'ERROR' || kind === 'UNKNOWN' || kind === 'ARCHIVED'
        ? colors.error
        : kind === 'DISALLOWED' ||
            kind === 'SHELF' ||
            kind === 'KIT' ||
            kind === 'LOT' ||
            kind === 'ORDER_FABRIC'
          ? colors.warning
          : colors.brand;

  return (
    <View style={{ gap: theme.spacing.md }}>
      <AppText
        variant="caption"
        color="muted"
        style={{
          fontSize: 11,
          lineHeight: 14,
          ...(locale === 'ar'
            ? null
            : { letterSpacing: 0.55, textTransform: 'uppercase' as const }),
        }}
      >
        {t('mobile.inventory.selectedMaterial')}
      </AppText>

      <InventoryBoardCard accent={accent} hideAccent={!kind}>
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.md,
            alignItems: 'center',
          }}
        >
          <InventorySkuThumb uri={current.imageUrl ?? null} size={72} />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <AppText variant="body" weight={titleWeight}>
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

        {kind !== 'MATCH' && onTypedCode ? (
          <CodeField
            value={typedCode}
            onChangeText={setTypedCode}
            placeholder={t('mobile.inventory.scanLabelConfirmHint')}
            editable={!disabled && !busy}
            returnKeyType="go"
            onSubmitEditing={() => {
              const code = typedCode.trim();
              if (!code || disabled || busy) return;
              onTypedCode(code);
            }}
            onScanned={(code) => onTypedCode(code)}
            scanTitle={t('mobile.inventory.scanLabelToConfirm')}
            scanHint={t('mobile.inventory.scanLabelConfirmHint')}
          />
        ) : null}

        {kind !== 'MATCH' ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.inventory.scanLabelToConfirm')}
            disabled={disabled || busy}
            onPress={() => {
              void haptics.selection();
              onScanPress();
            }}
            style={{
              minHeight: theme.sizes.touch.min,
              borderRadius: theme.radius.full,
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
            <AppText variant="label" weight={titleWeight} color="brand">
              {busy ? t('mobile.inventory.identifyingItem') : t('mobile.inventory.scanLabelToConfirm')}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </InventoryBoardCard>

      {kind ? (
        <InventoryScanMatchResult
          kind={kind}
          current={current}
          scanned={scanned}
          fabric={resultFabric}
          onOpenFabric={
            resultFabric && onOpenFabric ? () => onOpenFabric(resultFabric) : undefined
          }
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
