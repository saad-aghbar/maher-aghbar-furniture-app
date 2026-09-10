import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '../components/TaskSemiOutputFloorSection.tsx'),
  'utf8',
);

describe('TaskSemiOutputFloorSection assigned kits', () => {
  it('shows planned kits and pieces instead of an empty no-pieces state', () => {
    expect(src).toContain('buildWorkerOutputKits');
    expect(src).toContain('piecePlanFromOutput');
    expect(src).toContain('captureForSlot');
    expect(src).toContain('confirmPiece');
    expect(src).toContain('outputPieceMarkMade');
    expect(src).toContain('addOffPlanPiece');
    expect(src).toContain('addPieceNameTitle');
    expect(src).toContain('nextExtraSortOrder');
    expect(src).not.toContain("t('mobile.tasks.addKit')");
    expect(src).not.toContain('onAddKit');
    expect(src).not.toContain("t('mobile.tasks.noPiecesYet')");
  });

  it('takes a photo then confirms before adding the piece', () => {
    expect(src).toContain('openAccessoryCamera');
    expect(src).toContain('setPendingConfirm');
    expect(src).toContain('uploadAndAdd(pendingConfirm.uri');
  });
});
