import AsyncStorage from '@react-native-async-storage/async-storage';
import { createRequestId } from '@/api/requestId';

const STORAGE_KEY = 'maher.taskOutbox.v1';

export type TaskOutboxKind = 'photo' | 'notes';

export type TaskOutboxStatus = 'pending' | 'syncing' | 'failed' | 'conflict';

export type TaskPhotoOutboxPayload = {
  uri: string;
  fileName: string;
  mimeType: string;
  productionOrderId: string;
};

export type TaskNotesOutboxPayload = {
  notes: string;
};

export type TaskOutboxItem = {
  id: string;
  /** Stable client idempotency key — reused on every retry. */
  idempotencyKey: string;
  kind: TaskOutboxKind;
  taskId: string;
  status: TaskOutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  payload: TaskPhotoOutboxPayload | TaskNotesOutboxPayload;
};

async function readAll(): Promise<TaskOutboxItem[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TaskOutboxItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: TaskOutboxItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function listTaskOutbox(taskId?: string): Promise<TaskOutboxItem[]> {
  const all = await readAll();
  return taskId ? all.filter((i) => i.taskId === taskId) : all;
}

export async function enqueueTaskPhoto(input: {
  taskId: string;
  productionOrderId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  idempotencyKey?: string;
}): Promise<TaskOutboxItem> {
  const now = new Date().toISOString();
  const item: TaskOutboxItem = {
    id: createRequestId(),
    idempotencyKey: input.idempotencyKey ?? `photo-${createRequestId()}`,
    kind: 'photo',
    taskId: input.taskId,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    payload: {
      uri: input.uri,
      fileName: input.fileName,
      mimeType: input.mimeType,
      productionOrderId: input.productionOrderId,
    },
  };
  const all = await readAll();
  // Prevent duplicate pending photos with same local uri + task.
  const dup = all.find(
    (i) =>
      i.kind === 'photo' &&
      i.taskId === input.taskId &&
      i.status !== 'conflict' &&
      (i.payload as TaskPhotoOutboxPayload).uri === input.uri,
  );
  if (dup) return dup;
  all.unshift(item);
  await writeAll(all);
  return item;
}

export async function enqueueTaskNotes(input: {
  taskId: string;
  notes: string;
  idempotencyKey?: string;
}): Promise<TaskOutboxItem> {
  const now = new Date().toISOString();
  const all = await readAll();
  // Coalesce: replace any pending notes for this task.
  const remaining = all.filter(
    (i) => !(i.kind === 'notes' && i.taskId === input.taskId && i.status === 'pending'),
  );
  const item: TaskOutboxItem = {
    id: createRequestId(),
    idempotencyKey: input.idempotencyKey ?? `notes-${createRequestId()}`,
    kind: 'notes',
    taskId: input.taskId,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    payload: { notes: input.notes },
  };
  remaining.unshift(item);
  await writeAll(remaining);
  return item;
}

export async function updateOutboxItem(
  id: string,
  patch: Partial<Pick<TaskOutboxItem, 'status' | 'attempts' | 'lastError'>>,
): Promise<void> {
  const all = await readAll();
  const next = all.map((i) =>
    i.id === id
      ? { ...i, ...patch, updatedAt: new Date().toISOString() }
      : i,
  );
  await writeAll(next);
}

export async function removeOutboxItem(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((i) => i.id !== id));
}

export function pendingCount(items: TaskOutboxItem[]): number {
  return items.filter((i) => i.status === 'pending' || i.status === 'syncing' || i.status === 'failed')
    .length;
}
