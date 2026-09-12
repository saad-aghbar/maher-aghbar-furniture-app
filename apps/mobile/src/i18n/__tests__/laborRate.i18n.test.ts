import { translate } from '../../i18n/translate';

const KEYS = [
  'users.hourlyRate',
  'users.hourlyRateHint',
  'mobile.reports.laborRates',
  'mobile.reports.noWorkerRates',
  'mobile.reports.laborSlotHint',
  'accounting.workerRates',
  'accounting.noWorkerRates',
  'accounting.laborByWorker',
  'accounting.noLaborActuals',
  'accounting.laborSlotHint',
] as const;

describe('Worker labor rate i18n keys', () => {
  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves labor-rate keys in ${locale}`, () => {
      for (const key of KEYS) {
        const value = translate(locale, key);
        expect(value).not.toBe(key);
        expect(value.length).toBeGreaterThan(0);
      }
    });
  }
});
