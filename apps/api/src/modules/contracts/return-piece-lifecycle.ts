export const RETURN_PIECE_DECISIONS = ['REPAIR', 'REPLACEMENT', 'SCRAP_RECOVERY'] as const;
export type ReturnPieceDecision = (typeof RETURN_PIECE_DECISIONS)[number];

export const RETURN_PIECE_STATES = [
  'AWAITING_RECEIPT',
  'RECEIVED',
  'DECIDED',
  'IN_PROGRESS',
  'READY_TO_RETURN',
  'RETURNING',
  'RETURNED',
  'RECOVERED',
  'CANCELLED',
] as const;
export type ReturnPieceState = (typeof RETURN_PIECE_STATES)[number];

const ALLOWED: Record<ReturnPieceState, readonly ReturnPieceState[]> = {
  AWAITING_RECEIPT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['DECIDED', 'CANCELLED'],
  DECIDED: ['IN_PROGRESS', 'READY_TO_RETURN', 'CANCELLED'],
  IN_PROGRESS: ['READY_TO_RETURN', 'RECOVERED', 'CANCELLED'],
  READY_TO_RETURN: ['RETURNING', 'CANCELLED'],
  RETURNING: ['RETURNED'],
  RETURNED: [],
  RECOVERED: [],
  CANCELLED: [],
};

const TERMINAL: ReadonlySet<ReturnPieceState> = new Set(['RETURNED', 'RECOVERED', 'CANCELLED']);

export function normalizePieceState(
  value: ReturnPieceState | string | null | undefined,
): ReturnPieceState {
  const raw = String(value ?? 'AWAITING_RECEIPT').trim().toUpperCase();
  return (RETURN_PIECE_STATES as readonly string[]).includes(raw)
    ? (raw as ReturnPieceState)
    : 'AWAITING_RECEIPT';
}

export function normalizePieceDecision(
  value: ReturnPieceDecision | string | null | undefined,
): ReturnPieceDecision | null {
  const raw = String(value ?? '').trim().toUpperCase();
  return (RETURN_PIECE_DECISIONS as readonly string[]).includes(raw)
    ? (raw as ReturnPieceDecision)
    : null;
}

export function canTransitionPiece(
  from: ReturnPieceState | string | null | undefined,
  to: ReturnPieceState,
): boolean {
  const current = normalizePieceState(from);
  if (current === to) return true;
  return (ALLOWED[current] ?? []).includes(to);
}

export function assertPieceTransition(
  from: ReturnPieceState | string | null | undefined,
  to: ReturnPieceState,
): void {
  if (canTransitionPiece(from, to)) return;
  const current = normalizePieceState(from);
  throw Object.assign(new Error(`Cannot move a return piece from ${current} to ${to}.`), {
    code: 'RETURN_PIECE_INVALID_TRANSITION',
    from: current,
    to,
  });
}

export function decisionAllowed(state: ReturnPieceState | string | null | undefined): boolean {
  return normalizePieceState(state) === 'RECEIVED';
}

export function isTerminalPiece(state: ReturnPieceState | string | null | undefined): boolean {
  return TERMINAL.has(normalizePieceState(state));
}

export function isOutboundEligible(input: {
  decision?: string | null;
  outboundEligible?: boolean | null;
  state?: string | null;
}): boolean {
  if (input.outboundEligible === false) return false;
  if (normalizePieceState(input.state) === 'CANCELLED') return false;
  const decision = normalizePieceDecision(input.decision);
  if (decision === 'SCRAP_RECOVERY') return false;
  if (!decision) return true;
  return decision === 'REPAIR' || decision === 'REPLACEMENT';
}

export function outboundEligibleForDecision(
  decision: ReturnPieceDecision | string | null | undefined,
): boolean {
  const normalized = normalizePieceDecision(decision);
  return normalized === 'REPAIR' || normalized === 'REPLACEMENT';
}

export function nextStateAfterDecision(
  decision: ReturnPieceDecision | string | null | undefined,
): ReturnPieceState {
  return normalizePieceDecision(decision) ? 'DECIDED' : 'RECEIVED';
}

export function nextStateAfterWorkCreated(): ReturnPieceState {
  return 'IN_PROGRESS';
}

export function dealerPieceLabel(
  decision: ReturnPieceDecision | string | null | undefined,
  state: ReturnPieceState | string | null | undefined,
): 'awaiting' | 'received' | 'repairing' | 'replacing' | 'recovering' | 'ready' | 'returning' | 'resolved' {
  const current = normalizePieceState(state);
  const kind = normalizePieceDecision(decision);
  if (current === 'RETURNED' || current === 'RECOVERED' || current === 'CANCELLED') return 'resolved';
  if (current === 'RETURNING') return 'returning';
  if (current === 'READY_TO_RETURN') return 'ready';
  if (current === 'AWAITING_RECEIPT') return 'awaiting';
  if (current === 'RECEIVED') return 'received';
  if (kind === 'REPLACEMENT') return 'replacing';
  if (kind === 'SCRAP_RECOVERY') return 'recovering';
  if (kind === 'REPAIR') return 'repairing';
  return 'received';
}
