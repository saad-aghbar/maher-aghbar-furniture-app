/** Piece 11 cancel-impact API types + structured reason codes. */

export const CANCEL_REASON_CODES = [
  'DEALER_REQUESTED',
  'DUPLICATE',
  'SPEC_ERROR',
  'UNABLE_TO_MANUFACTURE',
  'MATERIAL_UNAVAILABLE',
  'COMMERCIAL_AGREEMENT',
  'ADMINISTRATIVE_ERROR',
  'OTHER',
] as const;

export type CancelReasonCode = (typeof CANCEL_REASON_CODES)[number];

export type CancelImpactPhase = 1 | 2 | 3 | 4 | 5;

export type CancelImpactResponse = {
  phase: CancelImpactPhase;
  canCancel: boolean;
  blockReason?: string | null;
  salesOrder: {
    id: string;
    number: string;
    status: string;
    productSummary?: string | null;
    dealerName?: string | null;
    productImageUrl?: string | null;
  };
  currentState: string;
  impact: {
    materialsConsumedAmount: number;
    materialsConsumedSummary: string;
    semiLots: Array<{
      id: string;
      sku: string;
      qty: number;
      status: string;
      warehouse?: string | null;
    }>;
    finishedLots: Array<{
      id: string;
      sku: string;
      qty: number;
      status: string;
    }>;
    openTasks: number;
    inProgressTasks: number;
    completedTasksPreserved: number;
    purchaseCommitments: Array<{ number: string; sku?: string | null; note?: string | null }>;
    invoice: { id: string; number: string; status: string; total: number } | null;
    paymentsPresent: boolean;
    financialAttention: boolean;
  };
  finDispositionRequired: boolean;
  semiDispositionRequired: boolean;
};

export type CancelOrderBody = {
  reasonCode: CancelReasonCode;
  reason?: string;
};
