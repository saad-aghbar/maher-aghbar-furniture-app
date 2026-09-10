import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { TaskRecoveryFloorSection } from '../components/TaskRecoveryFloorSection';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [] }),
}));

jest.mock('@/components/feedback/Toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('@/features/returns/query', () => ({
  useReturnQuery: () => ({ data: { pieces: [] } }),
  useRecordRecoveryLineMutation: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useUpdateRecoveryLineMutation: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useDeleteRecoveryLineMutation: () => ({ mutate: jest.fn(), isPending: false }),
  usePostRecoveryLineMutation: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/features/catalog/components/BomMaterialPickerSheet', () => ({
  BomMaterialPickerSheet: () => null,
}));

jest.mock('@/features/purchasing/components/DestinationPickSheet', () => ({
  DestinationPickSheet: () => null,
}));

jest.mock('../components/RecoveryOutcomeTouchBar', () => ({
  RECOVERY_OUTCOMES: ['RECOVER_TO_INVENTORY', 'DISPOSE', 'DAMAGED'],
  RecoveryOutcomeTouchBar: () => null,
}));

jest.mock('@/motion', () => {
  const { Pressable, View } = require('react-native');
  return {
    haptics: {
      selection: jest.fn(),
      confirmLight: jest.fn(),
      confirmMedium: jest.fn(),
      error: jest.fn(),
    },
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

describe('TaskRecoveryFloorSection', () => {
  it('shows the empty recovery board', async () => {
    const view = await render(
      <Wrapper>
        <TaskRecoveryFloorSection
          taskId="task-1"
          returnRequestId="ret-1"
          returnPieceId="p1"
          previewLines={[]}
        />
      </Wrapper>,
    );
    expect(view.getByText('No recovered or discarded parts yet.')).toBeTruthy();
    expect(view.getByLabelText('Log recovered parts')).toBeTruthy();
  });

  it('lets an unposted line be posted by label', async () => {
    const view = await render(
      <Wrapper>
        <TaskRecoveryFloorSection
          taskId="task-1"
          returnRequestId="ret-1"
          returnPieceId="p1"
          previewLines={[
            {
              id: 'line-1',
              label: 'Foam offcut',
              quantity: 1,
              unit: 'pcs',
              outcome: 'DISPOSE',
              postedAt: null,
            },
          ]}
        />
      </Wrapper>,
    );
    expect(view.getByText('Foam offcut')).toBeTruthy();
    expect(view.getByLabelText('Post to inventory')).toBeTruthy();
  });
});
