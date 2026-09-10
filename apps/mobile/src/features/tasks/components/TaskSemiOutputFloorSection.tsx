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
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { invalidateKeys, queryKeys } from '@/api/queryKeys';
import {
  addTaskWipPiece,
  deleteTaskWipPiece,
  getTaskWipOutput,
  updateTaskWipPiece,
  type TaskWipOutput,
  type TaskWipOutputPiece,
} from '@/api/modules/tasks';
import { resolveDocumentUrl, uploadFile } from '@/api/modules/uploads';
import { AppText } from '@/components/AppText';
import { ImageViewer } from '@/components/media/ImageViewer';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { TextField } from '@/components/forms/TextField';
import { useToast } from '@/components/feedback/Toast';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { useAccessoryCamera } from '@/features/inventory/components/AccessoryCameraProvider';
import { presentAfterUiSettle } from '@/features/requests/presentAfterUiSettle';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import {
  buildWorkerOutputKits,
  nextExtraSortOrder,
  piecePlanFromOutput,
  type OutputKitPieceSlot,
} from '../selectWorkerOutput';

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
  /** Finished / cancelled — show pieces, no add/retake/rename. */
  readOnly?: boolean;
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
    { taskId, productionOrderId, expectedPieceCount, enabled = true, embedded = false, readOnly = false },
    ref,
  ) {
    const { t, locale, isRTL } = useLocale();
    const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
    const { colors, theme, colorScheme } = useTheme();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const { openAccessoryCamera } = useAccessoryCamera();
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [meta, setMeta] = useState<TaskWipOutput | null>(null);
    const [pieces, setPieces] = useState<TaskWipOutputPiece[]>([]);
    const [thumbByDocId, setThumbByDocId] = useState<Record<string, string>>({});
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);
    const [pendingConfirm, setPendingConfirm] = useState<{
      uri: string;
      expectedIndex: number;
      label: string;
    } | null>(null);
    const [nameSheetKit, setNameSheetKit] = useState<number | null>(null);
    const [newPieceName, setNewPieceName] = useState('');
    const [renamePiece, setRenamePiece] = useState<TaskWipOutputPiece | null>(null);
    const [renameText, setRenameText] = useState('');

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

    const piecePlan = piecePlanFromOutput(meta, expectedPieceCount);
    const assignedKits = Math.max(1, meta?.expectedKitCount ?? 1);
    const { kits, leftover } = buildWorkerOutputKits({
      expectedKitCount: assignedKits,
      piecePlan,
      pieces,
    });
    const expected = kits.reduce((sum, kit) => sum + kit.pieces.length, 0);
    const actual = pieces.filter((p) => Boolean(p.photoDocumentId ?? p.photoDocument?.id)).length;
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
      if (readOnly) return;
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
        const next = await addTaskWipPiece(taskId, {
          photoDocumentId,
          expectedIndex: pendingConfirm?.expectedIndex,
          label: pendingConfirm?.label,
        });
        setMeta(next);
        setPieces(next.pieces ?? []);
        void haptics.confirmLight();
        showToast({ variant: 'success', message: t('mobile.tasks.semiOutputPieceAdded') });
        setPendingConfirm(null);
        for (const key of invalidateKeys.afterTaskMutation(taskId)) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      } catch {
        void haptics.error();
        showToast({ variant: 'error', message: t('mobile.tasks.semiOutputSaveFailed') });
      } finally {
        setBusy(false);
      }
    }

    async function captureForLabel(expectedIndex: number, label: string) {
      if (readOnly) return;
      try {
        const uri = await openAccessoryCamera({
          title: label,
          hint: t('mobile.tasks.semiOutputAddHint'),
          aspectRatio: 4 / 3,
        });
        if (!uri) return;
        await presentAfterUiSettle(async () => {
          setPendingConfirm({
            uri,
            expectedIndex,
            label,
          });
        });
      } catch {
        /* cancelled */
      }
    }

    async function captureForSlot(slot: OutputKitPieceSlot) {
      const label =
        localize(
          locale,
          slot.plan.nameEn ?? slot.plan.label,
          slot.plan.nameAr ?? slot.plan.label,
          slot.plan.nameHe,
        ) || slot.plan.label;
      await captureForLabel(slot.expectedIndex, label);
    }

    async function onRetake() {
      if (!pendingConfirm) return;
      const { expectedIndex, label } = pendingConfirm;
      setPendingConfirm(null);
      await presentAfterUiSettle(() => captureForLabel(expectedIndex, label));
    }

    function onAddPieceToKit(kitIndex: number) {
      if (readOnly) return;
      void haptics.selection();
      setNewPieceName('');
      setNameSheetKit(kitIndex);
    }

    async function onNamedPieceContinue() {
      const label = newPieceName.trim();
      if (!label || nameSheetKit == null) {
        void haptics.error();
        return;
      }
      const kitIndex = nameSheetKit;
      const expectedIndex = nextExtraSortOrder(kitIndex, pieces);
      setNameSheetKit(null);
      await presentAfterUiSettle(() => captureForLabel(expectedIndex, label));
    }

    async function onRename() {
      if (readOnly || !renamePiece) return;
      const label = renameText.trim();
      if (!label) {
        void haptics.error();
        return;
      }
      setBusy(true);
      try {
        const next = await updateTaskWipPiece(taskId, renamePiece.id, { label });
        setMeta(next);
        setPieces(next.pieces ?? []);
        setRenamePiece(null);
        void haptics.confirmLight();
      } catch {
        void haptics.error();
        showToast({ variant: 'error', message: t('mobile.tasks.semiOutputSaveFailed') });
      } finally {
        setBusy(false);
      }
    }

    async function onRemove(pieceId: string) {
      if (readOnly) return;
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

    const assignedSummary =
      assignedKits === 1
        ? t('mobile.tasks.outputAssignedSummaryOneKit', { pieces: piecePlan.length })
        : t('mobile.tasks.outputAssignedSummary', {
            kits: assignedKits,
            pieces: piecePlan.length,
          });

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
        <AppText variant="body" weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {assignedSummary}
        </AppText>
        <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
          {actual > 0 ? statusText : t('mobile.tasks.outputKitHint')}
        </AppText>
      </View>
    );

    function addPieceButton(kitIndex: number) {
      return (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.tasks.addOffPlanPiece')}
          disabled={busy || loading}
          onPress={() => onAddPieceToKit(kitIndex)}
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
            {t('mobile.tasks.semiOutputAddPiece')}
          </AppText>
        </AnimatedPressable>
      );
    }

    function pieceLabel(slot: OutputKitPieceSlot): string {
      if (slot.existing?.label?.trim()) return slot.existing.label.trim();
      return (
        localize(
          locale,
          slot.plan.nameEn ?? slot.plan.label,
          slot.plan.nameAr,
          slot.plan.nameHe,
        ) || slot.plan.label
      );
    }

    function renderPieceRow(slot: OutputKitPieceSlot, viewerKey: number) {
      const piece = slot.existing;
      const docId = piece?.photoDocumentId ?? piece?.photoDocument?.id ?? null;
      const thumb = docId ? thumbByDocId[docId] : null;
      const label = pieceLabel(slot);
      const confirmed = Boolean(docId);
      return (
        <View
          key={piece?.id ?? `slot-${slot.expectedIndex}`}
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: confirmed ? colors.success : colors.border,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.sm,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: confirmed ? colors.success : colors.brand,
              opacity: confirmed ? 0.85 : 0.55,
              ...(isRTL ? { right: 0 } : { left: 0 }),
            }}
          />
          <AnimatedPressable
            variant="button"
            onPress={() => {
              if (docId && thumb) setViewerIndex(viewerKey);
            }}
            onLongPress={() => {
              if (readOnly || !piece) return;
              setRenamePiece(piece);
              setRenameText(piece.label?.trim() || label);
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
          </AnimatedPressable>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText variant="bodySecondary" weight={titleWeight} numberOfLines={2}>
              {label}
            </AppText>
          </View>
          {confirmed && piece ? (
            <AnimatedPressable
              variant="button"
              accessibilityLabel={t('mobile.tasks.semiOutputViewPiece')}
              onPress={() => {
                if (docId && thumb) setViewerIndex(viewerKey);
              }}
              onLongPress={() => {
                if (readOnly) return;
                void onRemove(piece.id);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.success,
              }}
            >
              <Ionicons name="checkmark" size={18} color={colors.success} />
            </AnimatedPressable>
          ) : readOnly ? null : (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('mobile.tasks.outputPieceMarkMade')}
              disabled={busy}
              onPress={() => void captureForSlot(slot)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderStrong,
              }}
            >
              <Ionicons name="add" size={18} color={colors.brand} />
            </AnimatedPressable>
          )}
        </View>
      );
    }

    const pieceList = (
      <View style={{ gap: theme.spacing.md }}>
        {loading && pieces.length === 0 && !meta ? (
          <View style={{ paddingVertical: theme.spacing.lg, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          kits.map((kit) => {
            const kitTitle = t('mobile.tasks.outputKitTitle', { n: kit.kitIndex + 1 });
            return (
              <DealerBoard
                key={`kit-${kit.kitIndex}`}
                title={kitTitle}
                titleWeight={titleWeight}
                trailing={readOnly ? undefined : addPieceButton(kit.kitIndex)}
              >
                <View style={{ gap: theme.spacing.sm }}>
                  {outputLabel ? (
                    <AppText
                      variant="caption"
                      color="muted"
                      style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                      {outputLabel}
                    </AppText>
                  ) : null}
                  {kit.pieces.map((slot, i) =>
                    renderPieceRow(slot, kit.kitIndex * piecePlan.length + i),
                  )}
                  {kit.extras.map((slot, i) =>
                    renderPieceRow(
                      slot,
                      kits.length * piecePlan.length + kit.kitIndex * 20 + i,
                    ),
                  )}
                </View>
              </DealerBoard>
            );
          })
        )}
        {leftover.map((piece, i) =>
          renderPieceRow(
            {
              expectedIndex: piece.sortOrder,
              planIndex: i,
              plan: {
                index: piece.sortOrder,
                label: piece.label?.trim() || t('mobile.tasks.semiOutputPieceLabel', { n: i + 1 }),
              },
              existing: piece,
            },
            kits.length * piecePlan.length + i,
          ),
        )}
      </View>
    );

    const sheets = (
      <>
        <BottomSheet
          open={Boolean(pendingConfirm)}
          onClose={() => setPendingConfirm(null)}
          title={t('mobile.tasks.confirmPiece')}
          overlay
          expandable
        >
          <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
            {stageLabel ? (
              <AppText variant="caption" color="muted">
                {t('mobile.tasks.semiOutputAddStage', { stage: stageLabel })}
              </AppText>
            ) : null}
            <AppText variant="body" weight={titleWeight}>
              {pendingConfirm?.label || outputLabel}
            </AppText>
            <AppText variant="bodySecondary" color="muted">
              {t('mobile.tasks.confirmPieceHint')}
            </AppText>
            {pendingConfirm?.uri ? (
              <Image
                source={{ uri: pendingConfirm.uri }}
                style={{
                  width: '100%',
                  height: 220,
                  borderRadius: theme.radius.lg,
                  backgroundColor: colors.surfaceSecondary,
                }}
                resizeMode="cover"
              />
            ) : null}
            <PrimaryButton
              label={t('mobile.tasks.confirmPiece')}
              onPress={() => {
                if (!pendingConfirm) return;
                void uploadAndAdd(pendingConfirm.uri, `piece-${Date.now()}.jpg`, 'image/jpeg');
              }}
              loading={busy}
              style={{ minHeight: theme.sizes.touch.min, borderRadius: theme.radius.xl }}
            />
            <SecondaryButton
              label={t('mobile.tasks.retakePhoto')}
              onPress={() => void onRetake()}
              style={{ borderRadius: theme.radius.xl }}
            />
            <SecondaryButton
              label={t('mobile.tasks.cancel')}
              onPress={() => setPendingConfirm(null)}
              style={{ borderRadius: theme.radius.xl }}
            />
          </View>
        </BottomSheet>
        <BottomSheet
          open={nameSheetKit != null}
          onClose={() => setNameSheetKit(null)}
          title={t('mobile.tasks.addPieceNameTitle')}
          overlay
          expandable
        >
          <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
            <AppText variant="bodySecondary" color="muted">
              {t('mobile.tasks.addPieceNameHint')}
            </AppText>
            <TextField
              label={t('mobile.tasks.pieceName')}
              value={newPieceName}
              onChangeText={setNewPieceName}
            />
            <PrimaryButton
              label={t('mobile.tasks.semiOutputAddPiece')}
              disabled={!newPieceName.trim()}
              onPress={() => void onNamedPieceContinue()}
              style={{ minHeight: theme.sizes.touch.min, borderRadius: theme.radius.xl }}
            />
            <SecondaryButton
              label={t('mobile.tasks.cancel')}
              onPress={() => setNameSheetKit(null)}
              style={{ borderRadius: theme.radius.xl }}
            />
          </View>
        </BottomSheet>
        <BottomSheet
          open={Boolean(renamePiece)}
          onClose={() => setRenamePiece(null)}
          title={t('mobile.tasks.renamePiece')}
          overlay
          expandable
        >
          <View style={{ gap: theme.spacing.md }}>
            <TextField
              label={t('mobile.tasks.pieceName')}
              value={renameText}
              onChangeText={setRenameText}
            />
            <PrimaryButton
              label={t('mobile.tasks.renamePiece')}
              loading={busy}
              onPress={() => void onRename()}
            />
            <SecondaryButton label={t('mobile.tasks.cancel')} onPress={() => setRenamePiece(null)} />
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
        </View>
        <View style={{ padding: theme.spacing.md }}>{pieceList}</View>
        {sheets}
      </View>
    );
  },
);
