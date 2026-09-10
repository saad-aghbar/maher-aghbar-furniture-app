import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { ReturnPiecesBoard } from '../components/ReturnPiecesBoard';
import type { ReturnPiece } from '../api';

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

const piece: ReturnPiece = {
  id: 'p1',
  pieceNo: 1,
  code: 'RET-1-P1',
  productDesc: 'Sofa',
  state: 'IN_PROGRESS',
  decision: 'REPAIR',
  productionOrder: { id: 'po-rw', number: 'RW-1', status: 'PLANNED' },
};

describe('ReturnPiecesBoard', () => {
  it('shows the empty board when the case has no pieces', async () => {
    const view = await render(
      <Wrapper>
        <ReturnPiecesBoard pieces={[]} />
      </Wrapper>,
    );
    expect(view.getByText(/waiting for a decision/i)).toBeTruthy();
  });

  it('shows Open Production for a single repair piece', async () => {
    const view = await render(
      <Wrapper>
        <ReturnPiecesBoard pieces={[piece]} />
      </Wrapper>,
    );
    expect(view.getByText('RET-1-P1')).toBeTruthy();
    expect(view.getByLabelText('Open Production')).toBeTruthy();
  });

  it('hides factory CTAs on the dealer surface', async () => {
    const view = await render(
      <Wrapper>
        <ReturnPiecesBoard pieces={[piece]} dealerFacing />
      </Wrapper>,
    );
    expect(view.getByText(/Being repaired/)).toBeTruthy();
    expect(view.queryByLabelText('Open Production')).toBeNull();
  });

  it('shows quarantine written off when a recovery piece is recovered', async () => {
    const view = await render(
      <Wrapper>
        <ReturnPiecesBoard
          pieces={[
            {
              ...piece,
              decision: 'SCRAP_RECOVERY',
              state: 'RECOVERED',
              productionOrder: null,
              recoveryOrder: { id: 'po-rc', number: 'RC-1', originType: 'RETURN_RECOVERY' },
            },
          ]}
        />
      </Wrapper>,
    );
    expect(view.getByText(/quarantine written off/i)).toBeTruthy();
    expect(view.getByLabelText('Open Recovery')).toBeTruthy();
  });
});
