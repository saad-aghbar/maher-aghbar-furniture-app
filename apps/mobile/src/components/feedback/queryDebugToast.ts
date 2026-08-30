/** React Query persist / dehydrate noise — never surface in the branded toast. */
const QUERY_DEBUG =
  /dehydrat|hydrat(e|ion)|failed to persist|persist failed|query persister|persister/i;

export function isQueryDebugToastMessage(message: string): boolean {
  return QUERY_DEBUG.test(message.trim());
}
