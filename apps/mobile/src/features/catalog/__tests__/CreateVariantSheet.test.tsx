import { Dimensions } from 'react-native';
import { fireEvent } from '@testing-library/react-native';
import { CreateVariantSheet } from '../components/CreateVariantSheet';
import { HARNESS_WINDOW } from '@/test/harnessScopes';
import {
  assertFitContentDoesNotExceedCap,
  assertFooterActionHitTestable,
  assertSheetHeightContract,
  renderSheet,
} from '@/test/sheetHarness';

jest.mock('@/components/feedback/Toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('@/api/queryClient', () => ({
  toastMessageForError: () => 'error',
}));

jest.mock('@/api/modules/catalogAdmin', () => ({
  createProductVariant: jest.fn().mockResolvedValue({
    id: 'v-new',
    code: 'UKR',
    nameAr: 'أوكرانيه',
    nameEn: 'Ukrainian',
  }),
}));

describe('CreateVariantSheet geometry', () => {
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

  it('keeps the create sheet inside the height contract and wires submit', async () => {
    const onCreated = jest.fn();
    const view = await renderSheet(
      <CreateVariantSheet open productId="p1" onClose={() => {}} onCreated={onCreated} />,
    );
    assertSheetHeightContract(view);
    assertFitContentDoesNotExceedCap(view);
    fireEvent.changeText(view.getByLabelText('Floor name (Arabic)'), 'أوكرانيه');
    assertFooterActionHitTestable(view, 'Create variant');
  });
});
