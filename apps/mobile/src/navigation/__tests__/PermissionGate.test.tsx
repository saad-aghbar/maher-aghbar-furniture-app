import { Text } from 'react-native';
import type { AuthUser } from '@maher/types';
import { renderScreen } from '@/test/screenHarness';
import { PermissionGate } from '../PermissionGate';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      username: 'nile',
      permissions: ['catalog.read'],
    },
  }),
}));

const user: AuthUser = {
  id: '1',
  username: 'nile',
  email: 'a@b.c',
  name: 'Nile',
  roles: [],
  permissions: ['catalog.read'],
  preferredLanguage: 'en',
};

describe('PermissionGate', () => {
  it('renders children when the user has the required permission', async () => {
    const view = await renderScreen(
      <PermissionGate user={user} require="catalog.read" mode="all">
        <Text>Catalog</Text>
      </PermissionGate>,
    );
    expect(view.getByText('Catalog')).toBeTruthy();
  });

  it('hides children without the required permission', async () => {
    const view = await renderScreen(
      <PermissionGate user={user} require="sales-order.read" mode="all">
        <Text>Secret</Text>
      </PermissionGate>,
    );
    expect(view.queryByText('Secret')).toBeNull();
  });
});
