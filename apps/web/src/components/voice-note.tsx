'use client';

import { Button } from '@maher/ui';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

export function VoiceNote({ onBlob }: { onBlob?: (blob: Blob) => void }) {
  const t = useTranslations('common');
  const [url, setUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    chunks.current = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
      setUrl(URL.createObjectURL(blob));
      onBlob?.(blob);
    };
    rec.start();
    recorder.current = rec;
    setRecording(true);
  }

  function stop() {
    recorder.current?.stop();
    setRecording(false);
  }

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={recording ? stop : start}>
        {recording ? t('cancel') : t('notes')}
      </Button>
      {url ? <audio controls src={url} className="h-9" /> : null}
      <Button type="button" size="sm" variant="ghost" onClick={() => speak(t('notes'))}>
        {t('notes')}
      </Button>
    </div>
  );
}
