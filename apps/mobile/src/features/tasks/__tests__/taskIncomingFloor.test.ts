import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '../components/TaskIncomingWorkFloorSection.tsx'),
  'utf8',
);

describe('TaskIncomingWorkFloorSection QR path', () => {
  it('pins a full-width incoming scan CTA and classifies before confirm', () => {
    expect(src).toContain('testID="task-scan-incoming"');
    expect(src).toContain('openScan');
    expect(src).toContain('classifyIncomingWipScan');
    expect(src).toContain('applyIncomingScan');
    expect(src).toContain('incomingQrIsRaw');
    expect(src).toContain('incomingQrWrongOrder');
  });
});
