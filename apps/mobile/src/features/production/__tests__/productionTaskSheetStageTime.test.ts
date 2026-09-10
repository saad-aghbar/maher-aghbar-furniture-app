import { readFileSync } from 'fs';
import { join } from 'path';

const sheet = readFileSync(
  join(__dirname, '../components/ProductionTaskSheet.tsx'),
  'utf8',
);
const board = readFileSync(
  join(__dirname, '../components/WorkerDayBoard.tsx'),
  'utf8',
);
const assignWindow = readFileSync(join(__dirname, '../assignWindow.ts'), 'utf8');

describe('ProductionTaskSheet stage-time gate', () => {
  it('blocks assign and opens path & set times when the stage has no estimate', () => {
    expect(sheet).toContain('onOpenStageTimes');
    expect(sheet).toContain('stageTimeMissingTitle');
    expect(sheet).toContain('openStageTimes');
    expect(sheet).toContain('!hasStageTime');
    expect(sheet).not.toContain('DEFAULT_ASSIGN_DURATION_MINUTES');
  });

  it('does not fall back to a silent 120-minute slot', () => {
    expect(assignWindow).not.toContain('DEFAULT_ASSIGN_DURATION_MINUTES');
    expect(board).not.toMatch(/estimatedMinutes && estimatedMinutes > 0 \? estimatedMinutes : 120/);
    expect(board).toContain('stageTimeMissingBody');
  });

  it('drops the date/time/duration inputs and picks the day on the board', () => {
    expect(sheet).not.toContain('InlineDateCalendar');
    expect(sheet).not.toContain('estimateDuration');
    expect(sheet).toContain('plannedWindowLabel');
    expect(sheet).toContain('onDayChange');
  });
});
