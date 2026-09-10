import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { classifyTaskQualityKind, isRecoveryFinishBlocked } from '@/features/quality/taskQualityKind';
import { DismantleRecoverFloorPanel } from '../components/DismantleRecoverFloorPanel';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={insets}>
      <ThemeProvider initialMode="light">
        <LocaleProvider initialLocale="en">{children}</LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('dismantle recover task body', () => {
  it('classifies the stage as recovery and hides production chrome', () => {
    expect(classifyTaskQualityKind({ stageCode: 'DISMANTLE_RECOVER' })).toBe('recovery');
    expect(classifyTaskQualityKind({ stageCode: 'CARPENTRY' })).toBe('production');
  });

  it('blocks finish until every recovery line is posted', () => {
    expect(isRecoveryFinishBlocked([])).toBe(true);
    expect(isRecoveryFinishBlocked([{ postedAt: null }])).toBe(true);
    expect(isRecoveryFinishBlocked([{ postedAt: '2026-01-01T00:00:00.000Z' }])).toBe(false);
  });

  it('renders the recovery identity panel', async () => {
    const view = await render(
      <Wrapper>
        <DismantleRecoverFloorPanel
          returnNumber="RT-DEMO-PIECE-001"
          pieceCode="P3"
          productDesc="Returned sofa"
          finishBlocked
        />
      </Wrapper>,
    );
    expect(view.getByLabelText('This piece')).toBeTruthy();
    expect(view.getByText('Return RT-DEMO-PIECE-001')).toBeTruthy();
    expect(view.getByText('Piece P3')).toBeTruthy();
    expect(view.getByText('Finish only after every recovery line is posted.')).toBeTruthy();
    expect(view.queryByText('Bill of materials')).toBeNull();
  });
});
