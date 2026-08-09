import { translate } from '../translate';

describe('completed filter i18n keys', () => {
  const keys = [
    'mobile.tasks.completedSearchPlaceholder',
    'mobile.tasks.completedDateLabel',
    'mobile.tasks.completedDateAll',
    'mobile.tasks.completedDateToday',
    'mobile.tasks.completedDateWeek',
    'mobile.tasks.completedDateCustom',
    'mobile.tasks.completedDateSelected',
    'mobile.tasks.completedDateOpenSheet',
    'mobile.tasks.completedDateSheetTitle',
    'mobile.tasks.completedDateSheetEyebrow',
    'mobile.tasks.completedDateSheetBody',
    'mobile.tasks.completedDateSheetPick',
    'mobile.tasks.completedDateApply',
    'mobile.tasks.completedDatePrevMonth',
    'mobile.tasks.completedDateNextMonth',
    'mobile.tasks.completedDealerEmpty',
    'mobile.tasks.emptyCompletedFilteredTitle',
    'mobile.tasks.emptyCompletedFilteredBody',
  ] as const;

  for (const locale of ['en', 'ar', 'he'] as const) {
    it(`resolves keys in ${locale}`, () => {
      for (const key of keys) {
        const value = translate(locale, key);
        expect(value).toBeTruthy();
        expect(value).not.toBe(key);
      }
    });
  }
});
