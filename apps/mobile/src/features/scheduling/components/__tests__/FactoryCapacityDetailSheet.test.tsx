import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { selectFactoryCapacityCards } from '../../selectFactoryCapacity';
import { FactoryCapacityDetailSheet } from '../FactoryCapacityDetailSheet';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('@/components/sheets/BottomSheet', () => ({
  BottomSheet: ({ children }: { children: ReactNode }) => children,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialMode="light">
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    </ThemeProvider>
  );
}

function deliveryCard() {
  return selectFactoryCapacityCards(
    [
      {
        departmentId: 'stg-delivery',
        stageDefinitionId: 'stg-delivery',
        code: 'DELIVERY',
        nameEn: 'Delivery',
        nameAr: null,
        nameHe: null,
        bookedMinutes: 529,
        capacityMinutes: 1680,
        allocatedMinutes: 529,
        availableMinutes: 1680,
        remainingMinutes: 1151,
        eligibleWorkerCount: 2,
        workers: [
          {
            employeeId: 'omar',
            firstName: 'Omar',
            lastName: 'Hijazi',
            eligible: true,
            allocatedMinutes: 157,
            availableMinutes: 840,
            remainingMinutes: 683,
          },
          {
            employeeId: 'yousef',
            firstName: 'Yousef',
            lastName: 'Haddad',
            eligible: true,
            allocatedMinutes: 42,
            availableMinutes: 840,
            remainingMinutes: 798,
          },
        ],
        ineligibleWorkers: [
          {
            employeeId: 'basel',
            firstName: 'Basel',
            lastName: 'Smadi',
            eligible: false,
            allocatedMinutes: 288,
            availableMinutes: 0,
            remainingMinutes: 0,
          },
          {
            employeeId: 'anas',
            firstName: 'Anas',
            lastName: 'Freijat',
            eligible: false,
            allocatedMinutes: 42,
            availableMinutes: 0,
            remainingMinutes: 0,
          },
        ],
        unassignedAllocatedMinutes: 0,
      },
    ],
    'en',
    true,
  )[0]!;
}

describe('FactoryCapacityDetailSheet', () => {
  it('lists eligible pairs and ineligible allocated-only hours without a slash', async () => {
    const view = await render(
      <FactoryCapacityDetailSheet open onClose={() => undefined} card={deliveryCard()} />,
      { wrapper: Wrapper },
    );

    expect(view.getByText('Omar Hijazi')).toBeTruthy();
    expect(view.getByText('Yousef Haddad')).toBeTruthy();
    expect(view.getByText('Basel Smadi')).toBeTruthy();
    expect(view.getByText('Anas Freijat')).toBeTruthy();
    expect(view.getByText('No longer eligible')).toBeTruthy();
    expect(view.getByLabelText('2.6 hours of 14 hours')).toBeTruthy();
    expect(view.getByLabelText('0.7 hours of 14 hours')).toBeTruthy();
    expect(view.getByText('4.8h allocated')).toBeTruthy();
    expect(view.getByText('0.7h allocated')).toBeTruthy();
    expect(view.queryByLabelText('4.8 hours of 14 hours')).toBeNull();
    expect(view.queryByLabelText('4.8 hours of 0 hours')).toBeNull();
    expect(view.queryByText('Unassigned')).toBeNull();
  });

  it('hides ineligible and unassigned sections when they are empty', async () => {
    const [card] = selectFactoryCapacityCards(
      [
        {
          departmentId: 'stg-foam',
          stageDefinitionId: 'stg-foam',
          code: 'FOAM',
          nameEn: 'Foam preparation',
          bookedMinutes: 240,
          capacityMinutes: 840,
          allocatedMinutes: 240,
          availableMinutes: 840,
          remainingMinutes: 600,
          eligibleWorkerCount: 2,
          workers: [
            {
              employeeId: 'rana',
              firstName: 'Rana',
              lastName: 'Khatib',
              eligible: true,
              allocatedMinutes: 240,
              availableMinutes: 420,
              remainingMinutes: 180,
            },
          ],
        },
      ],
      'en',
      true,
    );
    const view = await render(
      <FactoryCapacityDetailSheet open onClose={() => undefined} card={card!} />,
      { wrapper: Wrapper },
    );
    expect(view.queryByText('No longer eligible')).toBeNull();
    expect(view.queryByText('Unassigned')).toBeNull();
    expect(view.getByText('Rana Khatib')).toBeTruthy();
  });

  it('shows a compact unassigned row without inventing a worker', async () => {
    const [card] = selectFactoryCapacityCards(
      [
        {
          departmentId: 'stg-delivery',
          stageDefinitionId: 'stg-delivery',
          code: 'DELIVERY',
          nameEn: 'Delivery',
          bookedMinutes: 100,
          capacityMinutes: 840,
          allocatedMinutes: 100,
          availableMinutes: 840,
          remainingMinutes: 740,
          eligibleWorkerCount: 2,
          unassignedAllocatedMinutes: 100,
        },
      ],
      'en',
      true,
    );
    const view = await render(
      <FactoryCapacityDetailSheet open onClose={() => undefined} card={card!} />,
      { wrapper: Wrapper },
    );
    expect(view.getByText('Unassigned')).toBeTruthy();
    expect(view.getByText('1.7h allocated')).toBeTruthy();
    expect(view.queryByText('No longer eligible')).toBeNull();
  });
});
