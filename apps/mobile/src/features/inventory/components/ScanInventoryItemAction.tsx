import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { InventoryItem } from '../api';
import { qrLog } from '../qrSessionLog';
import {
  isInventoryItemSelectable,
  resolveInventoryScan,
} from '../resolveInventoryScan';
import {
  InventoryScanSelectInline,
  type InlineScanSelectMode,
} from './InventoryScanSelectInline';

export type ScanInventoryItemFilter = (item: InventoryItem) => boolean;

export type ScanInventoryItemActionHandle = {
  startScan: () => void;
};

type Props = {
  onItemSelected: (item: InventoryItem) => void;
  /** Return false to block selection (wrong category/warehouse scope). */
  allowItem?: ScanInventoryItemFilter;
  disabled?: boolean;
  compact?: boolean;
  /**
   * Called immediately before the camera opens.
   * Use to dismiss a pick panel so scan/confirm state lives on the operation sheet.
   */
  onBeforeScan?: () => void;
  /** When false, hide the Scan QR button but keep confirm/result mounted. */
  showTrigger?: boolean;
};

type PendingResult = {
  mode: InlineScanSelectMode;
  item: InventoryItem | null;
};

/**
 * MODE B — SELECT
 * Scan → resolve → inline confirmation (NO nested RN Modal) → explicit Use material.
 * Never submits stock movements. Never silently sets the item.
 *
 * Keep this component mounted on the operation sheet (not inside a pick panel that unmounts).
 */
export const ScanInventoryItemAction = forwardRef<
  ScanInventoryItemActionHandle,
  Props
>(function ScanInventoryItemAction(
  {
    onItemSelected,
    allowItem,
    disabled,
    compact,
    onBeforeScan,
    showTrigger = true,
  },
  ref,
) {
  const { t } = useLocale();
  const { colors, theme } = useTheme();
  const { openScanner } = useCodeScanner();
  const [pending, setPending] = useState<PendingResult | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const allowItemRef = useRef(allowItem);
  allowItemRef.current = allowItem;
  const onItemSelectedRef = useRef(onItemSelected);
  onItemSelectedRef.current = onItemSelected;
  const onBeforeScanRef = useRef(onBeforeScan);
  onBeforeScanRef.current = onBeforeScan;

  const clearPending = useCallback(() => setPending(null), []);

  const present = useCallback((mode: InlineScanSelectMode, item: InventoryItem | null) => {
    qrLog(0, `confirmation presented mode=${mode}`);
    setPending({ mode, item });
  }, []);

  const runScan = useCallback(async () => {
    if (disabled || identifying) return;
    onBeforeScanRef.current?.();
    clearPending();

    const code = await openScanner({
      title: t('mobile.inventory.scanQr'),
      hint: t('mobile.inventory.scanBarcodeHint'),
    });
    qrLog(0, `SELECT consumer resumed code=${code ?? 'null'}`);
    if (!code) {
      qrLog(0, 'camera cancel — form unchanged');
      return;
    }

    setIdentifying(true);
    void haptics.selection();
    qrLog(0, `inventory lookup started code=${code}`);
    try {
      const resolved = await resolveInventoryScan(code);
      if (resolved.status === 'NOT_FOUND') {
        void haptics.error();
        qrLog(0, 'lookup NOT_FOUND');
        present('not-found', null);
        return;
      }
      if (resolved.status === 'ERROR') {
        void haptics.error();
        qrLog(0, 'lookup ERROR');
        present('error', null);
        return;
      }

      qrLog(0, `lookup FOUND itemId=${resolved.item.id} sku=${resolved.item.sku}`);
      const gate = isInventoryItemSelectable(resolved.item, allowItemRef.current);
      if (gate === 'archived') {
        void haptics.error();
        present('blocked-inactive', resolved.item);
        return;
      }
      if (gate === 'disallowed') {
        void haptics.error();
        present('blocked-type', resolved.item);
        return;
      }

      void haptics.confirmLight();
      present('confirm', resolved.item);
    } finally {
      setIdentifying(false);
    }
  }, [clearPending, disabled, identifying, openScanner, present, t]);

  useImperativeHandle(ref, () => ({ startScan: () => void runScan() }), [runScan]);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {showTrigger && !pending ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mobile.inventory.scanQr')}
          disabled={disabled || identifying}
          onPress={() => {
            void haptics.selection();
            void runScan();
          }}
          style={
            compact
              ? {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  opacity: disabled || identifying ? 0.5 : 1,
                }
              : {
                  minHeight: theme.sizes.touch.min,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.xl,
                  borderWidth: 1,
                  borderColor: colors.brand,
                  backgroundColor: colors.brandSoft,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.spacing.sm,
                  opacity: disabled || identifying ? 0.5 : 1,
                }
          }
        >
          {identifying ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Ionicons name="qr-code-outline" size={18} color={colors.brand} />
          )}
          <AppText variant="label" weight="semibold" color="brand">
            {identifying ? t('mobile.inventory.identifyingItem') : t('mobile.inventory.scanQr')}
          </AppText>
        </Pressable>
      ) : null}

      {identifying && !pending ? (
        <AppText variant="caption" color="muted">
          {t('mobile.inventory.identifyingItem')}
        </AppText>
      ) : null}

      {pending ? (
        <InventoryScanSelectInline
          mode={pending.mode}
          item={pending.item}
          onCancel={clearPending}
          onScanAgain={() => {
            clearPending();
            void runScan();
          }}
          onUseMaterial={
            pending.mode === 'confirm' && pending.item
              ? () => {
                  const next = pending.item!;
                  qrLog(0, `user chose Use material itemId=${next.id}`);
                  clearPending();
                  onItemSelectedRef.current(next);
                  qrLog(0, 'parent callback invoked / selected item updated');
                }
              : undefined
          }
        />
      ) : null}
    </View>
  );
});
