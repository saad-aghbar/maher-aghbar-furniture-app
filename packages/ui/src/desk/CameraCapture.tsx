'use client';

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '../Button';
import { cn } from '../cn';
import { Input } from '../Input';
import { Modal } from '../Modal';
import { DEFAULT_DESK_COPY, type DeskCopy } from './desk-copy';

export interface CameraCaptureProps {
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  accept?: string;
  copy?: Partial<DeskCopy>;
  onUploadFile?: (file: File) => Promise<void> | void;
  onAttachUrl?: (url: string) => Promise<void> | void;
}

/**
 * Live camera + file picker + URL attach. Parent persists the file.
 */
export function CameraCapture({
  label,
  hint,
  error,
  disabled,
  className,
  accept = 'image/jpeg,image/png,image/webp,image/heic',
  copy,
  onUploadFile,
  onAttachUrl,
}: CameraCaptureProps) {
  const labels = { ...DEFAULT_DESK_COPY, ...copy };
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const displayError = error ?? localError ?? undefined;

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setLocalError(null);
    try {
      await action();
      setUrl('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function openLive() {
    setLocalError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      fileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => undefined);
        }
      });
    } catch {
      fileRef.current?.click();
    }
  }

  async function snap() {
    const video = videoRef.current;
    if (!video || !onUploadFile) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    stop();
    if (!blob) return;
    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
    await run(() => Promise.resolve(onUploadFile(file)));
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file || !onUploadFile) return;
    await run(() => Promise.resolve(onUploadFile(file)));
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? (
        <p className="text-sm font-medium text-[var(--maher-text-primary)]">{label}</p>
      ) : null}
      {onAttachUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              id={`${id}-url`}
              value={url}
              onChange={(e) => {
                setLocalError(null);
                setUrl(e.target.value);
              }}
              placeholder="https://…"
              disabled={disabled || busy}
              dir="ltr"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={busy}
            disabled={disabled || busy || !url.trim()}
            onClick={() => void run(() => Promise.resolve(onAttachUrl(url.trim())))}
          >
            {labels.cameraUrl}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          capture="environment"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => void handleFile(e)}
        />
        {onUploadFile ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={busy}
              disabled={disabled || busy}
              onClick={() => void openLive()}
            >
              {labels.cameraTitle}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
            >
              {labels.cameraLibrary}
            </Button>
          </>
        ) : null}
      </div>
      {hint && !displayError ? (
        <p className="text-xs text-[var(--maher-text-secondary)]">{hint}</p>
      ) : null}
      {displayError ? (
        <p role="alert" className="text-xs text-[var(--maher-error)]">
          {displayError}
        </p>
      ) : null}

      <Modal
        open={live}
        onClose={stop}
        title={labels.cameraTitle}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={stop}>
              {labels.cancel}
            </Button>
            <Button type="button" onClick={() => void snap()} loading={busy}>
              {labels.cameraSnap}
            </Button>
          </>
        }
      >
        <video ref={videoRef} className="aspect-video w-full rounded-[var(--maher-radius-lg)] bg-[#1e1a1b] object-cover" playsInline muted autoPlay />
      </Modal>
    </div>
  );
}
