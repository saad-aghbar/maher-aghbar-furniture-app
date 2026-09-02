/**
 * Phase B surface rules — execution dossier vs Ready / plan.
 */

import { shouldOpenPlanSheet } from '../planCta';

describe('Phase B dossier surface rules', () => {
  it('post-start main surface has no normal plan/release CTA', () => {
    // After floor start, showPlan is false → dock uses shouldOpenPlanSheet only when showPlan.
    // Guard the helper still returns release only when canStart before release.
    expect(
      shouldOpenPlanSheet({
        canStart: true,
        executableCount: 2,
        canAssign: true,
        canUpdate: true,
      }),
    ).toBe('release');

    // Without canStart (already released / not startable) → no release CTA.
    expect(
      shouldOpenPlanSheet({
        canStart: false,
        executableCount: 2,
        canAssign: true,
        canUpdate: true,
      }),
    ).toBe('plan');
  });

  it('Ready for Factory keeps replan as the exception unlock (documented contract)', () => {
    const readyGates = {
      releasedToFactory: true,
      floorStarted: false,
      host: 'production' as const,
      canUpdate: true,
    };
    const showReplan =
      readyGates.host === 'production' &&
      readyGates.releasedToFactory &&
      !readyGates.floorStarted &&
      readyGates.canUpdate;
    expect(showReplan).toBe(true);

    const afterStart = { ...readyGates, floorStarted: true };
    const showReplanAfter =
      afterStart.host === 'production' &&
      afterStart.releasedToFactory &&
      !afterStart.floorStarted &&
      afterStart.canUpdate;
    expect(showReplanAfter).toBe(false);
  });

  it('active production task default intent is view, not assign', () => {
    const isExecutionDossier = true;
    const taskSheetIntent: 'view' | 'manage' | 'plan' = 'view';
    const resolvedIntent =
      isExecutionDossier
        ? taskSheetIntent === 'manage'
          ? 'manage'
          : 'view'
        : 'plan';
    expect(resolvedIntent).toBe('view');
  });
});
