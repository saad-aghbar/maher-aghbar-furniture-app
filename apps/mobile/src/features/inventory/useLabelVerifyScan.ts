import { useCallback, useRef, useState } from 'react';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import type { InventoryItem } from './api';
import { runInventoryLabelVerify } from './runInventoryLabelVerify';
import type {
  InventoryScanMatchKind,
  ScannedFabricBundle,
} from './components/InventoryScanMatchResult';
import { qrLog } from './qrSessionLog';

/**
 * Parent-owned VERIFY state + scan runner for operation sheets.
 * Hooks live on the sheet host component (not Modal children), so state survives
 * while BottomSheet yields its Modal for the camera.
 */
export function useLabelVerifyScan(currentId: string | undefined) {
  const { t } = useLocale();
  const { openScanner } = useCodeScanner();
  const [kind, setKind] = useState<InventoryScanMatchKind | null>(null);
  const [scanned, setScanned] = useState<InventoryItem | null>(null);
  const [fabric, setFabric] = useState<ScannedFabricBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const currentIdRef = useRef(currentId);
  const busyRef = useRef(false);
  currentIdRef.current = currentId;

  const clear = useCallback(() => {
    setKind(null);
    setScanned(null);
    setFabric(null);
  }, []);

  const resetAll = useCallback(() => {
    clear();
    busyRef.current = false;
    setBusy(false);
  }, [clear]);

  const run = useCallback(async () => {
    const id = currentIdRef.current;
    if (!id || busyRef.current) return;
    clear();
    busyRef.current = true;
    setBusy(true);
    try {
      const code = await openScanner({
        title: t('mobile.inventory.scanLabelToConfirm'),
        hint: t('mobile.inventory.scanLabelConfirmHint'),
      });
      const outcome = await runInventoryLabelVerify({
        code,
        currentId: id,
      });
      if (!outcome) return;
      setKind(outcome.kind);
      setScanned(outcome.scanned);
      setFabric(outcome.fabric ?? null);
      qrLog(0, `VERIFY inline result state committed kind=${outcome.kind}`);
      if (outcome.kind === 'MATCH') void haptics.confirmLight();
      else void haptics.error();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [clear, openScanner, t]);

  return {
    verifyKind: kind,
    verifyScanned: scanned,
    verifyFabric: fabric,
    verifyBusy: busy,
    clearLabelVerify: clear,
    resetLabelVerify: resetAll,
    runLabelVerify: run,
  };
}
