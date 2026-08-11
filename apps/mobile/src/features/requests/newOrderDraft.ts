import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSafeAsyncStorage } from '@/api/safeAsyncStorage';
import {
  normalizeLocalDraft,
  type NewOrderLocalDraft,
} from './newOrderDraftNormalize';

export type { NewOrderLocalDraft } from './newOrderDraftNormalize';
export { normalizeLocalDraft } from './newOrderDraftNormalize';

const storage = createSafeAsyncStorage(AsyncStorage);
const DRAFT_KEY = 'maher.mobile.new-order.local-draft.v1';

export async function loadLocalDraft(): Promise<NewOrderLocalDraft | null> {
  const raw = await storage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NewOrderLocalDraft>;
    return normalizeLocalDraft(parsed);
  } catch {
    return null;
  }
}

export async function saveLocalDraft(draft: NewOrderLocalDraft): Promise<void> {
  const payload: NewOrderLocalDraft = { ...draft, version: 3 };
  await storage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

export async function clearLocalDraft(): Promise<void> {
  await storage.removeItem(DRAFT_KEY);
}
