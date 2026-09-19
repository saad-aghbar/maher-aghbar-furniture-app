'use client';

type Props = {
  src?: string | null;
  size?: number;
  alt?: string;
  className?: string;
};

/** Compact SKU photo. Layout may follow RTL; the photograph is never mirrored. */
export function InventoryItemThumb({ src, size = 36, alt = '', className }: Props) {
  const uri = src?.trim() || null;
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-lg border border-border bg-[var(--maher-surface-muted)] ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      {uri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={uri} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="m-auto px-0.5 text-center text-[9px] leading-tight text-text-tertiary">
          —
        </span>
      )}
    </span>
  );
}
