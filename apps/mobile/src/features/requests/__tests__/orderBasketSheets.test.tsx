import { Dimensions } from 'react-native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { emptyOrderLine } from '../newOrderLine';
import { NamedPickerSheet } from '../components/NamedPickerSheet';
import { OrderLineSpecSheet } from '../components/OrderLineSpecSheet';
import { HARNESS_WINDOW } from '@/test/harnessScopes';
import {
  assertFitContentDoesNotExceedCap,
  assertFooterActionHitTestable,
  assertSheetHeightContract,
  renderSheet,
} from '@/test/sheetHarness';

describe('dealer basket sheets', () => {
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

  it('keeps the variant picker inside the height contract', async () => {
    const view = await renderSheet(
      <NamedPickerSheet
        open
        onClose={() => undefined}
        title="Variant"
        rows={[
          { id: 'v-250', name: 'Ukrainian', caption: '250' },
          { id: 'v-std', name: 'Standard' },
        ]}
        selectedId="v-250"
        onSelect={() => undefined}
      />,
    );
    assertSheetHeightContract(view);
    assertFitContentDoesNotExceedCap(view);
    assertFooterActionHitTestable(view, 'None');
  });

  it('keeps the line spec editor inside the height contract with keyboard-sized window', async () => {
    const view = await renderSheet(
      <OrderLineSpecSheet
        open
        onClose={() => undefined}
        line={emptyOrderLine({ customProductName: 'Karina', variantLabel: 'Ukrainian' })}
        onChange={() => undefined}
        variants={[]}
        groups={[]}
        values={[]}
      />,
    );
    assertSheetHeightContract(view);
    assertFitContentDoesNotExceedCap(view);
    assertFooterActionHitTestable(view, 'Close');
  });

  it('opens the nested variant picker as an overlay without throwing', async () => {
    const view = await renderSheet(
      <OrderLineSpecSheet
        open
        onClose={() => undefined}
        line={emptyOrderLine({ customProductName: 'Karina', variantLabel: 'Ukrainian' })}
        onChange={() => undefined}
        variants={[
          {
            id: 'v-250',
            productId: 'p1',
            sku: 'SOF-UKR',
            code: 'UKR',
            nameAr: 'أوكرانيه',
            nameEn: 'Ukrainian',
            isDefault: false,
            isActive: true,
            sortOrder: 0,
            options: [],
          },
        ]}
        groups={[]}
        values={[]}
      />,
    );
    fireEvent.press(view.getByTestId('order-line-variant'));
    await waitFor(() => {
      expect(view.getByTestId('named-pick-v-250')).toBeTruthy();
    });
  });

  it('lets the dealer type a fabric name that is not on the list', async () => {
    const onSelect = jest.fn();
    const view = await renderSheet(
      <NamedPickerSheet
        open
        onClose={() => undefined}
        title="Fabric"
        allowCustom
        rows={[{ id: 'fab-linen', name: 'Linen Beige', caption: 'FAB-LINEN' }]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    expect(view.getByTestId('named-pick-custom')).toBeTruthy();
    expect(view.getByTestId('named-pick-custom-input')).toBeTruthy();
    expect(view.getByTestId('named-pick-search')).toBeTruthy();
    expect(view.getByTestId('named-pick-fab-linen')).toBeTruthy();
    expect(view.queryByText('FAB-LINEN')).toBeNull();
    fireEvent.changeText(view.getByTestId('named-pick-custom-input'), 'my velvet');
    expect(view.getByTestId('named-pick-fab-linen')).toBeTruthy();
    await waitFor(() => {
      fireEvent.press(view.getByTestId('named-pick-custom'));
      expect(onSelect).toHaveBeenCalledWith(null, 'my velvet');
    });
  });

  it('lets the dealer type a colour that is not on the list', async () => {
    const onSelect = jest.fn();
    const view = await renderSheet(
      <NamedPickerSheet
        open
        onClose={() => undefined}
        title="Colour"
        allowCustom
        customHint="type your own colour, or pick one below."
        customPlaceholder="your colour"
        rows={[{ id: 'col-beige', name: 'Beige', caption: 'COL-BEIGE' }]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    await waitFor(() => {
      expect(view.getByTestId('named-pick-custom-input')).toBeTruthy();
    });
    expect(view.getByTestId('named-pick-search')).toBeTruthy();
    expect(view.queryByText('COL-BEIGE')).toBeNull();
    fireEvent.changeText(view.getByTestId('named-pick-custom-input'), 'sand');
    await waitFor(() => {
      fireEvent.press(view.getByTestId('named-pick-custom'));
      expect(onSelect).toHaveBeenCalledWith(null, 'sand');
    });
  });
});
