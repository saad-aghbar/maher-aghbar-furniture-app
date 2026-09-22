'use client';

import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { cn } from '../cn';
import { Ltr } from '../Ltr';

export interface AttachmentItem {
  id: string;
  name: string;
  /** Opens in a new tab / downloads. */
  url?: string | null;
  thumbUrl?: string | null;
  mime?: string | null;
  size?: number | null;
  /** Upload progress 0–100 while pending. */
  progress?: number | null;
  error?: string | null;
}

export interface AttachmentsCopy {
  drop?: string;
  browse?: string;
  remove?: string;
  open?: string;
  uploading?: string;
}

export interface AttachmentsProps {
  items: AttachmentItem[];
  onAdd?: (files: File[]) => void;
  onRemove?: (item: AttachmentItem) => void;
  onOpen?: (item: AttachmentItem) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  copy?: AttachmentsCopy;
  /** Extra actions in the drop zone (Take photo, Attach from URL). */
  extraActions?: ReactNode;
  className?: string;
}

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(item: AttachmentItem) {
  return Boolean(item.thumbUrl) || Boolean(item.mime?.startsWith('image/'));
}

function isPdf(item: AttachmentItem) {
  return item.mime === 'application/pdf' || /\.pdf$/i.test(item.name);
}

/**
 * Attachments — drop zone + thumb grid + document chips. Upload itself
 * happens in the app (uploads API); this only collects files and shows state.
 */
export function Attachments({ items, onAdd, onRemove, onOpen, accept, multiple = true, disabled, copy, extraActions, className }: AttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const canAdd = Boolean(onAdd) && !disabled;

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setActive(false);
    if (!canAdd) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onAdd?.(multiple ? files : files.slice(0, 1));
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {items.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3 p-0">
          {items.map((item) => {
            const image = isImage(item);
            const body = (
              <>
                <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[12px] border border-[var(--maher-border)] bg-[var(--maher-surface-muted)]">
                  {image && (item.thumbUrl || item.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbUrl ?? item.url ?? ''} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-[var(--maher-text-tertiary)]">
                      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                        <path d="M14 3v5h5" />
                      </svg>
                      <span className="text-[10px] font-semibold uppercase tracking-wide">{isPdf(item) ? 'PDF' : (item.name.split('.').pop() ?? '').slice(0, 4)}</span>
                    </span>
                  )}
                  {item.progress != null && item.progress < 100 ? (
                    <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-[rgba(30,26,27,0.2)]">
                      <span className="block h-full rounded-full bg-[var(--maher-brand)] transition-[width]" style={{ width: `${item.progress}%` }} />
                    </span>
                  ) : null}
                </span>
                <span className="mt-1.5 block truncate text-[12px] leading-4 text-[var(--maher-text-primary)]" title={item.name}>
                  {item.name}
                </span>
                {item.error ? (
                  <span className="block text-[11px] text-[var(--maher-error)]">{item.error}</span>
                ) : item.size ? (
                  <Ltr className="block text-[11px] text-[var(--maher-text-tertiary)]">{formatSize(item.size)}</Ltr>
                ) : null}
              </>
            );
            return (
              <li key={item.id} className="group/att relative min-w-0">
                {item.url || onOpen ? (
                  <a
                    href={item.url ?? undefined}
                    target={item.url ? '_blank' : undefined}
                    rel={item.url ? 'noreferrer' : undefined}
                    onClick={(e) => {
                      if (onOpen) {
                        e.preventDefault();
                        onOpen(item);
                      }
                    }}
                    className="maher-press block rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--maher-brand)]/40"
                    aria-label={`${copy?.open ?? 'Open'} ${item.name}`}
                  >
                    {body}
                  </a>
                ) : (
                  <div>{body}</div>
                )}
                {onRemove && !disabled ? (
                  <button
                    type="button"
                    aria-label={`${copy?.remove ?? 'Remove'} ${item.name}`}
                    onClick={() => onRemove(item)}
                    className="maher-press absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--maher-border)] bg-[var(--maher-surface)] text-[var(--maher-text-secondary)] shadow-[var(--maher-shadow-sm)] opacity-0 transition-opacity hover:text-[var(--maher-error)] focus-visible:opacity-100 group-hover/att:opacity-100"
                  >
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {canAdd ? (
        <div
          role="button"
          tabIndex={0}
          data-active={active || undefined}
          className="maher-dropzone flex flex-wrap items-center justify-between gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--maher-brand)]/40"
          onDragOver={(e) => {
            e.preventDefault();
            setActive(true);
          }}
          onDragLeave={() => setActive(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <span className="flex items-center gap-2.5 text-[13px] text-[var(--maher-text-secondary)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--maher-brand)]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 16V5m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
            {copy?.drop ?? 'Drop files here, or'}
            <span className="font-semibold text-[var(--maher-brand)]">{copy?.browse ?? 'browse'}</span>
          </span>
          {extraActions ? (
            <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {extraActions}
            </span>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onAdd?.(files);
              e.target.value = '';
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
