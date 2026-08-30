import { isQueryDebugToastMessage } from '../queryDebugToast';

describe('isQueryDebugToastMessage', () => {
  it('drops React Query dehydrate / persist noise', () => {
    expect(isQueryDebugToastMessage('Failed to dehydrate query')).toBe(true);
    expect(isQueryDebugToastMessage('Error: hydration failed')).toBe(true);
    expect(isQueryDebugToastMessage('Failed to persist query cache')).toBe(true);
    expect(isQueryDebugToastMessage('query persister error')).toBe(true);
  });

  it('keeps real user-facing errors', () => {
    expect(isQueryDebugToastMessage('Request failed')).toBe(false);
    expect(isQueryDebugToastMessage('Network offline')).toBe(false);
    expect(isQueryDebugToastMessage('')).toBe(false);
  });
});
