import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSafeAsyncStorage } from '@/api/safeAsyncStorage';
import type { RequestPriority } from '@/api/modules/requests';
import type { NewOrderStep } from './components/StepIndicator';

const storage = createSafeAsyncStorage(AsyncStorage);
const DRAFT_KEY = 'maher.mobile.new-order.local-draft.v1';

export type NewOrderLocalDraft = {
  version: 1;
  step: NewOrderStep;
  productId: string;
  customProductName: string;
  quantity: string;
  externalOrderNumber: string;
  priority: RequestPriority;
  fabric: string;
  fabricDescription: string;
  dimensionsNotes: string;
  orderNotes: string;
  deliveryAddress: string;
  endCustomerName: string;
  endCustomerPhone: string;
  deliveryNotes: string;
  deliveryLat?: number;
  deliveryLng?: number;
  serverDraftId?: string;
  serverDraftNumber?: string;
  updatedAt: string;
};

export async function loadLocalDraft(): Promise<NewOrderLocalDraft | null> {
  const raw = await storage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NewOrderLocalDraft;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLocalDraft(draft: NewOrderLocalDraft): Promise<void> {
  await storage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function clearLocalDraft(): Promise<void> {
  await storage.removeItem(DRAFT_KEY);
}
