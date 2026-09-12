import { Dimensions, ScrollView, View } from 'react-native';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { BottomSheet, resolveSheetHeightCap } from '@/components/sheets/BottomSheet';
import { ConfirmationSheet } from '@/components/sheets/ConfirmationSheet';
import { ActionSheet } from '@/components/sheets/ActionSheet';
import { HARNESS_WINDOW } from '../harnessScopes';
import {
  assertFitContentDoesNotExceedCap,
  assertFooterActionHitTestable,
  assertSheetHeightContract,
  defaultSheetMaxHeight,
  renderSheet,
} from '../sheetHarness';

describe('sheet height contract', () => {
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

  it('caps default height at ~70% of the window and shrinks for the keyboard', () => {
    const windowHeight = HARNESS_WINDOW.height;
    const defaultCap = resolveSheetHeightCap({ windowHeight });
    expect(defaultCap).toBe(defaultSheetMaxHeight(windowHeight));
    expect(defaultCap).toBeLessThanOrEqual(Math.round(windowHeight * 0.7));

    const withKeyboard = resolveSheetHeightCap({
      windowHeight,
      keyboardHeight: 320,
    });
    expect(withKeyboard).toBe(Math.max(240, windowHeight - 320));
    expect(withKeyboard).toBeLessThan(defaultCap);
    expect(withKeyboard).toBeGreaterThan(0);
  });

  it('renders a real BottomSheet whose panel height is > 0 and <= maxHeight', async () => {
    const view = await renderSheet(
      <BottomSheet open onClose={() => {}} title="Geometry" sheetHeight={360}>
        <View>
          <PrimaryButton label="Save sheet" onPress={() => {}} />
        </View>
      </BottomSheet>,
    );
    assertSheetHeightContract(view);
    expect(view.getByTestId('bottom-sheet-panel')).toBeTruthy();
    expect(view.getByTestId('bottom-sheet-body')).toBeTruthy();
    assertFooterActionHitTestable(view, 'Save sheet');
  });

  it('fitContent ConfirmationSheet stays at or below the height cap and the confirm button works', async () => {
    const onConfirm = jest.fn();
    const view = await renderSheet(
      <ConfirmationSheet
        open
        onClose={() => {}}
        title="Confirm geometry"
        message="This is a short confirmation."
        confirmLabel="Confirm action"
        cancelLabel="Cancel sheet"
        onConfirm={onConfirm}
      />,
    );
    assertFitContentDoesNotExceedCap(view);
    assertSheetHeightContract(view, { maxHeight: 360 });
    assertFooterActionHitTestable(view, 'Confirm action');
    expect(onConfirm).toHaveBeenCalled();
  });

  it('ActionSheet primary rows are labelled and pressable', async () => {
    const onPress = jest.fn();
    const view = await renderSheet(
      <ActionSheet
        open
        onClose={() => {}}
        title="Pick action"
        actions={[{ label: 'Open camera', onPress }]}
        cancelLabel="Cancel actions"
      />,
    );
    assertFitContentDoesNotExceedCap(view);
    assertFooterActionHitTestable(view, 'Open camera');
    expect(view.getByLabelText('Cancel actions')).toBeTruthy();
  });

  it('overflowing sheet body can host a ScrollView', async () => {
    const view = await renderSheet(
      <BottomSheet open onClose={() => {}} title="Scroll" fitContent maxHeight={400}>
        <ScrollView>
          <PrimaryButton label="Done overflow" onPress={() => {}} />
        </ScrollView>
      </BottomSheet>,
    );
    expect(view.getByTestId('bottom-sheet-body')).toBeTruthy();
    expect(view.getByLabelText('Done overflow')).toBeTruthy();
    assertFitContentDoesNotExceedCap(view);
  });
});
