import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueueTaskNotes,
  enqueueTaskPhoto,
  listTaskOutbox,
  pendingCount,
  removeOutboxItem,
  updateOutboxItem,
} from '../outbox';

jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn(async (k: string) => {
        delete store[k];
      }),
      clear: jest.fn(async () => {
        store = {};
      }),
    },
  };
});

describe('task outbox', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('queues photos with stable idempotency keys and prevents uri duplicates', async () => {
    const a = await enqueueTaskPhoto({
      taskId: 't1',
      productionOrderId: 'po1',
      uri: 'file://a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      idempotencyKey: 'photo-stable-1',
    });
    const b = await enqueueTaskPhoto({
      taskId: 't1',
      productionOrderId: 'po1',
      uri: 'file://a.jpg',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      idempotencyKey: 'photo-stable-2',
    });
    expect(a.id).toBe(b.id);
    expect(a.idempotencyKey).toBe('photo-stable-1');
    const items = await listTaskOutbox('t1');
    expect(items).toHaveLength(1);
    expect(pendingCount(items)).toBe(1);
  });

  it('coalesces pending notes for the same task', async () => {
    await enqueueTaskNotes({ taskId: 't1', notes: 'first', idempotencyKey: 'n1' });
    await enqueueTaskNotes({ taskId: 't1', notes: 'second', idempotencyKey: 'n2' });
    const items = await listTaskOutbox('t1');
    expect(items.filter((i) => i.kind === 'notes')).toHaveLength(1);
    expect((items[0]!.payload as { notes: string }).notes).toBe('second');
  });

  it('tracks failed and conflict states for retry UI', async () => {
    const item = await enqueueTaskPhoto({
      taskId: 't2',
      productionOrderId: 'po2',
      uri: 'file://b.jpg',
      fileName: 'b.jpg',
      mimeType: 'image/jpeg',
    });
    await updateOutboxItem(item.id, { status: 'failed', lastError: 'network' });
    let items = await listTaskOutbox('t2');
    expect(pendingCount(items)).toBe(1);
    await updateOutboxItem(item.id, { status: 'conflict' });
    items = await listTaskOutbox('t2');
    expect(pendingCount(items)).toBe(0);
    expect(items[0]!.status).toBe('conflict');
    await removeOutboxItem(item.id);
    expect(await listTaskOutbox('t2')).toHaveLength(0);
  });
});
