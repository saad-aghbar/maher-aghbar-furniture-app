import { readFileSync } from 'fs';
import { join } from 'path';

const drill = readFileSync(
  join(__dirname, '../components/AdminStageDrillSheet.tsx'),
  'utf8',
);
const flow = readFileSync(join(__dirname, '../ProductionFlowScreen.tsx'), 'utf8');
const duration = readFileSync(
  join(__dirname, '../../workflow/components/StageDurationSheet.tsx'),
  'utf8',
);

describe('stage time reassign on the path chart', () => {
  it('gates Change time behind canEditTime', () => {
    expect(drill).toContain('canEditTime');
    expect(drill).toContain('onChangeTime');
    expect(drill).toContain('mobile.production.changeTime');
    expect(drill).toContain('mobile.productionFlow.stageTimeLocked');
    expect(drill).toContain('onAssignWorker');
  });

  it('hands off from the drill sheet to StageDurationSheet via onClosed', () => {
    expect(flow).toContain('durationHandoffRef');
    expect(flow).toContain('onClosed');
    expect(flow).toContain('if (durationHandoffRef.current)');
    expect(flow).toContain('setDurationStage(durationHandoffRef.current)');
    expect(flow).not.toMatch(/onChangeTime=\{\(\) => \{\s*setDurationStage\(selected\)/);
  });

  it('closes the drill sheet before navigating to assign so iOS does not stack modals', () => {
    expect(flow).toContain('assignHandoffRef');
    expect(flow).toContain('adminProductionPlanHref(assign.productionOrderId, assign.taskId)');
    expect(flow).not.toMatch(/onAssignWorker=\{\(\) => \{[^}]*router\.push/);
  });

  it('gates the button with planEditable !== false', () => {
    expect(flow).toContain('workflowQuery.data?.planEditable !== false');
    expect(flow).toContain('stageTimeEditable');
    expect(flow).toContain('adminProductionPlanHref');
  });

  it('warns that saving a new time drops the assigned worker', () => {
    expect(duration).toContain('assignedWorkerName');
    expect(duration).toContain('changeTimeDropsWorker');
    expect(flow).toContain('stageTimeSavedWorkerRemoved');
  });
});
