import { Dimensions } from 'react-native';
import { cleanup, fireEvent } from '@testing-library/react-native';
import { CostFilterSheet, costFilterSheetMaxHeight } from '../components/CostFilterSheet';
import { EMPTY_COST_FILTER } from '../costFilters';
import { HARNESS_WINDOW } from '@/test/harnessScopes';
import {
  assertFooterActionHitTestable,
  assertSheetHeightContract,
  renderSheet,
  resolveSheetHeightCap,
} from '@/test/sheetHarness';

const DEALERS = [
  { id: 'd1', name: 'Nile Living', searchText: 'nile living', code: 'NILE' },
  { id: 'd2', name: 'Cedar House', searchText: 'cedar house', code: 'CEDAR' },
];

const PRODUCTS = [
  { id: 'p1', name: 'Karina sofa', searchText: 'karina sofa KARINA', code: 'KARINA' },
  { id: 'p2', name: 'Luna chair', searchText: 'luna chair LUNA', code: 'LUNA' },
];

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

  afterEach(() => {
    cleanup();
  });

  it('lists return lifecycle states instead of sales-order statuses', async () => {
    const onChange = jest.fn();
    const view = await renderSheet(
      <CostFilterSheet
        open
        desk="returns"
        onClose={() => {}}
        value={EMPTY_COST_FILTER}
        onChange={onChange}
        onApply={() => {}}
        onReset={() => {}}
        dealers={DEALERS}
        products={PRODUCTS}
      />,
    );
    expect(view.queryByLabelText('In production')).toBeNull();
    expect(view.getByTestId('cost-filter-return-status-REQUESTED')).toBeTruthy();
    expect(view.getByTestId('cost-filter-option-list')).toBeTruthy();
    fireEvent.press(view.getByTestId('cost-filter-return-status-REQUESTED'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'REQUESTED' }));
  });

  it('stays inside the height cap and the apply action works', async () => {
    const onApply = jest.fn();
    const view = await renderSheet(
      <CostFilterSheet
        open
        desk="orders"
        onClose={() => {}}
        value={EMPTY_COST_FILTER}
        onChange={() => {}}
        onApply={onApply}
        onReset={() => {}}
        dealers={DEALERS}
        products={PRODUCTS}
      />,
    );
    const maxHeight = costFilterSheetMaxHeight(HARNESS_WINDOW.height);
    assertSheetHeightContract(view, { maxHeight });
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

  it('keeps dealer and product lists in nested scroll boxes and sets productId', async () => {
    const onChange = jest.fn();
    const view = await renderSheet(
      <CostFilterSheet
        open
        desk="orders"
        onClose={() => {}}
        value={EMPTY_COST_FILTER}
        onChange={onChange}
        onApply={() => {}}
        onReset={() => {}}
        dealers={DEALERS}
        products={PRODUCTS}
      />,
    );
    expect(view.getAllByTestId('cost-filter-search-list').length).toBeGreaterThanOrEqual(2);
    fireEvent.press(view.getByLabelText('Karina sofa'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ productId: 'p1' }));
    fireEvent.press(view.getByLabelText('Nile Living'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'd1' }));
  });
});
