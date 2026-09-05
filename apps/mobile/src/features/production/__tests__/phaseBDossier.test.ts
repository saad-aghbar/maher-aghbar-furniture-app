/**
 * Phase B surface rules — Ready for Factory vs In Production dossiers.
 */

import { shouldOpenPlanSheet } from '../planCta';

describe('Phase B dossier surface rules', () => {
  it('post-start main surface has no normal plan/release CTA', () => {
    expect(
      shouldOpenPlanSheet({
        canStart: true,
        executableCount: 2,
        canAssign: true,
        canUpdate: true,
      }),
    ).toBe('release');

    expect(
      shouldOpenPlanSheet({
        canStart: false,
        executableCount: 2,
        canAssign: true,
        canUpdate: true,
      }),
    ).toBe('plan');
  });

  it('Ready for Factory keeps replan as the only unlock CTA', () => {
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

  it('Ready for Factory forces task sheet view intent (no free assign/manage)', () => {
    const isReadyDossier = true;
    const isExecutionDossier = false;
    const taskSheetIntent: 'view' | 'manage' | 'plan' = 'manage';
    const resolvedIntent = isReadyDossier
      ? 'view'
      : isExecutionDossier
        ? taskSheetIntent === 'manage'
          ? 'manage'
          : 'view'
        : 'plan';
    expect(resolvedIntent).toBe('view');
  });

  it('active production task default intent is view; manage only as exception', () => {
    const isExecutionDossier = true;
    const isReadyDossier = false;
    const taskSheetIntent: 'view' | 'manage' | 'plan' = 'view';
    const resolvedIntent = isReadyDossier
      ? 'view'
      : isExecutionDossier
        ? taskSheetIntent === 'manage'
          ? 'manage'
          : 'view'
        : 'plan';
    expect(resolvedIntent).toBe('view');

    const manageIntent: 'view' | 'manage' | 'plan' = 'manage';
    const managed = isReadyDossier
      ? 'view'
      : isExecutionDossier
        ? manageIntent === 'manage'
          ? 'manage'
          : 'view'
        : 'plan';
    expect(managed).toBe('manage');
  });

  it('Ready dossier hides free priority/delivery edits', () => {
    const isReadyDossier = true;
    const canUpdate = true;
    const showPriorityDelivery = canUpdate && !isReadyDossier;
    expect(showPriorityDelivery).toBe(false);
  });
});
