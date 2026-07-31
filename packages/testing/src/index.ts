export function createTestId(prefix: string, id: string | number): string {
  return `${prefix}-${id}`;
}

export const TEST_TIMEOUT_MS = 10_000;
