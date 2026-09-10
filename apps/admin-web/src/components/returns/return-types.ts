export type ReturnResponsibility =
  | 'FACTORY_WARRANTY'
  | 'DEALER_RESPONSIBILITY'
  | 'SHARED'
  | 'UNDETERMINED';

export type ReturnChargeStatus =
  | 'NOT_REQUIRED'
  | 'DRAFT'
  | 'AWAITING_DEALER'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'INVOICED';

export type ReturnPieceDecision = 'REPAIR' | 'REPLACEMENT' | 'SCRAP_RECOVERY';

export type ReturnPieceState =
  | 'AWAITING_RECEIPT'
  | 'RECEIVED'
  | 'DECIDED'
  | 'IN_PROGRESS'
  | 'READY_TO_RETURN'
  | 'RETURNING'
  | 'RETURNED'
  | 'RECOVERED'
  | 'CANCELLED';

export interface ReturnPiece {
  id: string;
  pieceNo: number;
  code: string;
  productDesc: string;
  state: ReturnPieceState | string;
  decision?: ReturnPieceDecision | string | null;
  outboundEligible?: boolean;
  receivedCondition?: string | null;
  inspectionNotes?: string | null;
  productionOrder?: { id: string; number: string; originType?: string; status?: string } | null;
  recoveryOrder?: { id: string; number: string; originType?: string; status?: string } | null;
  recoveryLines?: Array<{
    id: string;
    label: string;
    quantity: number | string;
    unit: string;
    outcome: string;
    postedAt?: string | null;
  }>;
}

export interface ReturnPieceSummary {
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
}

export interface ReturnRow {
  id: string;
  number: string;
  productDesc: string;
  quantity: string | number;
  reason: string;
  description?: string | null;
  approvalStatus?: string;
  physicalStatus?: string | null;
  lifecycleState?: string | null;
  needInfoNote?: string | null;
  inventoryFate?: string | null;
  resolution?: string | null;
  responsibility?: ReturnResponsibility | string | null;
  chargeAmount?: number | string | null;
  factoryShareAmount?: number | string | null;
  chargeStatus?: ReturnChargeStatus | string | null;
  chargeRejectionNote?: string | null;
  productImageUrl?: string | null;
  reasonPhotoUrl?: string | null;
  issuePhotoUrl?: string | null;
  reasonPhotoUrls?: string[] | null;
  issuePhotoUrls?: string[] | null;
  reworkCost?: {
    estimatedTotal?: number | null;
    actualTotal?: number | null;
    repairCost?: number | null;
    replacementCost?: number | null;
    recoveryCost?: number | null;
    recoveredValue?: number | null;
    disposedValue?: number | null;
    laborCost?: number | null;
    factoryAbsorbed?: number | null;
  } | null;
  customer?: {
    id?: string;
    code?: string;
    name: string;
    nameAr?: string | null;
    nameEn?: string | null;
    nameHe?: string | null;
  };
  salesOrder?: {
    id: string;
    number: string;
    externalOrderNumber?: string | null;
  } | null;
  pieces?: ReturnPiece[];
  pieceSummary?: ReturnPieceSummary;
  workOrders?: Array<{ id: string; number: string; originType?: string; status?: string }>;
  reshipDeliveries?: Array<{
    id: string;
    number: string;
    status?: string;
    deliveryDate?: string | null;
  }>;
  chargeInvoices?: Array<{
    id: string;
    number: string;
    total?: number | string | null;
    status?: string | null;
  }>;
}

export interface ReturnWorkflowOption {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  nameHe?: string | null;
  scope?: 'STANDARD' | 'RETURN' | null;
  status?: string;
}
