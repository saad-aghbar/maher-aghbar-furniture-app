'use client';

import { useId, useRef, useState, type ChangeEvent } from 'react';
import { cn } from './cn';
import { Button } from './Button';
import { Input } from './Input';

export interface PhotoAttachFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  accept?: string;
  urlPlaceholder?: string;
  uploadLabel?: string;
  uploadingLabel?: string;
  attachUrlLabel?: string;
  /** Upload a local file (device). */
  onUploadFile?: (file: File) => Promise<void>;
  /** Attach by remote URL (server fetches). */
  onAttachUrl?: (url: string) => Promise<void>;
}

/**
 * Dual photo/file attach control: paste a URL and/or pick a file from the device.
 * Parent handles persistence (upload APIs). Does not keep a lasting value field.
 */
export function PhotoAttachField({
  label,
  hint,
  error,
  disabled,
  className,
  accept = 'image/jpeg,image/png,image/webp,image/heic',
  urlPlaceholder = 'https://…',
  uploadLabel = 'Upload from device',
  uploadingLabel = 'Uploading…',
  attachUrlLabel = 'Attach from URL',
  onUploadFile,
  onAttachUrl,
}: PhotoAttachFieldProps) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const displayError = error ?? localError ?? undefined;

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

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file || !onUploadFile) return;
    await run(() => onUploadFile(file));
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
              label={undefined}
              value={url}
              onChange={(e) => {
                setLocalError(null);
                setUrl(e.target.value);
              }}
              placeholder={urlPlaceholder}
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
            onClick={() => void run(() => onAttachUrl(url.trim()))}
          >
            {busy ? uploadingLabel : attachUrlLabel}
          </Button>
        </div>
      ) : null}
      {onUploadFile ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => void handleFile(e)}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={busy}
            disabled={disabled || busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? uploadingLabel : uploadLabel}
          </Button>
        </div>
      ) : null}
      {hint && !displayError ? (
        <p className="text-xs text-[var(--maher-text-secondary)]">{hint}</p>
      ) : null}
      {displayError ? (
        <p role="alert" className="text-xs text-[var(--maher-error)]">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
