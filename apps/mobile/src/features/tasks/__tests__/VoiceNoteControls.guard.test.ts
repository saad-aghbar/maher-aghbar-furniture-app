import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('VoiceNoteControls native guard', () => {
  it('does not import expo-audio at module top level', () => {
    const src = readFileSync(join(__dirname, '../components/VoiceNoteControls.tsx'), 'utf8');
    expect(src).not.toMatch(/from ['"]expo-audio['"]/);
    expect(src).toMatch(/requireOptionalNativeModule/);
  });
});
