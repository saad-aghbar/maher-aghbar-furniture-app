import { inferSalesOrderResumeStatus } from './sales-order-resume';
import { SalesOrderStatus } from '@maher/database';

describe('inferSalesOrderResumeStatus', () => {
  it('resumes into production when floor work is open', () => {
    expect(inferSalesOrderResumeStatus(['IN_PROGRESS'])).toBe(SalesOrderStatus.IN_PRODUCTION);
  });

  it('resumes to ready for delivery when manufacturing is packed', () => {
    expect(inferSalesOrderResumeStatus(['READY_FOR_DELIVERY'])).toBe(
      SalesOrderStatus.READY_FOR_DELIVERY,
    );
  });

  it('does not treat cancelled siblings as active work', () => {
    expect(inferSalesOrderResumeStatus(['CANCELLED'])).toBe(SalesOrderStatus.CONFIRMED);
  });
});
