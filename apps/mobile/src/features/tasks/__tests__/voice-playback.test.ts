import {
  voiceCacheFileName,
  voiceClockLabel,
  voicePlaybackState,
} from '../voice-playback';

describe('voice-playback', () => {
  it('names a cache file from the document id', () => {
    expect(voiceCacheFileName('abc-123')).toBe('maher-voice-abc-123.m4a');
    expect(voiceCacheFileName('../weird id!!')).toBe('maher-voice-weirdid.m4a');
    expect(voiceCacheFileName('!!!')).toBe('maher-voice-voice.m4a');
  });

  it('formats elapsed over duration', () => {
    expect(voiceClockLabel(0, 0)).toBe('00:00 / 00:00');
    expect(voiceClockLabel(5.4, 65)).toBe('00:05 / 01:05');
  });

  it('maps loading, playing, paused, and idle', () => {
    expect(voicePlaybackState({ playing: false }, false, true)).toBe('loading');
    expect(voicePlaybackState({ playing: true }, true, false)).toBe('playing');
    expect(voicePlaybackState({ playing: true, didJustFinish: true }, true, false)).toBe(
      'paused',
    );
    expect(voicePlaybackState({ playing: false }, true, false)).toBe('paused');
    expect(voicePlaybackState(null, false, false)).toBe('idle');
  });
});
