import { useEffect, useState } from 'react';

/**
 * Live elapsed seconds = closed actualSeconds + open segment since openStartedAt.
 * Ticks every 1s while running; freezes at exact closed seconds when stopped.
 */
export function useLiveTaskTimer(
  openStartedAt: string | null | undefined,
  closedSeconds: number,
  running: boolean,
): { elapsedSeconds: number; elapsedMinutes: number } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running || !openStartedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running, openStartedAt]);

  const closed = Math.max(0, Math.floor(closedSeconds));
  let openSeconds = 0;
  if (running && openStartedAt) {
    const start = new Date(openStartedAt).getTime();
    if (!Number.isNaN(start)) {
      openSeconds = Math.max(0, Math.floor((now - start) / 1000));
    }
  }
  const elapsedSeconds = closed + openSeconds;
  return {
    elapsedSeconds,
    elapsedMinutes: Math.floor(elapsedSeconds / 60),
  };
}
