import { translate } from '@/i18n/translate';
import { activityLabel } from '../activityLabel';

describe('activityLabel', () => {
  const t = (key: string) => translate('ar', key);

  it('maps dotted audit actions to Arabic verb + entity', () => {
    expect(activityLabel(t, 'sales-order.hold', 'SalesOrder')).toBe('تعليق · طلبية');
    expect(activityLabel(t, 'customer.update', 'Customer')).toBe('تحديث · تاجر');
  });

  it('uses fallback verb when the action is unknown', () => {
    expect(activityLabel(t, 'mystery.zap', 'SalesOrder')).toBe('تحديث · طلبية');
  });
});
