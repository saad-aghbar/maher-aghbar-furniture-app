import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('expo-speech native guard', () => {
  it('does not import expo-speech from TaskDetailScreen', () => {
    const src = readFileSync(join(__dirname, '../TaskDetailScreen.tsx'), 'utf8');
    expect(src).not.toMatch(/from ['"]expo-speech['"]/);
    expect(src).not.toMatch(/import\(['"]expo-speech['"]\)/);
    expect(src).toMatch(/loadExpoSpeech/);
  });

  it('only loads expo-speech after ExpoSpeech exists', () => {
    const src = readFileSync(join(__dirname, '../nativeSpeech.ts'), 'utf8');
    expect(src).toMatch(/requireOptionalNativeModule\('ExpoSpeech'\)/);
    expect(src).toMatch(/if \(!hasNativeExpoSpeech\(\)\) return null/);
  });

  it('always renders the listen button on the instructions board', () => {
    const src = readFileSync(join(__dirname, '../TaskDetailScreen.tsx'), 'utf8');
    expect(src).toMatch(/SpeakInstructionsButton/);
    expect(src).toMatch(/volume-high-outline/);
    expect(src).toMatch(/mobile\.tasks\.speakInstructions/);
    expect(src).toMatch(/mobile\.tasks\.instructions/);
    expect(src).not.toMatch(/hasNativeExpoSpeech\(\) \?/);
  });
});
