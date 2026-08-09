/** Generate a request id for `x-request-id` (UUID-ish, no crypto dependency). */
export function createRequestId(): string {
  const rand = Math.random().toString(16).slice(2);
  const time = Date.now().toString(16);
  return `${time}-${rand}`.slice(0, 36);
}
