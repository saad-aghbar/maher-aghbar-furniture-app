import { QueryClient } from '@tanstack/react-query';
import { type ReactElement } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HarnessProviders, createHarnessQueryClient } from './testProviders';

type ScreenView = Awaited<ReturnType<typeof render>>;

export type MockRouter = {
  push: jest.Mock;
  replace: jest.Mock;
  back: jest.Mock;
  canGoBack: jest.Mock;
};

export const mockRouter: MockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

export function resetMockRouter() {
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.back.mockReset();
  mockRouter.canGoBack.mockReset();
  mockRouter.canGoBack.mockReturnValue(true);
}

export async function renderScreen(
  ui: ReactElement,
  opts?: { locale?: 'en' | 'ar' | 'he'; queryClient?: QueryClient },
): Promise<ScreenView> {
  const queryClient = opts?.queryClient ?? createHarnessQueryClient();
  return await render(
    <HarnessProviders locale={opts?.locale} queryClient={queryClient}>
      {ui}
    </HarnessProviders>,
  );
}

function pressableLabel(node: { props?: Record<string, unknown> }): string | null {
  const props = node.props ?? {};
  const label = props.accessibilityLabel ?? props.testID;
  return typeof label === 'string' && label.trim() ? label : null;
}

function isDisabled(node: { props?: Record<string, unknown> }): boolean {
  const props = node.props ?? {};
  if (props.disabled === true) return true;
  const state = props.accessibilityState as { disabled?: boolean } | undefined;
  return Boolean(state?.disabled);
}

/**
 * Collects role=button pressables and asserts each has a label and a handler
 * that fires without throwing. Disabled buttons are labelled but not pressed.
 */
export function expectEveryActionWired(view: ScreenView) {
  const queryAll =
    typeof view.queryAllByRole === 'function'
      ? view.queryAllByRole.bind(view)
      : typeof (view as { getAllByRole?: Function }).getAllByRole === 'function'
        ? (role: string) => (view as { getAllByRole: (role: string) => unknown[] }).getAllByRole(role)
        : () => [];
  const buttons = queryAll('button') as Array<{ props?: Record<string, unknown> }>;
  expect(buttons.length).toBeGreaterThan(0);
  const unlabeled: string[] = [];
  for (const btn of buttons) {
    const label = pressableLabel(btn);
    if (!label) {
      unlabeled.push(JSON.stringify(btn.props).slice(0, 160));
      continue;
    }
    if (isDisabled(btn)) continue;
    expect(() => fireEvent.press(btn as never)).not.toThrow();
  }
  expect(unlabeled).toEqual([]);
}
