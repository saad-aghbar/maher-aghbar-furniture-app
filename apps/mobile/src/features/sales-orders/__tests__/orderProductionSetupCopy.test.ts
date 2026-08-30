import { translate, translatePlural } from '@/i18n/translate';
import {
  isReleasedToFactory,
  orderProductionSetupPlanCopy,
  remainingIssueCount,
  selectOrderProductionSetup,
} from '../orderProductionSetupCopy';
import { selectOrderDetail } from '../selectOrderDetail';
import {
  adminDraftOrderDetailFixture,
  adminOrderDetailFixture,
} from '../detailFixtures';

describe('isReleasedToFactory', () => {
  it('treats in-production orders with a PO as released', () => {
    expect(isReleasedToFactory('IN_PRODUCTION', 1)).toBe(true);
  });

  it('treats an explicit Released pill as released', () => {
    expect(isReleasedToFactory('Released', 0)).toBe(true);
  });

  it('does not treat a draft with no production order as released', () => {
    expect(isReleasedToFactory('DRAFT', 0)).toBe(false);
  });
});

describe('orderProductionSetupPlanCopy', () => {
  const t = (key: string) => translate('en', key);

  it('does not say required or then-release when the order is already released', () => {
    const copy = orderProductionSetupPlanCopy(true, t);
    expect(copy.kicker).toBe('Production plan');
    expect(copy.kicker).not.toMatch(/required/i);
    expect(copy.kicker).not.toMatch(/^[A-Z ]+$/);
    expect(copy.body).toMatch(/Floor work orders exist/i);
    expect(copy.body).not.toMatch(/then release/i);
    expect(copy.body).not.toMatch(/REQUIRED/);
  });

  it('keeps the required plan copy only before release', () => {
    const copy = orderProductionSetupPlanCopy(false, t);
    expect(copy.kicker).toBe('Production plan required');
    expect(copy.kicker).not.toMatch(/^[A-Z ]+$/);
    expect(copy.body).toMatch(/then release to the factory/i);
  });

  it('humanizes factory readiness as sentence-case', () => {
    expect(translate('en', 'mobile.orderProductionSetup.factoryReadiness')).toBe(
      'Factory readiness',
    );
    expect(translate('en', 'mobile.orderProductionSetup.factoryReadiness')).not.toMatch(
      /^[A-Z ]+$/,
    );
  });
});

describe('remainingIssueCount', () => {
  it('uses an honest count with correct English plural', () => {
    expect(
      remainingIssueCount({
        linesReadyCount: 1,
        lineCount: 1,
        materialsNeedReview: true,
        estimateIncomplete: false,
      }),
    ).toBe(1);
    expect(translatePlural('en', 'mobile.orderProductionSetup.issuesRemaining', 1)).toBe(
      '1 issue remaining',
    );
    expect(translatePlural('en', 'mobile.orderProductionSetup.issuesRemaining', 2)).toBe(
      '2 issues remaining',
    );
  });
});

describe('selectOrderProductionSetup', () => {
  it('marks an in-production admin order as released and does not invent material leftovers', () => {
    const vm = selectOrderDetail(adminOrderDetailFixture, 'admin');
    const facts = selectOrderProductionSetup(vm);
    expect(facts.released).toBe(true);
    expect(facts.setupProgressPercent).toBe(100);
    expect(facts.lineCount).toBe(1);
    expect(facts.linesReadyCount).toBe(1);
    expect(facts.materialsNeedReview).toBe(false);
    expect(facts.estimateIncomplete).toBe(false);
    expect(facts.remainingIssueCount).toBe(0);
  });

  it('keeps a draft as not released', () => {
    const vm = selectOrderDetail(adminDraftOrderDetailFixture, 'admin');
    const facts = selectOrderProductionSetup(vm);
    expect(facts.released).toBe(false);
    expect(facts.setupProgressPercent).toBeLessThan(100);
  });

  it('counts incomplete material costs as honest leftovers', () => {
    const vm = selectOrderDetail(
      {
        ...adminOrderDetailFixture,
        manufacturingCost: null,
        productionPrice: null,
        costBreakdown: {
          fabricQty: 12,
          fabricCost: null,
          woodQty: 4,
          woodCost: 2400,
        },
      },
      'admin',
    );
    const facts = selectOrderProductionSetup(vm);
    expect(facts.estimateIncomplete).toBe(true);
    expect(facts.materialsNeedReview).toBe(true);
    expect(facts.remainingIssueCount).toBe(2);
  });
});
