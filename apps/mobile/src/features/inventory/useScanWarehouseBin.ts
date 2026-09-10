import { parseBinScanCode } from '@maher/types';
import { getWarehouseLocationByCode, type WarehouseBinContents } from '@/api/modules/inventory';
import { useCodeScanner } from '@/components/scan/CodeScannerProvider';
import { useToast } from '@/components/feedback/Toast';
import { useLocale } from '@/i18n';

export function useScanWarehouseBin() {
  const { openScanner } = useCodeScanner();
  const { t } = useLocale();
  const { showToast } = useToast();

  return async function scanWarehouseBin(): Promise<WarehouseBinContents | null> {
    const code = await openScanner({
      title: t('mobile.inventory.scanBin'),
      hint: t('mobile.inventory.searchBins'),
    });
    if (!code) return null;
    const parsed = parseBinScanCode(code);
    const lookup = parsed.kind === 'bin' ? parsed.idOrCode : code.trim();
    try {
      return await getWarehouseLocationByCode(lookup);
    } catch {
      showToast({
        variant: 'error',
        message: t('mobile.inventory.scanBinNotFound'),
      });
      return null;
    }
  };
}
