'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';
import { Ltr } from '../Ltr';
import { useCanPortal, useEscape, usePresence, useScrollLock } from '../overlay/use-presence';
import {
  applyUsbWedgeChar,
  BARCODE_FORMATS,
  emptyUsbWedge,
  isScanWorthy,
  normalizeScanCode,
} from './barcode-formats';
import { DEFAULT_DESK_COPY, type DeskCopy } from './desk-copy';

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

type ZxingReader = {
  decodeFromVideoElement: (
    video: HTMLVideoElement,
    cb: (result: { getText: () => string } | undefined) => void,
  ) => Promise<{ stop: () => void }>;
};

async function loadZxing(): Promise<ZxingReader | null> {
  try {
    const mod = (await import('@zxing/browser')) as unknown as {
      BrowserMultiFormatReader: new () => ZxingReader;
    };
    return new mod.BrowserMultiFormatReader();
  } catch {
    return null;
  }
}

export interface CodeScannerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (code: string) => void;
  title?: string;
  hint?: string;
  copy?: Partial<DeskCopy>;
}

const INK = '#1e1a1b';
const CREAM = '#f5f1ea';
const CREAM_MUTED = 'rgba(245, 241, 234, 0.72)';

/**
 * CodeScanner — full-bleed ink camera (port of mobile CodeScannerScreen):
 * 248px viewfinder with brand corners and a scan line, torch chip, paper
 * result card, Use code / Rescan. Detects with BarcodeDetector, falls back to
 * ZXing, still accepts typed codes and USB wedge scanners.
 */
export function CodeScanner({ open, onClose, onConfirm, title, hint, copy }: CodeScannerProps) {
  const labels = { ...DEFAULT_DESK_COPY, ...copy };
  const canPortal = useCanPortal();
  const { mounted, closing } = usePresence(open, 160);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wedgeRef = useRef(emptyUsbWedge());
  const typedRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [scanned, setScanned] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<'starting' | 'live' | 'denied' | 'none'>('starting');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [manual, setManual] = useState(false);

  useScrollLock(mounted);
  useEscape(open, onClose);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setTyped('');
      setScanned(null);
      setManual(false);
      setCameraState('starting');
      return undefined;
    }

    let cancelled = false;
    let zxingStop: (() => void) | null = null;
    const Detector = getBarcodeDetector();

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('none');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchAvailable(Boolean(caps?.torch));
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setCameraState('live');
        if (!Detector && video) {
          const reader = await loadZxing();
          if (reader && !cancelled) {
            const controls = await reader.decodeFromVideoElement(video, (result) => {
              const raw = normalizeScanCode(result?.getText?.() ?? '');
              if (isScanWorthy(raw)) setScanned((prev) => prev ?? raw);
            });
            zxingStop = () => controls.stop();
          }
        }
      } catch {
        if (!cancelled) setCameraState('denied');
      }
    }

    void start();

    let raf = 0;
    const detector = Detector ? new Detector({ formats: [...BARCODE_FORMATS] }) : null;
    let busy = false;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!busy && detector && video && canvas && video.readyState >= 2 && video.videoWidth) {
        busy = true;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          try {
            const codes = await detector.detect(canvas);
            const raw = normalizeScanCode(codes[0]?.rawValue ?? '');
            if (isScanWorthy(raw)) setScanned((prev) => prev ?? raw);
          } catch {
            /* frame miss */
          }
        }
        busy = false;
      }
      raf = requestAnimationFrame(() => void tick());
    };
    raf = requestAnimationFrame(() => void tick());

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      zxingStop?.();
      stopStream();
    };
  }, [open, stopStream]);

  // USB wedge scanners type fast and end with Enter.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.target === typedRef.current) return;
      const next = applyUsbWedgeChar(wedgeRef.current, e.key, Date.now());
      wedgeRef.current = next.state;
      if (next.complete) {
        e.preventDefault();
        setScanned(next.complete);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch {
      setTorchAvailable(false);
    }
  }

  function confirm(code: string) {
    const normalized = normalizeScanCode(code);
    if (!isScanWorthy(normalized)) return;
    onConfirm(normalized);
    onClose();
  }

  if (!mounted || !canPortal) return null;

  const heading = title ?? labels.scanTitle;
  const sub = hint ?? labels.scanHint;
  const showCamera = cameraState === 'live' || cameraState === 'starting';
  const chip = 'maher-press inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className={cn('fixed inset-0 z-[1400] flex flex-col overflow-hidden', closing ? 'maher-animate-fade-out' : 'maher-animate-fade')}
      style={{ background: INK, color: CREAM }}
    >
      {showCamera ? (
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />
      ) : null}
      <canvas ref={canvasRef} className="hidden" />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(28,25,23,0.15) 0%, rgba(28,25,23,0.72) 100%)' }} />

      <div className="relative z-10 flex h-full flex-col justify-between px-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-[calc(16px+env(safe-area-inset-top,0px))]">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className={chip} style={{ background: 'rgba(28,25,23,0.72)', borderColor: 'rgba(245,240,232,0.22)', color: CREAM }}>
            {labels.cancel}
          </button>
          {cameraState === 'live' && !scanned && torchAvailable ? (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              aria-pressed={torchOn}
              className={chip}
              style={
                torchOn
                  ? { background: 'var(--maher-brand)', borderColor: 'var(--maher-brand)', color: '#fff' }
                  : { background: 'rgba(28,25,23,0.72)', borderColor: 'rgba(245,240,232,0.22)', color: CREAM }
              }
            >
              {torchOn ? labels.scanTorchOn : labels.scanTorchOff}
            </button>
          ) : (
            <span className="w-[72px]" />
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <h2 className="text-center text-[26px] font-semibold leading-8 tracking-[0.01em] rtl:tracking-normal" style={{ color: CREAM }}>
            {heading}
          </h2>

          {!scanned ? (
            <>
              <p className="mt-2 max-w-[38ch] text-center text-[14px] leading-5" style={{ color: CREAM_MUTED }}>
                {cameraState === 'denied' ? labels.scanPermission : cameraState === 'none' ? labels.scanNoCamera : sub}
              </p>

              {cameraState === 'live' ? (
                <div className="mt-7 flex flex-col items-center">
                  <div className="relative h-[248px] w-[248px] overflow-hidden rounded-[20px] border" style={{ borderColor: 'rgba(245,241,234,0.5)' }} aria-hidden>
                    {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                      <span
                        key={corner}
                        className={cn(
                          'absolute h-7 w-7 border-[var(--maher-brand)]',
                          corner === 'tl' && 'left-2.5 top-2.5 border-l-[3px] border-t-[3px] rounded-tl-[6px]',
                          corner === 'tr' && 'right-2.5 top-2.5 border-r-[3px] border-t-[3px] rounded-tr-[6px]',
                          corner === 'bl' && 'bottom-2.5 left-2.5 border-b-[3px] border-l-[3px] rounded-bl-[6px]',
                          corner === 'br' && 'bottom-2.5 right-2.5 border-b-[3px] border-r-[3px] rounded-br-[6px]',
                        )}
                      />
                    ))}
                    <span className="maher-scan__line absolute inset-x-6 top-1/2 h-0.5 rounded-full bg-[var(--maher-brand)]" />
                  </div>
                  <p className="mt-4 text-center text-[12px]" style={{ color: CREAM_MUTED }}>
                    {labels.scanHint}
                  </p>
                </div>
              ) : cameraState === 'starting' ? (
                <div className="mt-7 h-[248px] w-[248px] animate-pulse rounded-[20px]" style={{ background: 'rgba(245,241,234,0.06)' }} aria-hidden />
              ) : null}

              {manual || cameraState === 'denied' || cameraState === 'none' ? (
                <form
                  className="mt-6 w-full max-w-[340px] overflow-hidden rounded-[18px] border"
                  style={{ background: CREAM, borderColor: 'var(--maher-brand)' }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const code = normalizeScanCode(typed);
                    if (isScanWorthy(code)) setScanned(code);
                  }}
                >
                  <div className="border-b px-4 py-2 text-center text-[12px] font-medium" style={{ color: INK, borderColor: 'rgba(30,26,27,0.12)', background: 'rgba(245,241,234,0.65)' }}>
                    {labels.scanTypedLabel}
                  </div>
                  <div className="flex flex-col gap-2.5 p-4">
                    <input
                      ref={typedRef}
                      dir="ltr"
                      autoFocus
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="off"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      className="h-11 w-full rounded-[12px] border px-3.5 text-[15px] font-medium tabular-nums outline-none focus:ring-2 focus:ring-[var(--maher-brand)]/30"
                      style={{ color: INK, background: CREAM, borderColor: 'rgba(30,26,27,0.18)' }}
                      aria-label={labels.scanTypedLabel}
                    />
                    <button type="submit" disabled={!isScanWorthy(normalizeScanCode(typed))} className="maher-press h-11 rounded-full bg-[var(--maher-brand)] text-[14px] font-semibold text-white disabled:opacity-40">
                      {labels.scanConfirm}
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => setManual(true)} className="maher-press mt-6 text-[13px] font-medium underline-offset-4 hover:underline" style={{ color: CREAM_MUTED }}>
                  {labels.scanTypedLabel}
                </button>
              )}
            </>
          ) : (
            <div className="mt-7 w-full max-w-[340px] rounded-[20px] border px-5 py-5 text-center" style={{ background: CREAM, borderColor: 'var(--maher-brand)' }}>
              <p className="text-[12px]" style={{ color: 'rgba(30,26,27,0.6)' }}>
                {labels.scanTypedLabel}
              </p>
              <Ltr block wrap className="mt-1 break-all text-[20px] font-semibold" style={{ color: INK }}>
                {scanned}
              </Ltr>
            </div>
          )}
        </div>

        {scanned ? (
          <div className="mx-auto flex w-full max-w-[340px] flex-col gap-2">
            <button type="button" onClick={() => confirm(scanned)} className="maher-press h-12 rounded-full bg-[var(--maher-brand)] text-[15px] font-semibold text-white">
              {labels.scanConfirm}
            </button>
            <button
              type="button"
              onClick={() => {
                setScanned(null);
                setTyped('');
              }}
              className="maher-press h-12 rounded-full border text-[15px] font-semibold"
              style={{ borderColor: 'rgba(245,241,234,0.3)', color: CREAM }}
            >
              {labels.scanRescan}
            </button>
          </div>
        ) : (
          <div className="h-12" />
        )}
      </div>
    </div>,
    document.body,
  );
}
