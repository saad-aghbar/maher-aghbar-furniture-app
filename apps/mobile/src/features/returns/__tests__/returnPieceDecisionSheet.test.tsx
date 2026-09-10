import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { ReturnPieceDecisionSheet } from '../components/ReturnPieceDecisionSheet';
import type { ReturnPiece } from '../api';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

jest.mock('@/motion', () => {
  const { Pressable, View } = require('react-native');
  return {
    haptics: { selection: jest.fn(), confirmMedium: jest.fn(), error: jest.fn() },
    AnimatedPressable: ({ children, ...props }: { children?: ReactNode }) => (
      <Pressable {...props}>{children}</Pressable>
    ),
    ListItemEnter: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
  };
});

jest.mock('@/components/sheets/BottomSheet', () => {
  const { Text, View } = require('react-native');
  return {
    BottomSheet: ({ children, title }: { children: ReactNode; title?: string }) => (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
      </View>
    ),
  };
});

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

const pieces: ReturnPiece[] = [
  {
    id: 'p1',
    pieceNo: 1,
    code: 'RET-1-P1',
    productDesc: 'Sofa',
    state: 'RECEIVED',
  },
  {
    id: 'p2',
    pieceNo: 2,
    code: 'RET-1-P2',
    productDesc: 'Chair',
    state: 'RECEIVED',
  },
];

describe('ReturnPieceDecisionSheet', () => {
  it('drives one decision per piece with no quantity field', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <Wrapper>
        <ReturnPieceDecisionSheet
          open
          returnNumber="RET-1"
          pieces={pieces}
          onClose={() => undefined}
          onConfirm={onConfirm}
        />
      </Wrapper>,
    );
    expect(view.queryByText(/quantity/i)).toBeNull();
    await act(async () => {
      fireEvent.press(view.getAllByLabelText('Repair')[0]!);
      fireEvent.press(view.getAllByLabelText('Replace')[1]!);
    });
    await waitFor(() => {
      expect(view.getByLabelText('Review decisions').props.accessibilityState?.disabled).toBe(false);
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Review decisions'));
    });
    await waitFor(() => {
      expect(view.getByLabelText('Confirm factory decisions')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(view.getByLabelText('Confirm factory decisions'));
    });
    expect(onConfirm).toHaveBeenCalledWith([
      { pieceId: 'p1', decision: 'REPAIR' },
      { pieceId: 'p2', decision: 'REPLACEMENT' },
    ]);
  });

  it('shows the empty state when no piece is waiting for a decision', async () => {
    const view = await render(
      <Wrapper>
        <ReturnPieceDecisionSheet
          open
          pieces={[{ ...pieces[0]!, state: 'IN_PROGRESS', decision: 'REPAIR' }]}
          onClose={() => undefined}
          onConfirm={() => undefined}
        />
      </Wrapper>,
    );
    expect(view.getByLabelText('Review decisions').props.accessibilityState?.disabled).toBe(true);
    expect(view.queryByLabelText('Repair')).toBeNull();
  });
});
