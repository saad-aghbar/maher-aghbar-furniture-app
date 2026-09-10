import { useEffect, useMemo, useState } from 'react';
import { localizedName } from '@maher/i18n';
import { Image, ScrollView, useWindowDimensions, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { ReturnSheetFooter } from './ReturnSheetFooter';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';
import type { ReturnPiece, ReturnPieceDecision } from '../api';
import { isReturnWorkflowScope } from '@maher/types';
import {
  canDecidePiece,
  defaultReturnWorkflowId,
  type ReturnWorkflowOption,
} from '../returnPiece';

const DECISIONS: ReturnPieceDecision[] = ['REPAIR', 'REPLACEMENT', 'SCRAP_RECOVERY'];

type Props = {
  open: boolean;
  loading?: boolean;
  returnNumber?: string;
  pieces: ReturnPiece[];
  workflows?: ReturnWorkflowOption[];
  onClose: () => void;
  onConfirm: (
    items: Array<{
      pieceId: string;
      decision: ReturnPieceDecision;
      inspectionNotes?: string;
      workflowId?: string;
    }>,
  ) => void;
};

function DecisionChip({
  decision,
  selected,
  onPress,
}: {
  decision: ReturnPieceDecision;
  selected: boolean;
  onPress: () => void;
}) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const label = t(`mobile.returns.pieceDecision.${decision === 'SCRAP_RECOVERY' ? 'scrap' : decision === 'REPLACEMENT' ? 'replace' : 'repair'}`);
  const hint = t(`mobile.returns.pieceDecisionHint.${decision === 'SCRAP_RECOVERY' ? 'scrap' : decision === 'REPLACEMENT' ? 'replace' : 'repair'}`);
  return (
    <AnimatedPressable
      variant="button"
      accessibilityLabel={label}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        minHeight: 52,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
        backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        overflow: 'hidden',
        flex: 1,
      }}
    >
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: colors.brand,
            ...(isRTL ? { right: 0 } : { left: 0 }),
          }}
        />
      ) : null}
      <AppText
        variant="caption"
        weight={titleWeight}
        style={{ color: selected ? colors.brand : colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
      >
        {label}
      </AppText>
      <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
        {hint}
      </AppText>
    </AnimatedPressable>
  );
}

export function ReturnPieceDecisionSheet({
  open,
  loading,
  returnNumber,
  pieces,
  workflows = [],
  onClose,
  onConfirm,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height: windowH } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const sheetHeight = Math.min(Math.round(windowH * 0.88), 760);
  const decidable = useMemo(() => pieces.filter((piece) => canDecidePiece(piece)), [pieces]);
  const [step, setStep] = useState<'choose' | 'review'>('choose');
  const [choices, setChoices] = useState<Record<string, ReturnPieceDecision | undefined>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [workflowIds, setWorkflowIds] = useState<Record<string, string | undefined>>({});

  const returnWorkflows = useMemo(
    () =>
      workflows.filter(
        (workflow) => isReturnWorkflowScope(workflow.scope) && workflow.activeVersion?.id,
      ),
    [workflows],
  );

  useEffect(() => {
    setWorkflowIds((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const piece of decidable) {
        const decision = choices[piece.id];
        if (!decision || next[piece.id]) continue;
        const fallback = defaultReturnWorkflowId(decision, returnWorkflows);
        if (!fallback) continue;
        next[piece.id] = fallback;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [choices, decidable, returnWorkflows]);

  const ready =
    decidable.length > 0 &&
    decidable.every(
      (piece) =>
        choices[piece.id] &&
        (returnWorkflows.length === 0 || Boolean(workflowIds[piece.id])),
    );

  function close() {
    setStep('choose');
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      sheetHeight={sheetHeight}
      expandable
      title={t('mobile.returns.pieceDecideTitle')}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.lg,
            gap: theme.spacing.md,
          }}
        >
          <AppText variant="caption" color="muted" dir="ltr">
            {returnNumber} · {t('mobile.returns.pieceCount.total', { count: pieces.length })}
          </AppText>

          {decidable.length === 0 ? (
            <DealerEmptyPanel text={t('mobile.returns.pieceDecideEmpty')} />
          ) : step === 'choose' ? (
            decidable.map((piece, index) => {
              const image = resolveOrderMediaUri(piece.product?.imageUrl);
              return (
                <ListItemEnter key={piece.id} index={index}>
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
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: 3,
                        backgroundColor: colors.brand,
                        opacity: 0.55,
                        ...(isRTL ? { right: 0 } : { left: 0 }),
                      }}
                    />
                    <View
                      style={{
                        backgroundColor: colors.surfaceSecondary,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
                      }}
                    >
                      <AppText
                        variant="caption"
                        color="muted"
                        style={locale === 'ar' ? undefined : { letterSpacing: 0.6, textTransform: 'uppercase' }}
                      >
                        {t('mobile.returns.pieceOf', { n: piece.pieceNo, total: pieces.length })}
                      </AppText>
                      <AppText weight={titleWeight} dir="ltr">
                        {piece.code}
                      </AppText>
                    </View>
                    <View
                      style={{
                        padding: theme.spacing.md,
                        gap: theme.spacing.sm,
                        ...(isRTL ? { paddingRight: theme.spacing.md + 4 } : { paddingLeft: theme.spacing.md + 4 }),
                      }}
                    >
                      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.md, alignItems: 'center' }}>
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: theme.radius.lg,
                            backgroundColor: colors.surfaceSecondary,
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {image ? (
                            <Image source={{ uri: image }} style={{ width: 56, height: 56 }} />
                          ) : (
                            <AppText variant="caption" color="muted">
                              {piece.pieceNo}
                            </AppText>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText weight={titleWeight} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            {piece.productDesc}
                          </AppText>
                          {piece.conditionNotes ? (
                            <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                              {piece.conditionNotes}
                            </AppText>
                          ) : null}
                        </View>
                      </View>
                      <AppText variant="caption" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        {t('mobile.returns.pieceWhatToDo')}
                      </AppText>
                      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: theme.spacing.sm }}>
                        {DECISIONS.map((decision) => (
                          <DecisionChip
                            key={decision}
                            decision={decision}
                            selected={choices[piece.id] === decision}
                            onPress={() => {
                              setChoices((prev) => ({ ...prev, [piece.id]: decision }));
                              setWorkflowIds((prev) => ({
                                ...prev,
                                [piece.id]: defaultReturnWorkflowId(decision, returnWorkflows),
                              }));
                            }}
                          />
                        ))}
                      </View>
                      {returnWorkflows.length > 0 ? (
                        <View style={{ gap: theme.spacing.xs }}>
                          <AppText variant="caption" color="secondary" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            {t('mobile.returns.pieceWorkflow')}
                          </AppText>
                          <AppText variant="caption" color="muted" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            {t('mobile.returns.pieceWorkflowHint')}
                          </AppText>
                          {returnWorkflows.map((workflow) => {
                            const selected = workflowIds[piece.id] === workflow.id;
                            const name = localizedName(locale, workflow, workflow.code);
                            return (
                              <AnimatedPressable
                                key={workflow.id}
                                variant="button"
                                accessibilityLabel={name}
                                onPress={() => {
                                  void haptics.selection();
                                  setWorkflowIds((prev) => ({ ...prev, [piece.id]: workflow.id }));
                                }}
                                style={{
                                  minHeight: 44,
                                  borderRadius: theme.radius.lg,
                                  borderWidth: 1,
                                  borderColor: selected ? colors.brand : colors.border,
                                  backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
                                  paddingHorizontal: theme.spacing.md,
                                  paddingVertical: theme.spacing.sm,
                                  justifyContent: 'center',
                                }}
                              >
                                <AppText
                                  weight={titleWeight}
                                  style={{
                                    color: selected ? colors.brand : colors.textPrimary,
                                    textAlign: isRTL ? 'right' : 'left',
                                  }}
                                >
                                  {name}
                                </AppText>
                              </AnimatedPressable>
                            );
                          })}
                        </View>
                      ) : null}
                      <AppTextInput
                        value={notes[piece.id] ?? ''}
                        onChangeText={(value) => setNotes((prev) => ({ ...prev, [piece.id]: value }))}
                        placeholder={t('mobile.returns.pieceInspectionNote')}
                        accessibilityLabel={t('mobile.returns.pieceInspectionNote')}
                      />
                    </View>
                  </View>
                </ListItemEnter>
              );
            })
          ) : (
            <DealerBoard>
              {decidable.map((piece) => (
                <View
                  key={piece.id}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <AppText dir="ltr">{piece.code}</AppText>
                  <AppText weight={titleWeight}>
                    {t(
                      `mobile.returns.pieceDecision.${
                        choices[piece.id] === 'SCRAP_RECOVERY'
                          ? 'scrap'
                          : choices[piece.id] === 'REPLACEMENT'
                            ? 'replace'
                            : 'repair'
                      }`,
                    )}
                  </AppText>
                </View>
              ))}
            </DealerBoard>
          )}
        </ScrollView>

        <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
          <ReturnSheetFooter
            confirmLabel={
              step === 'choose' ? t('mobile.returns.pieceReview') : t('mobile.returns.pieceConfirm')
            }
            loading={step === 'review' && loading}
            disabled={step === 'choose' && (!ready || loading)}
            onConfirm={() => {
              if (step === 'choose') {
                void haptics.selection();
                setStep('review');
                return;
              }
              void haptics.confirmMedium();
              onConfirm(
                decidable.map((piece) => ({
                  pieceId: piece.id,
                  decision: choices[piece.id]!,
                  inspectionNotes: notes[piece.id]?.trim() || undefined,
                  workflowId: workflowIds[piece.id],
                })),
              );
            }}
            cancelLabel={step === 'review' ? t('mobile.returns.pieceBack') : t('common.cancel')}
            onCancel={() => {
              if (step === 'review') {
                setStep('choose');
                return;
              }
              close();
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
