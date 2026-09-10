import { legacyFieldsFromLifecycle, type ReturnLifecycleState } from './return-lifecycle';
import {
  isOutboundEligible,
  isTerminalPiece,
  normalizePieceDecision,
  normalizePieceState,
  type ReturnPieceDecision,
  type ReturnPieceState,
} from './return-piece-lifecycle';

export type ReturnPieceAggregateInput = {
  state?: string | null;
  decision?: string | null;
  outboundEligible?: boolean | null;
};

export type ReturnCasePieceSummary = {
  total: number;
  awaitingReceipt: number;
  received: number;
  decided: number;
  inProgress: number;
  readyToReturn: number;
  returning: number;
  returned: number;
  recovered: number;
  cancelled: number;
  repair: number;
  replacement: number;
  scrapRecovery: number;
  outboundEligible: number;
  outboundReady: number;
  outboundReturned: number;
  progressPercent: number;
};

export function summarizePieces(pieces: ReturnPieceAggregateInput[]): ReturnCasePieceSummary {
  const summary: ReturnCasePieceSummary = {
    total: pieces.length,
    awaitingReceipt: 0,
    received: 0,
    decided: 0,
    inProgress: 0,
    readyToReturn: 0,
    returning: 0,
    returned: 0,
    recovered: 0,
    cancelled: 0,
    repair: 0,
    replacement: 0,
    scrapRecovery: 0,
    outboundEligible: 0,
    outboundReady: 0,
    outboundReturned: 0,
    progressPercent: 0,
  };

  for (const piece of pieces) {
    const state = normalizePieceState(piece.state);
    const decision = normalizePieceDecision(piece.decision);
    if (state === 'AWAITING_RECEIPT') summary.awaitingReceipt += 1;
    else if (state === 'RECEIVED') summary.received += 1;
    else if (state === 'DECIDED') summary.decided += 1;
    else if (state === 'IN_PROGRESS') summary.inProgress += 1;
    else if (state === 'READY_TO_RETURN') summary.readyToReturn += 1;
    else if (state === 'RETURNING') summary.returning += 1;
    else if (state === 'RETURNED') summary.returned += 1;
    else if (state === 'RECOVERED') summary.recovered += 1;
    else if (state === 'CANCELLED') summary.cancelled += 1;

    if (decision === 'REPAIR') summary.repair += 1;
    else if (decision === 'REPLACEMENT') summary.replacement += 1;
    else if (decision === 'SCRAP_RECOVERY') summary.scrapRecovery += 1;

    if (isOutboundEligible(piece)) {
      summary.outboundEligible += 1;
      if (state === 'READY_TO_RETURN' || state === 'RETURNING' || state === 'RETURNED') {
        summary.outboundReady += 1;
      }
      if (state === 'RETURNED') summary.outboundReturned += 1;
    }
  }

  summary.progressPercent = pieceProgressPercent(pieces);
  return summary;
}

export function pieceProgressPercent(pieces: ReturnPieceAggregateInput[]): number {
  if (!pieces.length) return 0;
  const weights: Record<ReturnPieceState, number> = {
    AWAITING_RECEIPT: 0,
    RECEIVED: 20,
    DECIDED: 35,
    IN_PROGRESS: 55,
    READY_TO_RETURN: 80,
    RETURNING: 90,
    RETURNED: 100,
    RECOVERED: 100,
    CANCELLED: 100,
  };
  const total = pieces.reduce((sum, piece) => sum + weights[normalizePieceState(piece.state)], 0);
  return Math.round(total / pieces.length);
}

export function deriveCaseLifecycle(input: {
  parentState?: string | null;
  approvalStatus?: string | null;
  pieces: ReturnPieceAggregateInput[];
}): ReturnLifecycleState {
  const parent = String(input.parentState ?? '').toUpperCase();
  const approval = String(input.approvalStatus ?? '').toUpperCase();
  if (parent === 'REJECTED' || approval === 'REJECTED') return 'REJECTED';
  if (parent === 'NEED_INFO' || approval === 'NEED_INFO') return 'NEED_INFO';
  if (!input.pieces.length) {
    return (parent as ReturnLifecycleState) || (approval === 'APPROVED' ? 'APPROVED' : 'REQUESTED');
  }

  const summary = summarizePieces(input.pieces);
  const active = input.pieces.filter((piece) => normalizePieceState(piece.state) !== 'CANCELLED');
  if (!active.length) return 'REJECTED';

  if (summary.awaitingReceipt === active.length) {
    if (parent === 'IN_TRANSIT') return 'IN_TRANSIT';
    if (parent === 'APPROVED' || approval === 'APPROVED') return 'APPROVED';
    return parent === 'REQUESTED' ? 'REQUESTED' : 'APPROVED';
  }

  const allTerminal = active.every((piece) => isTerminalPiece(piece.state));
  if (allTerminal) return 'COMPLETED';

  if (summary.outboundEligible > 0 && summary.outboundReturned === summary.outboundEligible) {
    const recoveryOpen = active.some(
      (piece) =>
        normalizePieceDecision(piece.decision) === 'SCRAP_RECOVERY' &&
        !isTerminalPiece(piece.state),
    );
    if (!recoveryOpen) return 'COMPLETED';
  }

  if (summary.returning > 0 || (summary.outboundReturned > 0 && summary.outboundReturned < summary.outboundEligible)) {
    return 'RETURNING';
  }

  const outboundStillOpen = active.filter((piece) => isOutboundEligible(piece));
  if (
    outboundStillOpen.length > 0 &&
    outboundStillOpen.every((piece) => {
      const state = normalizePieceState(piece.state);
      return state === 'READY_TO_RETURN' || state === 'RETURNING' || state === 'RETURNED';
    })
  ) {
    return 'READY_TO_RETURN';
  }

  if (summary.replacement > 0 && summary.repair === 0) return 'REPLACING';
  if (summary.repair > 0 || summary.replacement > 0 || summary.scrapRecovery > 0) return 'REWORKING';
  if (summary.decided > 0 || summary.inProgress > 0) return 'REWORKING';
  if (summary.received > 0 || summary.awaitingReceipt < active.length) {
    return summary.decided + summary.inProgress > 0 ? 'INSPECTING' : 'RECEIVED';
  }
  return 'RECEIVED';
}

export function caseLifecyclePatch(input: {
  parentState?: string | null;
  approvalStatus?: string | null;
  pieces: ReturnPieceAggregateInput[];
}): {
  lifecycleState: ReturnLifecycleState;
  approvalStatus: string;
  physicalStatus: string;
} {
  const lifecycleState = deriveCaseLifecycle(input);
  return { lifecycleState, ...legacyFieldsFromLifecycle(lifecycleState) };
}

export function allOutboundPiecesReady(pieces: ReturnPieceAggregateInput[]): boolean {
  const outbound = pieces.filter((piece) => isOutboundEligible(piece));
  if (!outbound.length) return false;
  return outbound.every((piece) => {
    const state = normalizePieceState(piece.state);
    return state === 'READY_TO_RETURN' || state === 'RETURNING' || state === 'RETURNED';
  });
}

export function decisionCounts(pieces: ReturnPieceAggregateInput[]): Record<ReturnPieceDecision, number> {
  return {
    REPAIR: pieces.filter((piece) => normalizePieceDecision(piece.decision) === 'REPAIR').length,
    REPLACEMENT: pieces.filter((piece) => normalizePieceDecision(piece.decision) === 'REPLACEMENT').length,
    SCRAP_RECOVERY: pieces.filter((piece) => normalizePieceDecision(piece.decision) === 'SCRAP_RECOVERY').length,
  };
}
