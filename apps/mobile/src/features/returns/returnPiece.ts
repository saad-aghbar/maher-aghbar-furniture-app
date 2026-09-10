import { isReturnWorkflowScope } from '@maher/types';
import type { ReturnPiece, ReturnPieceDecision, ReturnPieceState } from './api';

export type ReturnWorkflowOption = {
  id: string;
  code: string;
  nameEn?: string | null;
  nameAr?: string | null;
  nameHe?: string | null;
  scope?: string | null;
  activeVersion?: { id: string } | null;
};

export function defaultReturnWorkflowId(
  decision: ReturnPieceDecision | undefined,
  workflows: ReturnWorkflowOption[],
): string | undefined {
  const published = workflows.filter(
    (workflow) => isReturnWorkflowScope(workflow.scope) && workflow.activeVersion?.id,
  );
  if (!published.length || !decision) return undefined;
  if (decision === 'SCRAP_RECOVERY') {
    return published.find((workflow) => workflow.code === 'RETURN_RECOVERY')?.id ?? published[0]?.id;
  }
  return published.find((workflow) => workflow.code !== 'RETURN_RECOVERY')?.id ?? published[0]?.id;
}

export const RETURN_PIECE_DECISIONS = ['REPAIR', 'REPLACEMENT', 'SCRAP_RECOVERY'] as const;

export type PieceDecisionDraft = {
  pieceId: string;
  decision: ReturnPieceDecision | null;
  inspectionNotes?: string;
};

export function dealerPieceJourneyKey(
  piece: Pick<ReturnPiece, 'decision' | 'state'>,
): string {
  const state = String(piece.state ?? '').toUpperCase() as ReturnPieceState | string;
  const decision = String(piece.decision ?? '').toUpperCase();
  if (state === 'RETURNED' || state === 'RECOVERED' || state === 'CANCELLED') {
    return 'mobile.returns.pieceJourney.resolved';
  }
  if (state === 'RETURNING') return 'mobile.returns.pieceJourney.returning';
  if (state === 'READY_TO_RETURN') return 'mobile.returns.pieceJourney.ready';
  if (state === 'AWAITING_RECEIPT') return 'mobile.returns.pieceJourney.awaiting';
  if (state === 'RECEIVED') return 'mobile.returns.pieceJourney.received';
  if (decision === 'REPLACEMENT') return 'mobile.returns.pieceJourney.replacing';
  if (decision === 'SCRAP_RECOVERY') return 'mobile.returns.pieceJourney.recovering';
  if (decision === 'REPAIR') return 'mobile.returns.pieceJourney.repairing';
  return 'mobile.returns.pieceJourney.received';
}

export function pieceDecisionLabelKey(decision: string | null | undefined): string {
  switch (String(decision ?? '').toUpperCase()) {
    case 'REPAIR':
      return 'mobile.returns.pieceDecision.repair';
    case 'REPLACEMENT':
      return 'mobile.returns.pieceDecision.replace';
    case 'SCRAP_RECOVERY':
      return 'mobile.returns.pieceDecision.scrap';
    default:
      return 'mobile.returns.pieceDecision.undecided';
  }
}

export function canDecidePiece(piece: Pick<ReturnPiece, 'state' | 'decision'>): boolean {
  return String(piece.state).toUpperCase() === 'RECEIVED' && !piece.decision;
}

export function allPiecesDecided(pieces: Array<Pick<ReturnPiece, 'decision' | 'state'>>): boolean {
  const decidable = pieces.filter((piece) => String(piece.state).toUpperCase() !== 'CANCELLED');
  return decidable.length > 0 && decidable.every((piece) => Boolean(piece.decision));
}
