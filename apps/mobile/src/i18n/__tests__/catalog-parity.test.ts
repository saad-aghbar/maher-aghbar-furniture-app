import { allLeafKeys, getMessages, pluralAr } from '@maher/i18n';
import { translate, translatePlural } from '../translate';

function keysOf(locale: 'ar' | 'en' | 'he'): Set<string> {
  return new Set(allLeafKeys(getMessages(locale)));
}

describe('i18n catalog parity', () => {
  const en = keysOf('en');
  const ar = keysOf('ar');
  const he = keysOf('he');

  it('has the same keys in en, ar, and he', () => {
    const missingInAr = [...en].filter((k) => !ar.has(k));
    const missingInHe = [...en].filter((k) => !he.has(k));
    const extraAr = [...ar].filter((k) => !en.has(k));
    const extraHe = [...he].filter((k) => !en.has(k));
    expect({ missingInAr, missingInHe, extraAr, extraHe }).toEqual({
      missingInAr: [],
      missingInHe: [],
      extraAr: [],
      extraHe: [],
    });
  });

  it('has no empty or placeholder Arabic values', () => {
    const bad: string[] = [];
    for (const key of ar) {
      const value = translate('ar', key).trim();
      if (!value || value === key || /^(TODO|TBD|placeholder)$/i.test(value)) {
        bad.push(`${key}=${value}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('does not return the raw key for Arabic', () => {
    const leaks = [...ar].filter((key) => translate('ar', key) === key);
    expect(leaks).toEqual([]);
  });
});

describe('Arabic glossary smoke', () => {
  it('calls dealers تجار not وكلاء', () => {
    expect(translate('ar', 'navigation.dealers')).toContain('تجار');
    expect(translate('ar', 'navigation.dealers')).not.toContain('وكيل');
    expect(translate('ar', 'customers.title')).toContain('تجار');
  });

  it('uses factory-natural statuses', () => {
    expect(translate('ar', 'statuses.BLOCKED')).toBe('متوقفة');
    expect(translate('ar', 'statuses.AT_RISK')).toBe('معرّضة للتأخير');
    expect(translate('ar', 'statuses.APPROVED')).toBe('تمت الموافقة');
  });

  it('avoids literal workflow jargon', () => {
    expect(translate('ar', 'production.workflow.dependencies')).not.toContain('التبعيات');
    expect(translate('ar', 'production.workflow.orderSnapshot')).not.toContain('لقطة');
    expect(translate('ar', 'production.workflow.runsAfter')).toBe('تبدأ بعد');
    expect(translate('ar', 'navigation.workflow')).toBe('سير الإنتاج');
  });

  it('keeps employees distinct from users', () => {
    expect(translate('ar', 'navigation.users')).toBe('المستخدمون');
    expect(translate('ar', 'navigation.employees')).toBe('الموظفون');
  });

  it('keeps dimension labels in the catalog, not in components', () => {
    expect(translate('ar', 'catalog.dimWidth')).toBe('العرض');
    expect(translate('ar', 'common.skipIntro')).toBe('تخطي المقدمة');
  });
});

describe('pluralAr', () => {
  const forms = {
    zero: 'لا طلبيات',
    one: 'طلبية واحدة',
    two: 'طلبيتان',
    few: '{n} طلبيات',
    many: '{n} طلبية',
  };

  it('selects Arabic plural categories', () => {
    expect(pluralAr(0, forms)).toBe('لا طلبيات');
    expect(pluralAr(1, forms)).toBe('طلبية واحدة');
    expect(pluralAr(2, forms)).toBe('طلبيتان');
    expect(pluralAr(3, forms)).toBe('3 طلبيات');
    expect(pluralAr(11, forms)).toBe('11 طلبية');
  });
});

describe('translatePlural', () => {
  it('uses Arabic dual and few forms for due days', () => {
    expect(translatePlural('ar', 'mobile.dealerHome.dueInDays', 1)).toBe(
      'يستحق خلال يوم واحد',
    );
    expect(translatePlural('ar', 'mobile.dealerHome.dueInDays', 2)).toBe(
      'يستحق خلال يومين',
    );
    expect(translatePlural('ar', 'mobile.dealerHome.dueInDays', 5)).toBe(
      'يستحق خلال 5 أيام',
    );
    expect(translatePlural('ar', 'mobile.dealerHome.dueInDays', 15)).toBe(
      'يستحق خلال 15 يوماً',
    );
  });

  it('uses English singular for one day', () => {
    expect(translatePlural('en', 'mobile.dealerHome.dueInDays', 1)).toBe('Due in 1 day');
    expect(translatePlural('en', 'mobile.dealerHome.dueInDays', 4)).toBe('Due in 4 days');
  });

  it('uses Warehouse when there is one, Warehouses when several', () => {
    expect(translatePlural('en', 'catalog.warehouses', 1)).toBe('Warehouse');
    expect(translatePlural('en', 'catalog.warehouses', 2)).toBe('Warehouses');
    expect(translatePlural('ar', 'catalog.warehouses', 1)).toBe('المستودع');
    expect(translatePlural('ar', 'catalog.warehouses', 2)).toBe('المستودعان');
    expect(translatePlural('he', 'catalog.warehouses', 1)).toBe('מחסן');
    expect(translatePlural('he', 'catalog.warehouses', 3)).toBe('מחסנים');
  });

  it('pluralizes foam block qty in en, ar, and he', () => {
    expect(translatePlural('en', 'catalog.qtyWithUnit.block', 24)).toBe('24 blocks');
    expect(translatePlural('en', 'catalog.qtyWithUnit.block', 1)).toBe('1 block');
    expect(translatePlural('ar', 'catalog.qtyWithUnit.block', 24)).toBe('24 بلوك');
    expect(translatePlural('he', 'catalog.qtyWithUnit.block', 24)).toBe('24 בלוקים');
  });
});
