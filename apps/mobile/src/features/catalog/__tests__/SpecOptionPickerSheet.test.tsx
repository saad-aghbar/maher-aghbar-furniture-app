import { Dimensions } from 'react-native';
import { fireEvent } from '@testing-library/react-native';
import type { SpecOptionValue } from '@/api/modules/catalog';
import { SpecOptionPickerSheet } from '../components/SpecOptionPickerSheet';
import { HARNESS_WINDOW } from '@/test/harnessScopes';
import {
  assertFitContentDoesNotExceedCap,
  assertFooterActionHitTestable,
  assertSheetHeightContract,
  renderSheet,
  resolveSheetHeightCap,
} from '@/test/sheetHarness';

function value(partial: Partial<SpecOptionValue> & { id: string; code: string; nameEn: string }): SpecOptionValue {
  return {
    groupId: 'g-foam',
    nameAr: partial.nameEn,
    isActive: true,
    sortOrder: 10,
    ...partial,
  };
}

const SHORT: SpecOptionValue[] = [
  value({ id: 'v-35', code: 'D35', nameEn: 'Foam 35', nameAr: 'إسفنج 35', sortOrder: 10 }),
  value({ id: 'v-40', code: 'D40', nameEn: 'Foam 40', nameAr: 'إسفنج 40', sortOrder: 20 }),
];

const LONG: SpecOptionValue[] = Array.from({ length: 24 }, (_, i) =>
  value({
    id: `v-${i}`,
    code: `OPT-${i}`,
    nameEn: `Option ${i}`,
    nameAr: `خيار ${i}`,
    sortOrder: i,
    isActive: i !== 3,
  }),
);

describe('SpecOptionPickerSheet geometry', () => {
  beforeAll(() => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: HARNESS_WINDOW.width,
      height: HARNESS_WINDOW.height,
      scale: HARNESS_WINDOW.scale,
      fontScale: HARNESS_WINDOW.fontScale,
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('stays inside the height cap for a short list and selecting fires onSelect', async () => {
    const onSelect = jest.fn();
    const view = await renderSheet(
      <SpecOptionPickerSheet
        open
        onClose={() => {}}
        values={SHORT}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    assertSheetHeightContract(view);
    assertFitContentDoesNotExceedCap(view);
    fireEvent.press(view.getByLabelText('Foam 35'));
    expect(onSelect).toHaveBeenCalledWith('v-35');
  });

  it('confirm footer is hit-testable', async () => {
    const view = await renderSheet(
      <SpecOptionPickerSheet
        open
        onClose={() => {}}
        values={SHORT}
        selectedId="v-35"
        onSelect={() => {}}
        requireConfirm
      />,
    );
    assertFooterActionHitTestable(view, /Confirm|تأكيد|אישור/);
  });

  it('stays inside the height cap for a long list', async () => {
    const view = await renderSheet(
      <SpecOptionPickerSheet
        open
        onClose={() => {}}
        values={LONG}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    assertSheetHeightContract(view);
    expect(view.queryByLabelText('Option 3')).toBeNull();
    expect(view.getByLabelText('Option 0')).toBeTruthy();
  });

  it('keyboard-open cap shrinks below the default picker window', () => {
    const defaultCap = resolveSheetHeightCap({ windowHeight: HARNESS_WINDOW.height });
    const withKeyboard = resolveSheetHeightCap({
      windowHeight: HARNESS_WINDOW.height,
      keyboardHeight: 320,
    });
    expect(withKeyboard).toBeLessThan(defaultCap);
    expect(withKeyboard).toBeGreaterThan(0);
  });
});
