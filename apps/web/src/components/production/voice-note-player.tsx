'use client';

import { API_URL, apiFetch } from '@/lib/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function VoiceNotePlayer({
  documentId,
  label,
}: {
  documentId?: string | null;
  label: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  const release = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audioRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    setFailed(false);
    return () => release();
  }, [documentId, release]);

  if (!documentId) return null;
  const id = documentId;

  async function toggle() {
    if (busy) return;
    setFailed(false);
    try {
      if (audioRef.current && playing) {
        audioRef.current.pause();
        setPlaying(false);
        return;
      }
      if (audioRef.current && !playing) {
        await audioRef.current.play();
        setPlaying(true);
        return;
      }
      setBusy(true);
      const link = await apiFetch<{ downloadPath: string }>(
        `/api/v1/uploads/documents/${encodeURIComponent(id)}/link`,
      );
      const res = await fetch(`${API_URL}${link.downloadPath}`);
      if (!res.ok) throw new Error(`Voice download failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      audio.addEventListener('timeupdate', () => {
        setCurrent(audio.currentTime);
        if (audio.duration && Number.isFinite(audio.duration)) setDuration(audio.duration);
      });
      audio.addEventListener('ended', () => {
        audio.currentTime = 0;
        setPlaying(false);
        setCurrent(0);
      });
      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && Number.isFinite(audio.duration)) setDuration(audio.duration);
      });
      await audio.play();
      setPlaying(true);
    } catch {
      release();
      setPlaying(false);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const clock = `${formatClock(current)} / ${formatClock(duration)}`;
  const action = busy ? '…' : playing ? '❚❚' : '▶';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm text-[var(--maher-text-primary)] hover:border-[var(--maher-brand)] disabled:opacity-60 ${
          failed
            ? 'border-[var(--maher-error)] bg-[var(--maher-error-soft)]'
            : 'border-[var(--maher-border-strong)] bg-[var(--maher-surface-muted)]'
        }`}
      >
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] text-[var(--maher-brand)]"
          aria-hidden
        >
          {action}
        </span>
        <span>{label}</span>
        <span className="text-[var(--maher-text-tertiary)]" dir="ltr">
          {clock}
        </span>
      </button>
    </div>
  );
}
