import { readFileSync } from 'fs';
import { join } from 'path';

describe('notification settings floor chrome', () => {
  const src = readFileSync(
    join(__dirname, '../NotificationSettingsScreen.tsx'),
    'utf8',
  );

  it('uses a transparent floating confirm dock', () => {
    expect(src).toContain('FloatingActionDock floating');
  });

  it('gates pause-on-every-device with canPauseAll', () => {
    expect(src).toContain('canPauseAll');
    expect(src).toContain('canPauseAllDevices');
    expect(src).toContain('...(canPauseAll ? { masterEnabled } : {})');
  });
});
