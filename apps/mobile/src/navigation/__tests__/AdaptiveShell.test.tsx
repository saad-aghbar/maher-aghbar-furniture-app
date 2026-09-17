import { Text } from 'react-native';
import { renderAdaptive } from '@/test/adaptiveHarness';
import { AdaptiveShell } from '../AdaptiveShell';

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    usePathname: () => '/(app)/(admin)/(tabs)',
    useRouter: () => ({
      navigate: jest.fn(),
      replace: jest.fn(),
      push: jest.fn(),
      setParams: jest.fn(),
    }),
  };
});

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: {
      id: '1',
      username: 'admin',
      email: 'a@b.c',
      name: 'Admin',
      roles: ['SYSTEM_ADMINISTRATOR'],
      permissions: [
        'sales-order.read',
        'inventory.read',
        'production-order.read',
        'user.manage',
        'catalog.read',
        'customer.read',
        'invoice.read',
      ],
      preferredLanguage: 'en',
    },
  }),
}));

describe('AdaptiveShell chrome', () => {
  it('keeps the stack child mounted across compact → wide resize', async () => {
    const view = await renderAdaptive(
      <AdaptiveShell surface="admin">
        <Text testID="stack-child">stack</Text>
      </AdaptiveShell>,
      { width: 390, surface: 'admin' },
    );
    expect(view.getByTestId('stack-child')).toBeTruthy();
    expect(view.getByTestId('admin-side-nav-placeholder')).toBeTruthy();
    await view.rerenderAt(1440);
    expect(view.getByTestId('stack-child')).toBeTruthy();
  });

  it('hides the bottom pill when admin chrome is a rail or sidebar', async () => {
    const view = await renderAdaptive(
      <AdaptiveShell surface="admin">
        <Text>x</Text>
      </AdaptiveShell>,
      { width: 1024, surface: 'admin' },
    );
    expect(view.queryByTestId('admin-side-nav-placeholder')).toBeNull();
  });
});
