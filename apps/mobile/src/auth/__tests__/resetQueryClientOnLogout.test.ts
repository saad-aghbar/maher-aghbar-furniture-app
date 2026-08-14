import { QueryClient } from '@tanstack/react-query';
import { resetQueryClientOnLogout } from '../resetQueryClientOnLogout';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    removeItem: jest.fn(async () => undefined),
  },
  removeItem: jest.fn(async () => undefined),
}));

describe('resetQueryClientOnLogout', () => {
  it('clears cached modules so the next user cannot inherit them', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['reports', 'admin-home'], { leaked: true });
    qc.setQueryData(['inventory', 'overview'], { leaked: true });
    await resetQueryClientOnLogout(qc);
    expect(qc.getQueryData(['reports', 'admin-home'])).toBeUndefined();
    expect(qc.getQueryData(['inventory', 'overview'])).toBeUndefined();
  });
});
