import { readFileSync } from 'fs';
import { join } from 'path';

const screen = readFileSync(join(__dirname, '../TaskDetailScreen.tsx'), 'utf8');

describe('stop is pause — leftover is a dock button', () => {
  it('does not open leftover from onStop', () => {
    const onStop = screen.slice(screen.indexOf('async function onStop()'), screen.indexOf('async function onResume()'));
    expect(onStop).toContain('pauseMutation.mutateAsync');
    expect(onStop).not.toContain('setCarryOverOpen');
    expect(onStop).not.toContain('pastEnd');
    expect(onStop).not.toContain('overEstimate');
  });

  it('opens leftover from a dock action under Finish', () => {
    expect(screen).toContain("key: 'leftover'");
    expect(screen).toContain('setCarryOverOpen(true)');
    expect(screen).toContain('vm.canCarryOver');
  });

  it('keeps Finish in place and puts Resume in Stop’s cell', () => {
    const dock = screen.slice(screen.indexOf('const dockActions = useMemo'), screen.indexOf('const dockRows'));
    expect(dock.indexOf("key: 'finish'")).toBeLessThan(dock.indexOf("key: 'stop'"));
    expect(dock.indexOf("key: 'stop'")).toBeLessThan(dock.indexOf("key: 'resume'"));
    expect(dock).toContain('} else if (canUpdate && vm.canResume)');
  });
});
