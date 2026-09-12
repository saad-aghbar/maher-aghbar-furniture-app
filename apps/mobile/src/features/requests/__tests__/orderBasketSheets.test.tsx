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
});
