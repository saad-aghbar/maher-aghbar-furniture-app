import { Dimensions } from 'react-native';
import { fireEvent } from '@testing-library/react-native';
import { SpecCorrectSheet } from '../components/SpecCorrectSheet';
import { HARNESS_WINDOW } from '@/test/harnessScopes';
import {
  assertFitContentDoesNotExceedCap,
  assertFooterActionHitTestable,
  assertSheetHeightContract,
  renderSheet,
} from '@/test/sheetHarness';

describe('spec correction sheet', () => {
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

  it('keeps the correction sheet inside the height contract and saves fields', async () => {
    const onSave = jest.fn();
    const view = await renderSheet(
      <SpecCorrectSheet
        open
        item={{
          id: 'item-1',
          productName: 'Karina',
          quantity: 1,
          width: 250,
          foamDensity: 'D35',
        }}
        onClose={() => undefined}
        onSave={onSave}
      />,
    );
    assertSheetHeightContract(view);
    assertFitContentDoesNotExceedCap(view);
    assertFooterActionHitTestable(view, 'Save correction');
    fireEvent.press(view.getByTestId('spec-correct-save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ width: '250', foamDensity: 'D35' }),
    );
  });
});
