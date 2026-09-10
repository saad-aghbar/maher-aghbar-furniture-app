import { ensureTaskTimeEntry } from './ensure-time-entry';

describe('ensureTaskTimeEntry', () => {
  it('creates a closed entry from actualMinutes when the table is empty', async () => {
    const tx = {
      taskTimeEntry: {
        count: jest.fn(async () => 0),
        create: jest.fn(),
      },
    };
    const end = new Date('2026-03-01T12:00:00Z');
    await expect(
      ensureTaskTimeEntry(tx as never, {
        taskId: 't1',
        userId: 'u1',
        actualMinutes: 45,
        actualCompletion: end,
      }),
    ).resolves.toEqual({ created: true });
    expect(tx.taskTimeEntry.create).toHaveBeenCalledWith({
      data: {
        taskId: 't1',
        userId: 'u1',
        startedAt: new Date(end.getTime() - 45 * 60_000),
        endedAt: end,
        minutes: 45,
      },
    });
  });

  it('does not invent an entry when minutes are missing or already captured', async () => {
    const empty = {
      taskTimeEntry: { count: jest.fn(async () => 0), create: jest.fn() },
    };
    await expect(
      ensureTaskTimeEntry(empty as never, { taskId: 't1', userId: 'u1', actualMinutes: 0 }),
    ).resolves.toEqual({ created: false });
    expect(empty.taskTimeEntry.create).not.toHaveBeenCalled();

    const already = {
      taskTimeEntry: { count: jest.fn(async () => 2), create: jest.fn() },
    };
    await expect(
      ensureTaskTimeEntry(already as never, { taskId: 't1', userId: 'u1', actualMinutes: 20 }),
    ).resolves.toEqual({ created: false });
  });
});
