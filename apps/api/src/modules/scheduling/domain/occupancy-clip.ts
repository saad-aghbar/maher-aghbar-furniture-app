/** Live occupancy: paused/blocked work only occupies up to the pause instant. */

export function clipLiveOccupancy(input: {
  start: Date;
  end: Date;
  now: Date;
  taskStatus?: string | null;
  pauseAt?: Date | null;
}): { start: Date; end: Date } | null {
  let end = input.end;
  if (input.taskStatus === 'PAUSED' || input.taskStatus === 'BLOCKED') {
    const cut = input.pauseAt ?? input.now;
    end = new Date(Math.min(input.end.getTime(), cut.getTime(), input.now.getTime()));
  }
  if (end.getTime() <= input.start.getTime()) return null;
  return { start: input.start, end };
}

/** Open pause shown on the worker-day timeline — not occupancy. */
export function pauseVisualWindow(input: {
  plannedEnd: Date;
  now: Date;
  taskStatus?: string | null;
  pauseAt?: Date | null;
}): { start: Date; end: Date } | null {
  if (input.taskStatus !== 'PAUSED' && input.taskStatus !== 'BLOCKED') return null;
  if (!input.pauseAt) return null;
  const visEnd = new Date(Math.min(input.now.getTime(), input.plannedEnd.getTime()));
  if (visEnd.getTime() <= input.pauseAt.getTime()) return null;
  return { start: input.pauseAt, end: visEnd };
}
