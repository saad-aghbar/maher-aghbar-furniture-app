import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  addTaskWipPiece,
  deleteTaskWipPiece,
  getTaskWipOutput,
  type TaskWipOutput,
  type TaskWipOutputPiece,
} from '@/api/modules/tasks';
import { resolveDocumentUrl, uploadFile } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { ImageViewer } from '@/components/media/ImageViewer';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { useToast } from '@/components/feedback/Toast';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { presentAfterUiSettle } from '@/features/requests/presentAfterUiSettle';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

export type TaskSemiOutputFloorHandle = {
  piecePhotoCount: () => number;
  reload: () => Promise<void>;
};

type Props = {
  taskId: string;
  productionOrderId: string | null;
  expectedPieceCount: number;
  enabled?: boolean;
  /** When true, render as subsection without outer SEMI card chrome. */
  embedded?: boolean;
};

function localize(
  locale: string,
  en?: string | null,
  ar?: string | null,
  he?: string | null,
): string {
  if (locale.startsWith('ar')) return ar || en || '';
  if (locale.startsWith('he')) return he || en || '';
  return en || ar || '';
}

/**
 * Stage OUTPUT semi-finished pieces — add completed pieces with photos.
 */
export const TaskSemiOutputFloorSection = forwardRef<TaskSemiOutputFloorHandle, Props>(
  function TaskSemiOutputFloorSection(
    { taskId, productionOrderId, expectedPieceCount, enabled = true, embedded = false },
    ref,
  ) {
    const { t, locale, isRTL } = useLocale();
    const { colors, theme, colorScheme } = useTheme();
    const { showToast } = useToast();
    const { openAccessoryCamera } = useAccessoryCamera();
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [meta, setMeta] = useState<TaskWipOutput | null>(null);
    const [pieces, setPieces] = useState<TaskWipOutputPiece[]>([]);
    const [thumbByDocId, setThumbByDocId] = useState<Record<string, string>>({});
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);
    const [addOpen, setAddOpen] = useState(false);

    const reload = useCallback(async () => {
      if (!enabled) return;
      setLoading(true);
      try {
        const data = await getTaskWipOutput(taskId);
        setMeta(data);
        setPieces(data.pieces ?? []);
      } catch {
        showToast({ variant: 'error', message: t('mobile.tasks.semiOutputLoadFailed') });
      } finally {
        setLoading(false);
      }
    }, [enabled, taskId, showToast, t]);

    useEffect(() => {
      void reload();
    }, [reload]);

    useEffect(() => {
      let cancelled = false;
      const ids = pieces
        .map((p) => p.photoDocumentId ?? p.photoDocument?.id ?? null)
        .filter((id): id is string => Boolean(id));
      if (ids.length === 0) {
        setThumbByDocId({});
        return;
      }
      void (async () => {
        const next: Record<string, string> = {};
        for (const id of ids) {
          try {
            next[id] = await resolveDocumentUrl(id);
          } catch {
            /* skip */
          }
        }
        if (!cancelled) setThumbByDocId(next);
      })();
      return () => {
        cancelled = true;
      };
    }, [pieces]);

    useImperativeHandle(
      ref,
      () => ({
        piecePhotoCount: () =>
          pieces.filter((p) => Boolean(p.photoDocumentId ?? p.photoDocument?.id)).length,
        reload,
      }),
      [pieces, reload],
    );

    const expected = Math.max(
      1,
      meta?.expectedPieceCount ?? expectedPieceCount ?? 1,
    );
    const actual = pieces.length;
    const outputLabel =
      localize(locale, meta?.outputNameEn, meta?.outputNameAr, meta?.outputNameHe) ||
      t('mobile.tasks.semiOutputDefaultName');
    const nextName = meta?.nextStages?.[0]
      ? localize(
          locale,
          meta.nextStages[0].nameEn,
          meta.nextStages[0].nameAr,
          meta.nextStages[0].nameHe,
        )
      : '';
    const stageLabel =
      localize(locale, meta?.stageNameEn, meta?.stageNameAr, meta?.stageNameHe) || '';

    const statusText =
      actual <= 0
        ? t('mobile.tasks.semiOutputStatusNotStarted')
        : actual >= expected
          ? nextName
            ? t('mobile.tasks.semiOutputStatusReadyNext', { stage: nextName, n: actual })
            : t('mobile.tasks.semiOutputCaptionReady')
          : t('mobile.tasks.semiOutputStatusPartial', {
              actual,
              expected,
            });

    async function uploadAndAdd(uri: string, fileName: string, mimeType: string) {
      if (!productionOrderId) {
        showToast({ variant: 'error', message: t('mobile.tasks.uploadFailed') });
        return;
      }
      setBusy(true);
      try {
        const uploaded = await uploadFile({
          uri,
          fileName,
          mimeType,
          category: `TASK_PHOTO:${taskId}`,
          taskId,
          productionOrderId,
        });
        const photoDocumentId = uploaded.document?.id;
        if (!photoDocumentId) {
          throw new Error('missing document id');
        }
        const next = await addTaskWipPiece(taskId, { photoDocumentId });
        setMeta(next);
        setPieces(next.pieces ?? []);
        void haptics.confirmLight();
        showToast({ variant: 'success', message: t('mobile.tasks.semiOutputPieceAdded') });
        setAddOpen(false);
      } catch {
        void haptics.error();
        showToast({ variant: 'error', message: t('mobile.tasks.semiOutputSaveFailed') });
      } finally {
        setBusy(false);
      }
    }

    async function onTakePhoto() {
      try {
        const uri = await openAccessoryCamera({
          title: t('mobile.tasks.semiOutputAddCompleted'),
          hint: t('mobile.tasks.semiOutputAddHint'),
          aspectRatio: 4 / 3,
        });
        if (!uri) return;
        await uploadAndAdd(uri, `piece-${Date.now()}.jpg`, 'image/jpeg');
      } catch {
        /* cancelled */
      }
    }

    async function onPickGallery() {
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showToast({ variant: 'warning', message: t('mobile.tasks.galleryPermission') });
          return;
        }
        const result = await presentAfterUiSettle(() =>
          ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: false,
            exif: false,
            allowsMultipleSelection: false,
          }),
        );
        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        await uploadAndAdd(
          asset.uri,
          asset.fileName ?? `piece-${Date.now()}.jpg`,
          asset.mimeType ?? 'image/jpeg',
        );
      } catch {
        showToast({ variant: 'error', message: t('mobile.tasks.uploadFailed') });
      }
    }

    function onAddPiece() {
      setAddOpen(true);
    }

    async function onRemove(pieceId: string) {
      Alert.alert(
        t('mobile.tasks.semiOutputRemovePiece'),
        t('mobile.tasks.semiOutputRemoveConfirm'),
        [
          { text: t('mobile.tasks.cancel'), style: 'cancel' },
          {
            text: t('mobile.tasks.semiOutputRemovePiece'),
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setBusy(true);
                try {
                  const next = await deleteTaskWipPiece(taskId, pieceId);
                  setMeta(next);
                  setPieces(next.pieces ?? []);
                  void haptics.selection();
                } catch {
                  void haptics.error();
                  showToast({
                    variant: 'error',
                    message: t('mobile.tasks.semiOutputSaveFailed'),
                  });
                } finally {
                  setBusy(false);
                }
              })();
            },
          },
        ],
      );
    }

    if (!enabled) return null;

    const header = (
      <View style={{ gap: 4, flex: 1 }}>
        <AppText
          variant="caption"
          weight="semibold"
          style={{
            color: embedded ? colors.textSecondary : colors.brand,
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            fontSize: 11,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.tasks.outputHandoffTitle')}
        </AppText>
        <AppText variant="body" weight="semibold" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {outputLabel}
        </AppText>
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {t('mobile.tasks.semiOutputProgress', { actual, expected })}
        </AppText>
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {statusText}
        </AppText>
      </View>
    );

    const addButton = (
      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.tasks.semiOutputAddCompleted')}
        disabled={busy || loading}
        onPress={onAddPiece}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: theme.spacing.sm + 2,
          paddingVertical: 6,
          borderRadius: theme.radius.full,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Ionicons name="add" size={16} color={colors.brand} />
        <AppText variant="caption" weight="medium" style={{ color: colors.brand }}>
          {t('mobile.tasks.semiOutputAddShort')}
        </AppText>
      </AnimatedPressable>
    );

    const pieceList = (
      <View style={{ gap: theme.spacing.sm }}>
        {loading && pieces.length === 0 ? (
          <View style={{ paddingVertical: theme.spacing.lg, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : pieces.length === 0 ? (
          <AppText variant="body" color="muted">
            {t('mobile.tasks.semiOutputEmpty')}
          </AppText>
        ) : (
          pieces.map((piece, index) => {
            const docId = piece.photoDocumentId ?? piece.photoDocument?.id ?? null;
            const thumb = docId ? thumbByDocId[docId] : null;
            const label =
              piece.label?.trim() ||
              t('mobile.tasks.semiOutputPieceLabel', { n: index + 1 });
            return (
              <View
                key={piece.id}
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSecondary,
                  padding: theme.spacing.sm,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  gap: theme.spacing.sm,
                  alignItems: 'center',
                }}
              >
                <Pressable
                  onPress={() => {
                    if (docId && thumb) setViewerIndex(index);
                  }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: theme.radius.md,
                    overflow: 'hidden',
                    backgroundColor: colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={{ width: 56, height: 56 }} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  )}
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodySecondary" weight="medium">
                    {label}
                  </AppText>
                </View>
                <Pressable
                  onPress={() => void onRemove(piece.id)}
                  accessibilityLabel={t('mobile.tasks.semiOutputRemovePiece')}
                  hitSlop={8}
                >
                        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    );

    const sheets = (
      <>
        <BottomSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title={t('mobile.tasks.semiOutputAddCompleted')}
        >
          <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
            {stageLabel ? (
              <AppText variant="caption" color="muted">
                {t('mobile.tasks.semiOutputAddStage', { stage: stageLabel })}
              </AppText>
            ) : null}
            <AppText variant="body" weight="semibold">
              {t('mobile.tasks.semiOutputAddOutput', { name: outputLabel })}
            </AppText>
            <AppText variant="bodySecondary" color="muted">
              {t('mobile.tasks.semiOutputAddHint')}
            </AppText>
            <PrimaryButton
              label={t('mobile.tasks.takePhoto')}
              onPress={() => void onTakePhoto()}
              loading={busy}
              style={{ minHeight: theme.sizes.touch.min }}
            />
            <SecondaryButton
              label={t('mobile.tasks.choosePhoto')}
              onPress={() => void onPickGallery()}
            />
            <SecondaryButton
              label={t('mobile.tasks.cancel')}
              onPress={() => setAddOpen(false)}
            />
          </View>
        </BottomSheet>
        {viewerIndex != null ? (
          <ImageViewer
            open
            uris={pieces
              .map((p) => {
                const id = p.photoDocumentId ?? p.photoDocument?.id;
                return id ? thumbByDocId[id] : null;
              })
              .filter((u): u is string => Boolean(u))}
            index={viewerIndex}
            onClose={() => setViewerIndex(null)}
          />
        ) : null}
      </>
    );

    if (embedded) {
      return (
        <View style={{ gap: theme.spacing.sm }}>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
            }}
          >
            {header}
            {addButton}
          </View>
          {pieceList}
          {sheets}
        </View>
      );
    }

    return (
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...orderBoardShadow(colorScheme),
        }}
      >
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm + 2,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
          }}
        >
          {header}
          {addButton}
        </View>
        <View style={{ padding: theme.spacing.md }}>{pieceList}</View>
        {sheets}
      </View>
    );
  },
);
