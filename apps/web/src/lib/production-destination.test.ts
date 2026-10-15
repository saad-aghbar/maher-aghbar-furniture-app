import { describe, expect, it } from 'vitest';
import { adminProductionDestination, productionPlanHref, productionSetupHref } from './production-destination';

describe('adminProductionDestination', () => {
  it('keeps an unreleased material hold in planning', () => {
    expect(adminProductionDestination({
      id: 'po-b', salesOrderId: 'so-1', salesOrderLineId: 'line-b',
      status: 'WAITING_FOR_MATERIALS',
    })).toBe('/admin/sales-orders/so-1/production-plan?lineId=line-b');
  });

  it('keeps a released material hold on the factory floor', () => {
    expect(adminProductionDestination({
      id: 'po-b', salesOrderId: 'so-1', status: 'WAITING_FOR_MATERIALS',
      releasedToFactoryAt: '2026-10-12T12:00:00Z',
    })).toBe('/admin/production/po-b');
  });
  it('opens the sales-order plan for an unreleased line', () => {
    expect(
      adminProductionDestination({
        id: 'po-b',
        salesOrderId: 'so-1',
        salesOrderLineId: 'line-b',
        status: 'PLANNED',
      }),
    ).toBe('/admin/sales-orders/so-1/production-plan?lineId=line-b');
  });

  it('opens the production order once that line is released', () => {
    expect(
      adminProductionDestination({
        id: 'po-a',
        salesOrderId: 'so-1',
        salesOrderLineId: 'line-a',
        releasedToFactoryAt: '2026-10-01T08:00:00.000Z',
        status: 'PLANNED',
      }),
    ).toBe('/admin/production/po-a');
  });

  it('does not substitute another production order when this line is unreleased', () => {
    expect(
      adminProductionDestination({
        id: 'po-b',
        salesOrderId: 'so-1',
        status: 'READY',
      }),
    ).not.toBe('/admin/production/po-a');
  });
});

describe('production plan and setup links', () => {
  it('sends a sales-origin plan to that line', () => {
    expect(
      productionPlanHref({
        id: 'po-1',
        salesOrderId: 'so-1',
        salesOrderLineId: 'line-a',
      }),
    ).toBe('/admin/sales-orders/so-1/production-plan?lineId=line-a');
  });

  it('keeps a return-origin plan on the production order', () => {
    expect(productionPlanHref({ id: 'po-rw', originType: 'RETURN_WORK', status: 'PLANNED' })).toBeNull();
  });

  it('sends an unreleased return setup to the production-order plan', () => {
    expect(productionSetupHref({ id: 'po-rw', originType: 'RETURN_WORK', status: 'PLANNED' })).toBe('/admin/production/po-rw/plan');
  });

  it('sends a released return setup to the production order', () => {
    expect(
      productionSetupHref({
        id: 'po-rw',
        originType: 'REPLACEMENT',
        releasedToFactoryAt: '2026-10-01T08:00:00.000Z',
      }),
    ).toBe('/admin/production/po-rw');
  });
});
