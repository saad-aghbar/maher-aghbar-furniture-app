import { translate } from '../../i18n/translate';

const KEYS = [
  'mobile.reports.tabs.money',
  'mobile.reports.tabs.orders',
  'mobile.reports.tabs.products',
  'mobile.reports.tabs.returns',
  'mobile.reports.tabs.coverage',
  'mobile.reports.filterTitle',
  'mobile.reports.filterActive',
  'mobile.reports.filterStatus',
  'mobile.reports.filterDealer',
  'mobile.reports.filterProduct',
  'mobile.reports.allStatuses',
  'mobile.reports.filterHint',
  'mobile.reports.filterDealerSearch',
  'mobile.reports.filterProductSearch',
  'mobile.reports.filterApplyWithCount',
  'mobile.reports.returnStatus.REQUESTED',
  'mobile.reports.complexity.MODIFIED',
  'mobile.reports.moneyDesk',
  'mobile.reports.notConfigured',
  'mobile.reports.laborSlot',
  'mobile.reports.laborSlotHint',
  'mobile.reports.laborRates',
  'mobile.reports.noWorkerRates',
  'mobile.reports.laborByWorker',
  'mobile.reports.laborByStage',
  'mobile.reports.noLaborActuals',
  'mobile.reports.variantSlot',
  'mobile.reports.variantSlotHint',
  'mobile.reports.optionSlot',
  'mobile.reports.optionSlotHint',
  'mobile.reports.backfill',
  'mobile.reports.openOrder',
  'mobile.reports.openReturn',
  'mobile.reports.materials',
  'mobile.reports.transactions',
  'mobile.reports.linkedReturns',
  'mobile.reports.timeByStage',
  'mobile.reports.orderLines',
  'mobile.reports.pieces',
  'accounting.plannedCost',
  'accounting.variance',
  'accounting.returnCostDossier',
  'accounting.repairCost',
  'accounting.recoveryCost',
  'accounting.returnGrossCost',
] as const;

describe('Cost & Performance i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves Cost & Performance keys in ${locale}`, () => {
      for (const key of KEYS) {
        const value = translate(locale, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
