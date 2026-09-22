'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../Button';
import { cn } from '../cn';
import { BRAND_LOGO_LOCKUP_DARK_URI, BRAND_LOGO_LOCKUP_LIGHT_URI } from '../brand-logo-data';
import { DateRangeField } from '../DateRangeField';
import { SegmentedControl } from '../form/SegmentedControl';
import { Sheet } from '../overlay/Sheet';
import type { PdfLang, PdfOptions, PdfTheme } from './pdf-query';

export interface PdfDownloadCopy {
  title?: string;
  description?: string;
  language?: string;
  theme?: string;
  white?: string;
  brown?: string;
  range?: string;
  rangeHint?: string;
  download?: string;
  open?: string;
  cancel?: string;
  languages?: Partial<Record<PdfLang, string>>;
}

export interface PdfDownloadDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen options; `mode` tells whether to save or open in a tab. */
  onConfirm: (opts: PdfOptions, mode: 'download' | 'open') => void | Promise<void>;
  defaultLang?: PdfLang;
  defaultTheme?: PdfTheme;
  /** Show a date range (statements, reports). */
  withRange?: boolean;
  defaultRange?: { from: string; to: string };
  /** Document name for the title (e.g. "Invoice INV-2026-00002"). */
  documentName?: ReactNode;
  busy?: boolean;
  copy?: PdfDownloadCopy;
  locale?: string;
  /** Extra controls between theme and footer (e.g. report sections). */
  children?: ReactNode;
}

const LANGS: PdfLang[] = ['en', 'ar', 'he'];
const LANG_LABEL: Record<PdfLang, string> = { en: 'English', ar: 'العربية', he: 'עברית' };

/**
 * PdfDownloadDialog — port of mobile's PdfDownloadSheet. Language segmented,
 * white / brown paper tiles with the lockup preview, optional range, Download or Open.
 */
export function PdfDownloadDialog({
  open,
  onClose,
  onConfirm,
  defaultLang = 'en',
  defaultTheme = 'white',
  withRange,
  defaultRange,
  documentName,
  busy,
  copy,
  locale,
  children,
}: PdfDownloadDialogProps) {
  const [lang, setLang] = useState<PdfLang>(defaultLang);
  const [theme, setTheme] = useState<PdfTheme>(defaultTheme);
  const [range, setRange] = useState(defaultRange ?? { from: '', to: '' });

  useEffect(() => {
    if (open) {
      setLang(defaultLang);
      setTheme(defaultTheme);
      setRange(defaultRange ?? { from: '', to: '' });
    }
  }, [open, defaultLang, defaultTheme, defaultRange]);

  const options = (): PdfOptions => ({ lang, theme, from: withRange ? range.from || undefined : undefined, to: withRange ? range.to || undefined : undefined });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={copy?.title ?? 'Download PDF'}
      description={documentName ?? copy?.description}
      closeLabel={copy?.cancel}
      widthClassName="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {copy?.cancel ?? 'Cancel'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void onConfirm(options(), 'open')}>
            {copy?.open ?? 'Open'}
          </Button>
          <Button loading={busy} onClick={() => void onConfirm(options(), 'download')}>
            {copy?.download ?? 'Download'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-[var(--maher-text-primary)]">{copy?.language ?? 'Language'}</h3>
          <SegmentedControl
            fill
            value={lang}
            onChange={setLang}
            options={LANGS.map((l) => ({ value: l, label: copy?.languages?.[l] ?? LANG_LABEL[l] }))}
            aria-label={copy?.language ?? 'Language'}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold text-[var(--maher-text-primary)]">{copy?.theme ?? 'Paper'}</h3>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={copy?.theme ?? 'Paper'}>
            {(['white', 'brown'] as PdfTheme[]).map((t) => {
              const selected = theme === t;
              const dark = t === 'brown';
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(t)}
                  className={cn(
                    'maher-press relative flex flex-col overflow-hidden rounded-[14px] border text-start transition-[border-color,box-shadow]',
                    selected ? 'border-[var(--maher-brand)] shadow-[0_0_0_3px_var(--maher-brand-soft)]' : 'border-[var(--maher-border)] hover:border-[var(--maher-border-strong)]',
                  )}
                >
                  <span
                    className="relative block aspect-[1.414/1] w-full overflow-hidden"
                    style={{ background: dark ? '#2A1E17' : '#F7F3EC' }}
                    aria-hidden
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={dark ? BRAND_LOGO_LOCKUP_DARK_URI : BRAND_LOGO_LOCKUP_LIGHT_URI} alt="" className="absolute start-3 top-3 h-auto w-[38%] opacity-90" />
                    <span className="absolute inset-x-3 top-[46%] h-[3px] rounded-full" style={{ background: dark ? 'rgba(245,241,234,0.5)' : 'rgba(30,26,27,0.6)' }} />
                    <span className="absolute inset-x-3 top-[58%] h-[2px] rounded-full" style={{ background: dark ? 'rgba(245,241,234,0.22)' : 'rgba(30,26,27,0.18)' }} />
                    <span className="absolute inset-x-3 top-[66%] h-[2px] rounded-full" style={{ background: dark ? 'rgba(245,241,234,0.22)' : 'rgba(30,26,27,0.18)' }} />
                    <span className="absolute start-3 end-[40%] top-[74%] h-[2px] rounded-full" style={{ background: dark ? 'rgba(245,241,234,0.22)' : 'rgba(30,26,27,0.18)' }} />
                    <span className="absolute inset-x-3 bottom-2.5 h-px" style={{ background: dark ? 'rgba(245,241,234,0.25)' : 'rgba(30,26,27,0.15)' }} />
                  </span>
                  <span className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] font-medium text-[var(--maher-text-primary)]">
                    {t === 'white' ? copy?.white ?? 'White' : copy?.brown ?? 'Brown'}
                    {selected ? (
                      <svg viewBox="0 0 20 20" className="h-4 w-4 text-[var(--maher-brand)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 10.5 3 3 7-7" />
                      </svg>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {withRange ? (
          <section className="flex flex-col gap-2">
            <DateRangeField
              label={copy?.range ?? 'Range'}
              hint={copy?.rangeHint ?? 'Leave empty for the full statement.'}
              from={range.from}
              to={range.to}
              onChange={setRange}
              locale={locale}
              presets={['month', 'last30', 'last90', 'ytd']}
            />
          </section>
        ) : null}

        {children}
      </div>
    </Sheet>
  );
}
