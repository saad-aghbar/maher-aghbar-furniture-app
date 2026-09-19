'use client';

import { useRouter } from '@/i18n/navigation';
import { resolveInventoryScan } from '@/lib/resolve-inventory-scan';
import { Alert, Button, FilterChip, useCodeScanner } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function InventoryScanBar() {
  const router = useRouter();
  const ti = useTranslations('inventory');
  const tCommon = useTranslations('common');
  const { openScanner } = useCodeScanner();
  const [mode, setMode] = useState<'IDENTIFY' | 'VERIFY'>('IDENTIFY');
  const [error, setError] = useState<string | null>(null);
  const [verifySku, setVerifySku] = useState<string | null>(null);

  async function handleCode(code: string) {
    setError(null);
    const result = await resolveInventoryScan(code);
    if (mode === 'VERIFY') {
      if (result.status !== 'FOUND') {
        setError(ti('scanUnknown'));
        return;
      }
      if (verifySku && result.item.sku !== verifySku) {
        setError(ti('scanUnknown'));
        return;
      }
      setVerifySku(result.item.sku);
      router.push(`/admin/inventory/items/${result.item.id}`);
      return;
    }
    if (result.status === 'FOUND') {
      router.push(`/admin/inventory/items/${result.item.id}`);
      return;
    }
    if (result.status === 'FOUND_KIT') {
      router.push(result.kit.productionOrderId ? `/production/${result.kit.productionOrderId}` : '/inventory');
      return;
    }
    if (result.status === 'FOUND_LOT') {
      const so = result.lot.salesOrderId;
      router.push(so ? `/inventory/finished/${so}` : '/inventory');
      return;
    }
    if (result.status === 'ORDER_FABRIC') {
      router.push(`/admin/inventory/fabric-bundle/${encodeURIComponent(result.lot.qrCode ?? code)}`);
      return;
    }
    if (result.status === 'FOUND_BIN') {
      const warehouseId = result.bin.location?.warehouseId;
      router.push(warehouseId ? `/inventory/warehouses/${warehouseId}` : '/warehouses');
      return;
    }
    setError(ti('scanUnknown'));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip selected={mode === 'IDENTIFY'} onClick={() => setMode('IDENTIFY')}>
          {ti('identify')}
        </FilterChip>
        <FilterChip selected={mode === 'VERIFY'} onClick={() => setMode('VERIFY')}>
          {ti('verify')}
        </FilterChip>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            const code = await openScanner({ title: tCommon('scanTitle') });
            if (code) await handleCode(code);
          }}
        >
          {tCommon('scanTitle')}
        </Button>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
