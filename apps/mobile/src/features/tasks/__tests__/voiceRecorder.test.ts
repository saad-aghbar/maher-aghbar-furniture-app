import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  displayedVoiceSeconds,
  formatVoiceClock,
  nextPersistedVoiceSeconds,
  voiceSecondsFromMillis,
} from '../voice-recorder';

const guardSrc = readFileSync(join(__dirname, '../components/VoiceNoteControls.tsx'), 'utf8');
const audioSrc = readFileSync(join(__dirname, '../components/VoiceNoteControls.audio.tsx'), 'utf8');

describe('Voice recorder timer and local playback', () => {
  it('formats mm:ss and keeps duration after stop when millis reset to 0', () => {
    expect(formatVoiceClock(0)).toBe('00:00');
    expect(formatVoiceClock(65)).toBe('01:05');
    expect(voiceSecondsFromMillis(12_400)).toBe(12);

    const whileRecording = nextPersistedVoiceSeconds({
      isRecording: true,
      liveSeconds: 8,
      persistedSeconds: 0,
    });
    expect(whileRecording).toBe(8);

    const afterStopReset = nextPersistedVoiceSeconds({
      isRecording: false,
      liveSeconds: 0,
      persistedSeconds: 8,
    });
    expect(afterStopReset).toBe(8);

    expect(
      displayedVoiceSeconds({
        isRecording: false,
        liveSeconds: 0,
        persistedSeconds: 8,
        hasUri: true,
      }),
    ).toBe(8);
    expect(
      displayedVoiceSeconds({
        isRecording: false,
        liveSeconds: 0,
        persistedSeconds: 8,
        hasUri: false,
      }),
    ).toBe(0);
  });

  it('plays and discards the local take from the audio module', () => {
    expect(audioSrc).toContain('useAudioRecorderState(recorder, VOICE_RECORDER_POLL_MS)');
    expect(audioSrc).toContain('createAudioPlayer(uri)');
    expect(audioSrc).toContain('discardVoice');
    expect(audioSrc).toContain('playVoice');
    expect(audioSrc).toContain('dir="ltr"');
    expect(audioSrc).toContain('DealerBoard');
    expect(audioSrc).toContain('releaseLocalAudioPlayer');
    expect(audioSrc).toContain('nextPersistedVoiceSeconds');
  });

  it('does not import expo-audio at the guard module top level', () => {
    expect(guardSrc).not.toMatch(/from ['"]expo-audio['"]/);
    expect(guardSrc).toMatch(/requireOptionalNativeModule/);
    expect(guardSrc).toContain('voiceUnavailable');
  });
});
