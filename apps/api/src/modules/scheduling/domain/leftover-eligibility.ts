export function leftoverRemainingMinutes(
  estimated: number | null | undefined,
  elapsed: number,
): number {
  const spent = Math.max(0, elapsed);
  if (estimated != null && estimated > 0) return Math.max(1, estimated - spent);
  return 30;
}

export function isLastSameWorkerWindowToday(input: {
  taskId: string;
  employeeId: string | null | undefined;
  allocations: Array<{
    taskId: string | null;
    employeeId: string | null;
    plannedStart: Date;
  }>;
  localYmd: (d: Date) => string;
}): boolean {
  if (!input.employeeId) return false;
  const source = input.allocations.find(
    (a) => a.taskId === input.taskId && a.employeeId === input.employeeId,
  );
  if (!source) return false;
  const dayYmd = input.localYmd(source.plannedStart);
  return !input.allocations.some(
    (a) =>
      a.taskId != null &&
      a.taskId !== source.taskId &&
      a.employeeId === input.employeeId &&
      input.localYmd(a.plannedStart) === dayYmd &&
      a.plannedStart.getTime() > source.plannedStart.getTime(),
  );
}

export function canOfferLeftover(input: {
  status: string;
  isLastWindowToday: boolean;
}): boolean {
  return (input.status === 'IN_PROGRESS' || input.status === 'PAUSED') && input.isLastWindowToday;
}
