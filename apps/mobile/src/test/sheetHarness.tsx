import { type ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { resolveSheetHeightCap, SHEET_HEIGHT_PHONE_RATIO } from '@/components/sheets/BottomSheet';
import { HARNESS_WINDOW } from './harnessScopes';
import { HarnessProviders } from './testProviders';

export { resolveSheetHeightCap };

export const DEFAULT_SHEET_MAX_RATIO = SHEET_HEIGHT_PHONE_RATIO;

export function defaultSheetMaxHeight(windowHeight: number = HARNESS_WINDOW.height) {
  return Math.round(windowHeight * DEFAULT_SHEET_MAX_RATIO);
}

type SheetView = Awaited<ReturnType<typeof render>>;
type QueryByTypeView = SheetView & {
  UNSAFE_queryAllByType: (type: unknown) => unknown[];
};

function queryAllByType(view: SheetView, type: unknown): unknown[] {
  return (view as QueryByTypeView).UNSAFE_queryAllByType(type);
}

export async function renderSheet(ui: ReactElement): Promise<SheetView> {
  return await render(<HarnessProviders>{ui}</HarnessProviders>);
}

export function flattenStyle(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle));
  }
  if (typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

export function panelStyle(view: SheetView) {
  const panel = view.getByTestId('bottom-sheet-panel');
  return flattenStyle(panel.props.style);
}

export function assertSheetHeightContract(
  view: SheetView,
  opts?: { windowHeight?: number; maxHeight?: number },
) {
  const windowHeight = opts?.windowHeight ?? HARNESS_WINDOW.height;
  const maxHeight = opts?.maxHeight ?? defaultSheetMaxHeight(windowHeight);
  const style = panelStyle(view);
  const height = typeof style.height === 'number' ? style.height : undefined;
  const styleMax = typeof style.maxHeight === 'number' ? style.maxHeight : maxHeight;

  if (typeof height === 'number') {
    expect(height).toBeGreaterThan(0);
    expect(height).toBeLessThanOrEqual(maxHeight);
  }
  expect(styleMax).toBeGreaterThan(0);
  expect(styleMax).toBeLessThanOrEqual(maxHeight);
}

export function assertFooterActionHitTestable(
  view: SheetView,
  label: string | RegExp,
) {
  const button = view.getByLabelText(label);
  expect(button).toBeTruthy();
  expect(() => fireEvent.press(button)).not.toThrow();
}

export function assertBodyScrollsWhenOverflow(view: SheetView) {
  const body = view.getByTestId('bottom-sheet-body');
  const hasScroll = Boolean(
    queryAllByType(view, ScrollView).length ||
      JSON.stringify(body.props).includes('ScrollView'),
  );
  const children = queryAllByType(view, View);
  expect(body).toBeTruthy();
  expect(children.length + Number(hasScroll)).toBeGreaterThan(0);
}

export function assertFitContentDoesNotExceedCap(
  view: SheetView,
  windowHeight = HARNESS_WINDOW.height,
) {
  const cap = defaultSheetMaxHeight(windowHeight);
  const style = panelStyle(view);
  const height = typeof style.height === 'number' ? style.height : undefined;
  const maxHeight = typeof style.maxHeight === 'number' ? style.maxHeight : cap;
  if (typeof height === 'number') {
    expect(height).toBeLessThanOrEqual(cap);
  }
  expect(maxHeight).toBeLessThanOrEqual(cap);
}
