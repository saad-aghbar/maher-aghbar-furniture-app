import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { ResolveAllAtRiskSheet } from '../AdminScheduleSheets';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
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

describe('ResolveAllAtRiskSheet', () => {
  it('renders grouped remaining reasons with unique keys and a Done action', async () => {
    const view = await render(
      <ResolveAllAtRiskSheet
        open
        onClose={() => undefined}
        result={{
          resolvedAutomatically: 0,
          stillNeedsAttention: 8,
          alreadyOnTrack: 0,
          remaining: 8,
          reasonGroups: [
            {
              key: 'mobile.adminScheduling.atRisk.committedCannotBeMet',
              label: 'Committed date cannot be met',
              count: 5,
            },
            {
              key: 'mobile.adminScheduling.reasons.wipNotReady',
              label: 'Work-in-progress not ready',
              count: 3,
            },
          ],
        }}
      />,
      { wrapper: Wrapper },
    );

    expect(view.getByText('Committed date cannot be met')).toBeTruthy();
    expect(view.getByText('Work-in-progress not ready')).toBeTruthy();
    expect(view.getByText('5 orders')).toBeTruthy();
    expect(view.getByText('3 orders')).toBeTruthy();
    expect(view.getByText('Why they remain')).toBeTruthy();
    expect(view.getByText('Done')).toBeTruthy();
    expect(view.queryByText('Cancel')).toBeNull();
  });
});
