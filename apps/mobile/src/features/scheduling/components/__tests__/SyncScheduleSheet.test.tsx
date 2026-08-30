import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { SyncScheduleSheet } from '../AdminScheduleSheets';

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

describe('SyncScheduleSheet', () => {
  it('asks for confirmation before posting', async () => {
    const view = await render(
      <SyncScheduleSheet open phase="confirm" onClose={() => undefined} onConfirm={() => undefined} />,
      { wrapper: Wrapper },
    );
    expect(view.getByText(/This checks all active production schedules/)).toBeTruthy();
    expect(view.getByText('Sync schedule')).toBeTruthy();
    expect(view.queryByText('No schedules needed changes.')).toBeNull();
  });

  it('shows already-up-to-date copy, not a generic complete', async () => {
    const view = await render(
      <SyncScheduleSheet
        open
        phase="upToDate"
        stats={{
          scanned: 40,
          alreadyValid: 40,
          generated: 0,
          replanned: 0,
          pastDueRescheduled: 0,
          atRiskRecovered: 0,
          stillAttention: 0,
          conflictsResolved: 0,
          newConflictsIntroduced: 0,
          blockedItems: [],
          manualAttentionItems: [],
        }}
        onClose={() => undefined}
      />,
      { wrapper: Wrapper },
    );
    expect(view.getByText('No schedules needed changes.')).toBeTruthy();
    expect(view.queryByText('Schedule sync complete')).toBeNull();
  });

  it('lists remaining attention on a partial result', async () => {
    const view = await render(
      <SyncScheduleSheet
        open
        phase="partial"
        stats={{
          scanned: 8,
          alreadyValid: 5,
          generated: 0,
          replanned: 1,
          pastDueRescheduled: 0,
          atRiskRecovered: 0,
          stillAttention: 2,
          conflictsResolved: 0,
          newConflictsIntroduced: 0,
          blockedItems: [{ number: 'PO-MAT', blockerKind: 'MATERIAL_NOT_READY' }],
          manualAttentionItems: [{ number: 'PO-PIN' }],
        }}
        onClose={() => undefined}
        onViewAttention={() => undefined}
      />,
      { wrapper: Wrapper },
    );
    expect(view.getByText('View attention items')).toBeTruthy();
    expect(view.getByText(/PO-MAT/)).toBeTruthy();
  });
});
