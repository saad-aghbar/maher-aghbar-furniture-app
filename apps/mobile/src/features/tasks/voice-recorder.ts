export const VOICE_MAX_SECONDS = 120;
export const VOICE_RECORDER_POLL_MS = 250;

export function voiceSecondsFromMillis(durationMillis: number | null | undefined): number {
  return Math.min(VOICE_MAX_SECONDS, Math.max(0, Math.round((durationMillis ?? 0) / 1000)));
}

export function formatVoiceClock(totalSeconds: number): string {
  const seconds = Math.min(VOICE_MAX_SECONDS, Math.max(0, Math.round(totalSeconds)));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Keep the last live tick so the clock does not snap to 00:00 when recording stops. */
export function nextPersistedVoiceSeconds(args: {
  isRecording: boolean;
  liveSeconds: number;
  persistedSeconds: number;
}): number {
  if (args.isRecording && args.liveSeconds > 0) return args.liveSeconds;
  return args.persistedSeconds;
}

export function displayedVoiceSeconds(args: {
  isRecording: boolean;
  liveSeconds: number;
  persistedSeconds: number;
  hasUri: boolean;
}): number {
  if (args.isRecording) {
    return args.liveSeconds > 0 ? args.liveSeconds : args.persistedSeconds;
  }
  if (args.hasUri) return args.persistedSeconds;
  return 0;
}

export function releaseLocalAudioPlayer(player: {
  pause?: () => void;
  remove?: () => void;
  release?: () => void;
} | null): void {
  if (!player) return;
  try {
    player.pause?.();
  } catch {
    /* already stopped */
  }
  try {
    player.remove?.();
  } catch {
    /* ignore */
  }
  try {
    player.release?.();
  } catch {
    /* ignore */
  }
}
