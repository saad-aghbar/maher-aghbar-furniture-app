import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReviewState } from '../registry/types';

const KEY = '@maher/dev-component-lab/review-v1';

export type ReviewRecord = {
  state: ReviewState;
  note: string;
  updatedAt: string;
};

type Store = Record<string, ReviewRecord>;

async function readStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

async function writeStore(store: Store): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

export async function getReview(id: string): Promise<ReviewRecord> {
  const store = await readStore();
  return store[id] ?? { state: 'unset', note: '', updatedAt: '' };
}

export async function setReview(
  id: string,
  patch: Partial<Pick<ReviewRecord, 'state' | 'note'>>,
): Promise<ReviewRecord> {
  const store = await readStore();
  const prev = store[id] ?? { state: 'unset' as ReviewState, note: '', updatedAt: '' };
  const next: ReviewRecord = {
    state: patch.state ?? prev.state,
    note: patch.note ?? prev.note,
    updatedAt: new Date().toISOString(),
  };
  store[id] = next;
  await writeStore(store);
  return next;
}

export async function getReviewCounts(): Promise<{
  needs_work: number;
  review_later: number;
  approved: number;
  unset: number;
}> {
  const store = await readStore();
  const counts = { needs_work: 0, review_later: 0, approved: 0, unset: 0 };
  for (const rec of Object.values(store)) {
    if (rec.state === 'needs_work') counts.needs_work += 1;
    else if (rec.state === 'review_later') counts.review_later += 1;
    else if (rec.state === 'approved') counts.approved += 1;
    else counts.unset += 1;
  }
  return counts;
}

export async function getAllReviews(): Promise<Store> {
  return readStore();
}

export async function clearAllReviews(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
