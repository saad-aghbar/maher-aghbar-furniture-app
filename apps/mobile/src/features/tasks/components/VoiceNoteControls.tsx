import { lazy, Suspense, type ReactNode } from 'react';
import { requireOptionalNativeModule } from 'expo';
import { AppText } from '@/components/AppText';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';

function hasNativeExpoAudio(): boolean {
  return requireOptionalNativeModule('ExpoAudio') != null;
}

const AudioPlayback = lazy(() =>
  import('./VoiceNoteControls.audio').then((m) => ({ default: m.VoicePlaybackButton })),
);
const AudioRecorder = lazy(() =>
  import('./VoiceNoteControls.audio').then((m) => ({ default: m.VoiceRecorderBar })),
);

export function VoicePlaybackButton({
  documentId,
}: {
  documentId?: string | null;
}) {
  if (!hasNativeExpoAudio() || !documentId) return null;
  return (
    <Suspense fallback={null}>
      <AudioPlayback documentId={documentId} />
    </Suspense>
  );
}

function VoiceBoardFallback({
  titleWeight,
  children,
}: {
  titleWeight: 'medium' | 'semibold';
  children?: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <DealerBoard title={t('mobile.tasks.voiceNoteTitle')} titleWeight={titleWeight}>
      {children}
    </DealerBoard>
  );
}

export function VoiceRecorderBar({
  uri,
  onUri,
}: {
  uri: string | null;
  onUri: (next: string | null) => void;
}) {
  const { t, locale } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  if (!hasNativeExpoAudio()) {
    return (
      <VoiceBoardFallback titleWeight={titleWeight}>
        <AppText variant="caption" color="muted">
          {t('mobile.tasks.voiceUnavailable')}
        </AppText>
      </VoiceBoardFallback>
    );
  }
  return (
    <Suspense fallback={<VoiceBoardFallback titleWeight={titleWeight} />}>
      <AudioRecorder uri={uri} onUri={onUri} />
    </Suspense>
  );
}
