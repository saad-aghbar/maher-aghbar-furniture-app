import { uploadFile } from '@/api/modules/uploads';
import { updateTaskNotes } from '@/api/modules/tasks';
import { ApiError } from '@/api/errors';
import {
  listTaskOutbox,
  removeOutboxItem,
  updateOutboxItem,
  type TaskNotesOutboxPayload,
  type TaskOutboxItem,
  type TaskPhotoOutboxPayload,
} from './outbox';

export type FlushResult = {
  synced: number;
  failed: number;
  conflicts: number;
};

/**
 * Flush queued notes/photos. Never queues or flushes task completion.
 */
export async function flushTaskOutbox(taskId?: string): Promise<FlushResult> {
  const items = await listTaskOutbox(taskId);
  const actionable = items.filter(
    (i) => i.status === 'pending' || i.status === 'failed',
  );
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  for (const item of actionable) {
    await updateOutboxItem(item.id, {
      status: 'syncing',
      attempts: item.attempts + 1,
    });
    try {
      await flushOne(item);
      await removeOutboxItem(item.id);
      synced += 1;
    } catch (err) {
      const conflict =
        err instanceof ApiError && (err.status === 409 || err.code.includes('CONFLICT'));
      if (conflict) {
        await updateOutboxItem(item.id, {
          status: 'conflict',
          lastError: err instanceof Error ? err.message : 'Conflict',
        });
        conflicts += 1;
      } else {
        await updateOutboxItem(item.id, {
          status: 'failed',
          lastError: err instanceof Error ? err.message : 'Sync failed',
        });
        failed += 1;
      }
    }
  }

  return { synced, failed, conflicts };
}

async function flushOne(item: TaskOutboxItem): Promise<void> {
  if (item.kind === 'photo') {
    const payload = item.payload as TaskPhotoOutboxPayload;
    await uploadFile(
      {
        uri: payload.uri,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        category: `TASK_PHOTO:${item.taskId}`,
        taskId: item.taskId,
        productionOrderId: payload.productionOrderId,
        idempotencyKey: item.idempotencyKey,
      },
    );
    return;
  }
  const notes = (item.payload as TaskNotesOutboxPayload).notes;
  await updateTaskNotes(item.taskId, notes, item.idempotencyKey);
}
