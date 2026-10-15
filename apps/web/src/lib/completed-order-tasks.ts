import { ApiClientError, apiFetch } from './api-client';

type OrderTask = {
  id: string;
  salesOrderId?: string | null;
  productionOrder?: {
    salesOrderId?: string | null;
    salesOrder?: { id?: string } | null;
  } | null;
};
type TaskPage<T> = { data?: T[]; meta?: { totalPages?: number } };

/** Read the whole history, including older API versions without the parent filter. */
export async function loadCompletedOrderTasks<T extends OrderTask>(
  salesOrderId: string,
  fetchPage: (path: string) => Promise<TaskPage<T>> = (path) => apiFetch<TaskPage<T>>(path),
): Promise<T[]> {
  const base = '/api/v1/tasks?mine=true&scope=completed&pageSize=100';
  let path = `${base}&salesOrderId=${encodeURIComponent(salesOrderId)}`;
  let first: TaskPage<T>;
  try {
    first = await fetchPage(`${path}&page=1`);
  } catch (error) {
    // Compatibility with the still-running old API, never a fallback for an
    // auth/server error or a failure halfway through loading the history.
    const validation = error instanceof ApiClientError
      ? `${error.message} ${JSON.stringify(error.body?.fieldErrors ?? {})}`
      : '';
    if (!(error instanceof ApiClientError) || error.status !== 400 ||
        !/salesOrderId/i.test(validation) ||
        !/should not exist|not allowed|unknown|not recognized|unexpected/i.test(validation)) {
      throw error;
    }
    path = base;
    first = await fetchPage(`${path}&page=1`);
  }

  const tasks = new Map<string, T>();
  let page = 1;
  let response = first;
  for (;;) {
    const data = response.data ?? [];
    for (const task of data) {
      if (task.salesOrderId === salesOrderId || task.productionOrder?.salesOrderId === salesOrderId ||
          task.productionOrder?.salesOrder?.id === salesOrderId) {
        tasks.set(task.id, task);
      }
    }
    const totalPages = response.meta?.totalPages;
    if (totalPages != null ? page >= totalPages : data.length < 100) break;
    page += 1;
    response = await fetchPage(`${path}&page=${page}`);
  }
  return [...tasks.values()];
}
