export interface ReturnRow {
  id: string;
  number: string;
  productDesc: string;
  quantity: string | number;
  reason: string;
  description?: string | null;
  approvalStatus?: string;
  physicalStatus?: string | null;
  needInfoNote?: string | null;
  inventoryFate?: string | null;
  resolution?: string | null;
  productImageUrl?: string | null;
  reasonPhotoUrl?: string | null;
  issuePhotoUrl?: string | null;
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
}
