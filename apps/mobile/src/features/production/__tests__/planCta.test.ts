import {
  planCtaMustOpenSheet,
  shouldOpenPlanSheet,
  workersDatesLabel,
} from '../planCta';

describe('planCta', () => {
  it('opens plan sheet when planning incomplete', () => {
    expect(
      shouldOpenPlanSheet({
        canStart: false,
        executableCount: 3,
        canAssign: true,
        canUpdate: true,
      }),
    ).toBe('plan');
  });

  it('opens release when ready', () => {
    expect(
      shouldOpenPlanSheet({
        canStart: true,
        executableCount: 3,
        canAssign: true,
        canUpdate: true,
      }),
    ).toBe('release');
  });

  it('never uses a silent no-op CTA even with 0 tasks', () => {
    expect(planCtaMustOpenSheet(0)).toBe(true);
    expect(planCtaMustOpenSheet(5)).toBe(true);
  });

  it('formats workers/dates counts', () => {
    expect(workersDatesLabel(0, 0)).toBe('0/0');
    expect(workersDatesLabel(1, 4)).toBe('1/4');
  });
});
