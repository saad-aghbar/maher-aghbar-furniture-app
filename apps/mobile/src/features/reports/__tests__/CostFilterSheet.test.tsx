import { Dimensions } from 'react-native';
import { CostFilterSheet } from '../components/CostFilterSheet';
import { EMPTY_COST_FILTER } from '../costFilters';
import { HARNESS_WINDOW } from '@/test/harnessScopes';
import {
  assertFitContentDoesNotExceedCap,
  assertFooterActionHitTestable,
  assertSheetHeightContract,
  renderSheet,
  resolveSheetHeightCap,
} from '@/test/sheetHarness';

describe('CostFilterSheet geometry', () => {
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

  it('stays inside the height cap and the apply action works', async () => {
    const onApply = jest.fn();
    const view = await renderSheet(
      <CostFilterSheet
        open
        onClose={() => {}}
        value={EMPTY_COST_FILTER}
        onChange={() => {}}
        onApply={onApply}
        onReset={() => {}}
        onPickDealer={() => {}}
        dealerLabel="All dealers"
        productLabel={null}
      />,
    );
    assertSheetHeightContract(view, { maxHeight: 520 });
    assertFitContentDoesNotExceedCap(view);
    assertFooterActionHitTestable(view, 'Apply');
    expect(onApply).toHaveBeenCalled();
  });

  it('keyboard-open cap shrinks below the default 70% window', () => {
    const defaultCap = resolveSheetHeightCap({ windowHeight: HARNESS_WINDOW.height });
    const withKeyboard = resolveSheetHeightCap({
      windowHeight: HARNESS_WINDOW.height,
      keyboardHeight: 320,
    });
    expect(withKeyboard).toBeLessThan(defaultCap);
    expect(withKeyboard).toBeGreaterThan(0);
  });
});
