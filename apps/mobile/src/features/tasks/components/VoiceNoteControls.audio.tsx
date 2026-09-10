import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { resolveDocumentUrl } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { useToast } from '@/components/feedback/Toast';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { voiceUploadToastMessage } from '../report-problem-sheet';
import {
  voiceCacheFileName,
  voiceClockLabel,
  voicePlaybackState,
} from '../voice-playback';
import {
  VOICE_MAX_SECONDS,
  VOICE_RECORDER_POLL_MS,
  displayedVoiceSeconds,
  formatVoiceClock,
  nextPersistedVoiceSeconds,
  releaseLocalAudioPlayer,
  voiceSecondsFromMillis,
} from '../voice-recorder';

async function localVoiceUri(documentId: string, remoteUrl: string): Promise<string> {
  const file = new File(Paths.cache, voiceCacheFileName(documentId));
  if (file.exists && file.size > 0) return file.uri;
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Voice download failed (${res.status})`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.byteLength === 0) throw new Error('Voice download empty');
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

export function VoicePlaybackButton({
  documentId,
}: {
  documentId?: string | null;
}) {
  const { t, isRTL } = useLocale();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [loading, setLoading] = useState(false);
  const [cachedUri, setCachedUri] = useState<string | null>(null);

  useEffect(() => {
    setCachedUri(null);
  }, [documentId]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    player.pause();
    void player.seekTo(0);
  }, [player, status.didJustFinish]);

  const phase = voicePlaybackState(status, Boolean(cachedUri), loading);
  const label =
    phase === 'loading'
      ? t('mobile.tasks.voiceLoading')
      : phase === 'playing'
        ? t('mobile.tasks.pauseVoice')
        : t('mobile.tasks.playVoice');
  const icon: keyof typeof Ionicons.glyphMap =
    phase === 'loading' ? 'hourglass' : phase === 'playing' ? 'pause' : 'play';
  const playing = phase === 'playing';

  if (!documentId) return null;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      accessibilityLabel={label}
      disabled={loading}
      onPress={() => {
        if (loading) return;
        void (async () => {
          try {
            if (cachedUri && phase === 'playing') {
              player.pause();
              void haptics.selection();
              return;
            }
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            if (cachedUri) {
              player.play();
              void haptics.selection();
              return;
            }
            setLoading(true);
            const remote = await resolveDocumentUrl(documentId);
            const uri = await localVoiceUri(documentId, remote);
            setCachedUri(uri);
            player.replace(uri);
            player.play();
            void haptics.selection();
          } catch (error) {
            void haptics.error();
            showToast({
              variant: 'error',
              message: voiceUploadToastMessage(error, t('mobile.tasks.voicePlayFailed')),
            });
          } finally {
            setLoading(false);
          }
        })();
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        borderWidth: 1.5,
        borderColor: playing ? colors.brand : colors.borderStrong,
        backgroundColor: playing ? colors.brandSoft : colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.sm + 2,
        paddingVertical: 0,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: playing ? colors.brandSoft : colors.surface,
          borderWidth: 1,
          borderColor: playing ? colors.brand : colors.border,
        }}
      >
        <Ionicons name={icon} size={14} color={playing ? colors.brand : colors.textPrimary} />
      </View>
      <AppText
        variant="label"
        weight="medium"
        numberOfLines={1}
        style={{ flex: 1, color: playing ? colors.brand : colors.textPrimary }}
      >
        {label}
      </AppText>
      <AppText variant="caption" color="muted" dir="ltr">
        {voiceClockLabel(status.currentTime ?? 0, status.duration ?? 0)}
      </AppText>
    </AnimatedPressable>
  );
}

function floorVoiceButtonStyle(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    borderRadius: theme.radius.full,
    minHeight: theme.sizes.touch.min,
    paddingVertical: 0,
    flexGrow: 1,
  };
}

export function VoiceRecorderBar({
  uri,
  onUri,
}: {
  uri: string | null;
  onUri: (next: string | null) => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, VOICE_RECORDER_POLL_MS);
  const [persistedSeconds, setPersistedSeconds] = useState(0);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const liveSeconds = voiceSecondsFromMillis(state.durationMillis);
  const clockSeconds = displayedVoiceSeconds({
    isRecording: state.isRecording,
    liveSeconds,
    persistedSeconds,
    hasUri: Boolean(uri),
  });
  const clock = formatVoiceClock(clockSeconds);

  useEffect(() => {
    setPersistedSeconds((prev) =>
      nextPersistedVoiceSeconds({
        isRecording: state.isRecording,
        liveSeconds,
        persistedSeconds: prev,
      }),
    );
  }, [liveSeconds, state.isRecording]);

  useEffect(() => {
    if (state.isRecording && liveSeconds >= VOICE_MAX_SECONDS) {
      void stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSeconds, state.isRecording]);

  useEffect(() => {
    if (uri) return;
    releaseLocalAudioPlayer(playerRef.current);
    playerRef.current = null;
    setPersistedSeconds(0);
  }, [uri]);

  useEffect(() => {
    return () => {
      releaseLocalAudioPlayer(playerRef.current);
      playerRef.current = null;
    };
  }, []);

  async function start() {
    try {
      releaseLocalAudioPlayer(playerRef.current);
      playerRef.current = null;
      onUri(null);
      setPersistedSeconds(0);
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        void haptics.error();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      void haptics.selection();
    } catch {
      void haptics.error();
    }
  }

  async function stop() {
    try {
      const lastLive = Math.max(liveSeconds, persistedSeconds);
      await recorder.stop();
      const afterStop = voiceSecondsFromMillis(state.durationMillis);
      setPersistedSeconds(afterStop > 0 ? afterStop : lastLive);
      onUri(recorder.uri ?? null);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      onUri(null);
      setPersistedSeconds(0);
      void haptics.error();
    }
  }

  async function play() {
    if (!uri) return;
    try {
      releaseLocalAudioPlayer(playerRef.current);
      playerRef.current = null;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const player = createAudioPlayer(uri);
      playerRef.current = player;
      player.play();
      void haptics.selection();
    } catch {
      void haptics.error();
    }
  }

  function discard() {
    releaseLocalAudioPlayer(playerRef.current);
    playerRef.current = null;
    setPersistedSeconds(0);
    onUri(null);
  }

  const buttonStyle = floorVoiceButtonStyle(theme);

  return (
    <DealerBoard
      title={t('mobile.tasks.voiceNoteTitle')}
      titleWeight={titleWeight}
      trailing={
        <AppText variant="label" weight="medium" dir="ltr">
          {clock}
        </AppText>
      }
    >
      <AppText variant="caption" color="muted">
        {t('mobile.tasks.voiceNoteHint')}
      </AppText>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          flexWrap: 'wrap',
        }}
      >
        <SecondaryButton
          label={state.isRecording ? t('mobile.tasks.stopRecording') : t('mobile.tasks.recordVoice')}
          haptic="selection"
          onPress={() => void (state.isRecording ? stop() : start())}
          style={buttonStyle}
        />
        {uri && !state.isRecording ? (
          <SecondaryButton
            label={t('mobile.tasks.playVoice')}
            haptic="selection"
            onPress={() => void play()}
            style={buttonStyle}
          />
        ) : null}
        {uri && !state.isRecording ? (
          <SecondaryButton
            label={t('mobile.tasks.discardVoice')}
            haptic="selection"
            onPress={discard}
            style={buttonStyle}
          />
        ) : null}
      </View>
    </DealerBoard>
  );
}
