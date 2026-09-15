'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Ltr } from '../Ltr';
import { Modal } from '../Modal';
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

export interface CodeScannerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (code: string) => void;
  title?: string;
  hint?: string;
  copy?: Partial<DeskCopy>;
}

export function CodeScanner({
  open,
  onClose,
  onConfirm,
  title,
  hint,
  copy,
}: CodeScannerProps) {
  const labels = { ...DEFAULT_DESK_COPY, ...copy };
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wedgeRef = useRef(emptyUsbWedge());
  const typedRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [scanned, setScanned] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

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
      setCameraError(null);
      return undefined;
    }

    let cancelled = false;
    const Detector = getBarcodeDetector();

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(labels.scanNoCamera);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
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
      } catch {
        if (!cancelled) setCameraError(labels.scanPermission);
      }
    }

    void start();

    let raf = 0;
    const detector = Detector ? new Detector({ formats: [...BARCODE_FORMATS] }) : null;

    const tick = async () => {
      if (cancelled || scanned) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (detector && video && canvas && video.readyState >= 2 && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          try {
            const codes = await detector.detect(canvas);
            const raw = normalizeScanCode(codes[0]?.rawValue ?? '');
            if (isScanWorthy(raw)) setScanned(raw);
          } catch {
            /* detector frame miss */
          }
        }
      }
      raf = requestAnimationFrame(() => {
        void tick();
      });
    };
    raf = requestAnimationFrame(() => {
      void tick();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopStream();
    };
  }, [open, scanned, stopStream, labels.scanNoCamera, labels.scanPermission]);

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
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn((v) => !v);
    } catch {
      setTorchAvailable(false);
    }
  }

  const heading = title ?? labels.scanTitle;
  const sub = hint ?? labels.scanHint;
  const preview = scanned ?? typed.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={heading}
      description={sub}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {labels.cancel}
          </Button>
          {scanned ? (
            <Button type="button" variant="secondary" onClick={() => setScanned(null)}>
              {labels.scanRescan}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={!isScanWorthy(preview)}
            onClick={() => {
              const code = normalizeScanCode(preview);
              if (!isScanWorthy(code)) return;
              onConfirm(code);
              onClose();
            }}
          >
            {labels.scanConfirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-[var(--maher-radius-xl)] border border-[var(--maher-border)] bg-[#1e1a1b]">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-[#1e1a1b] object-cover"
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} className="hidden" />
          {cameraError ? (
            <p className="absolute inset-x-0 bottom-0 bg-black/55 px-4 py-3 text-center text-sm text-[#f5f1ea]">
              {cameraError}
            </p>
          ) : null}
          {torchAvailable ? (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              className="absolute end-3 top-3 rounded-full bg-black/45 px-3 py-1.5 text-xs text-[#f5f1ea]"
            >
              {torchOn ? labels.scanTorchOn : labels.scanTorchOff}
            </button>
          ) : null}
        </div>
        {scanned ? (
          <p className="text-sm text-[var(--maher-text-primary)]">
            <Ltr className="font-medium">{scanned}</Ltr>
          </p>
        ) : (
          <Input
            ref={typedRef}
            label={labels.scanTypedLabel}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            dir="ltr"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        )}
      </div>
    </Modal>
  );
}
