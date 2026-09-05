import { translate } from '@/i18n/translate';
import { looksLikeRawI18nKey, resolveFabricStageLabel, resolveFabricStatusLabel } from '../fabricCopy';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('fabric copy', () => {
  it('localizes UPHOLSTERY instead of leaking the enum', () => {
    for (const locale of ['en', 'ar', 'he'] as const) {
      const t = (key: string) => translate(locale, key);
      const label = resolveFabricStageLabel(t, 'UPHOLSTERY');
      expect(label).toBeTruthy();
      expect(label).not.toBe('UPHOLSTERY');
      expect(looksLikeRawI18nKey(label!)).toBe(false);
    }
  });

  it('uses the same Ready / Waiting meaning on ops surfaces', () => {
    const t = (key: string) => translate('en', key);
    const ready = resolveFabricStatusLabel(
      t,
      {
        derivedStatus: 'READY_FOR_PRODUCTION',
        overridden: false,
        readyForProduction: true,
        expectedQty: 24,
        arrivedQty: 24,
        attentionCode: null,
      },
      'ops',
    );
    const waiting = resolveFabricStatusLabel(
      t,
      {
        derivedStatus: 'WAITING',
        overridden: false,
        readyForProduction: false,
        expectedQty: 18,
        arrivedQty: 0,
        attentionCode: null,
      },
      'ops',
    );
    expect(ready).toBe('Ready');
    expect(waiting).toBe('Waiting');
  });
});

describe('fabric bundle source has no raw i18n keys', () => {
  const bundle = readFileSync(
    join(__dirname, '../../inventory/FabricBundleDetailScreen.tsx'),
    'utf8',
  );
  const worker = readFileSync(
    join(__dirname, '../../tasks/components/TaskFabricTakeInBoard.tsx'),
    'utf8',
  );
  const procurement = readFileSync(
    join(__dirname, '../../purchasing/FabricProcurementDetailScreen.tsx'),
    'utf8',
  );
  const purchasingQuery = readFileSync(
    join(__dirname, '../../purchasing/query.ts'),
    'utf8',
  );

  it('does not interpolate missing product/stage keys or raw UPHOLSTERY', () => {
    expect(bundle).not.toContain("t('mobile.orderDetail.product')");
    expect(bundle).not.toContain('mobile.production.stage');
    expect(bundle).toContain('resolveFabricStageLabel');
    expect(bundle).toContain('dir="ltr"');
  });

  it('gates bundle actions on inventory, order, and procurement permissions', () => {
    expect(bundle).toContain("can(user, 'inventory.read')");
    expect(bundle).toContain("can(user, 'sales-order.read')");
    expect(bundle).toContain("can(user, 'fabric.procurement.read')");
    expect(procurement).toContain("can(user, 'fabric.procurement.manage')");
    expect(procurement).toContain('showManage');
    expect(procurement).toContain('showOverride');
  });

  it('invalidates fabric lists, holding, bundle, and production after take-in', () => {
    expect(worker).toContain('queryKeys.purchasing.fabricLists()');
    expect(worker).toContain("'fabric-holding'");
    expect(worker).toContain("'fabric-bundle'");
    expect(worker).toContain('queryKeys.production.all');
    expect(worker).not.toContain('{item.derivedStatus}');
  });

  it('invalidates fabric holding after goods receipt', () => {
    expect(purchasingQuery).toContain('await invalidateFabric(qc)');
  });
});
