import { Dimensions } from 'react-native';
import { fireEvent } from '@testing-library/react-native';
import { CropPreviewSheet } from '../components/CropPreviewSheet';
import { ScanReviewScreen } from '../ScanReviewScreen';
import { previewItemsToScanLines } from '../scanReview';
import { HARNESS_WINDOW } from '@/test/harnessScopes';
import {
  assertFitContentDoesNotExceedCap,
  assertFooterActionHitTestable,
  assertSheetHeightContract,
  renderSheet,
} from '@/test/sheetHarness';

const twoLines = previewItemsToScanLines([
  {
    productName: 'كرينا',
    quantity: '1',
    width: '250',
    foamDensity: 'D35',
    confidence: 0.9,
    lowConfidenceFields: [],
  },
  {
    productName: 'ميلانو',
    quantity: '2',
    width: '160',
    confidence: 0.4,
    lowConfidenceFields: ['width'],
  },
]);

describe('handwritten scan review sheets', () => {
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

  it('keeps scan review inside the height contract and blocks confirm until width is checked', async () => {
    const onConfirm = jest.fn();
    const view = await renderSheet(
      <ScanReviewScreen
        open
        lines={twoLines}
        onChange={() => undefined}
        onConfirm={onConfirm}
        onClose={() => undefined}
        onOpenCrop={() => undefined}
      />,
    );
    assertSheetHeightContract(view);
    assertFitContentDoesNotExceedCap(view);
    fireEvent.press(view.getByTestId('scan-review-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps the crop preview inside the height contract', async () => {
    const view = await renderSheet(
      <CropPreviewSheet open uri="https://example.com/sheet.jpg" onClose={() => undefined} />,
    );
    assertSheetHeightContract(view);
    assertFitContentDoesNotExceedCap(view);
    assertFooterActionHitTestable(view, 'Close');
  });
});
