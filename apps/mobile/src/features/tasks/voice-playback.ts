import { formatVoiceClock } from './voice-recorder';

export type VoicePlaybackStatusInput = {
  playing: boolean;
  didJustFinish?: boolean;
};

export type VoicePlaybackPhase = 'idle' | 'loading' | 'playing' | 'paused';

export function voiceCacheFileName(documentId: string): string {
  const safe = documentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'voice';
  return `maher-voice-${safe}.m4a`;
}

export function voiceClockLabel(currentTime: number, duration: number): string {
  return `${formatVoiceClock(currentTime)} / ${formatVoiceClock(duration)}`;
}

export function voicePlaybackState(
  status: VoicePlaybackStatusInput | null | undefined,
  hasSource: boolean,
  loading: boolean,
): VoicePlaybackPhase {
  if (loading) return 'loading';
  if (status?.playing && !status.didJustFinish) return 'playing';
  if (hasSource) return 'paused';
  return 'idle';
}
