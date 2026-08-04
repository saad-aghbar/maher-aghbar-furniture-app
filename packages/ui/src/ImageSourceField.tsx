'use client';

import { useId, useRef, useState, type ChangeEvent } from 'react';
import { cn } from './cn';
import { Button } from './Button';
import { Input } from './Input';

export interface ImageSourceFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
  /** When provided, shows a device upload control that fills `value` with the returned URL/key. */
  onUploadFile?: (file: File) => Promise<string>;
  uploadLabel?: string;
  uploadingLabel?: string;
  urlPlaceholder?: string;
  accept?: string;
  showPreview?: boolean;
  className?: string;
}

export function ImageSourceField({
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
  id,
  onUploadFile,
  uploadLabel = 'Upload from device',
  uploadingLabel = 'Uploading…',
  urlPlaceholder = 'https://…',
  accept = 'image/jpeg,image/png,image/webp,image/heic',
  showPreview = true,
  className,
}: ImageSourceFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const trimmed = value.trim();
  const previewSrc =
    showPreview && trimmed && (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('blob:'))
      ? trimmed
      : null;
  const displayError = error ?? uploadError ?? undefined;

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file || !onUploadFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const next = await onUploadFile(file);
      onChange(next);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Input
        id={fieldId}
        label={label}
        value={value}
        onChange={(e) => {
          setUploadError(null);
          onChange(e.target.value);
        }}
        hint={hint}
        error={displayError}
        disabled={disabled || uploading}
        placeholder={urlPlaceholder}
        dir="ltr"
      />
      {onUploadFile ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="sr-only"
            disabled={disabled || uploading}
            onChange={(e) => void handleFile(e)}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={uploading}
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? uploadingLabel : uploadLabel}
          </Button>
        </div>
      ) : null}
      {previewSrc ? (
        <div className="overflow-hidden rounded-[var(--maher-radius-md)] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt=""
            className="aspect-[5/4] max-h-48 w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
