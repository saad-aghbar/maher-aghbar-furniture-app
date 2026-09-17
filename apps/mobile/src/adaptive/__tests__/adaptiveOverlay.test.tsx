import { Text } from 'react-native';
import { act, fireEvent } from '@testing-library/react-native';
import { renderAdaptive } from '@/test/adaptiveHarness';
import { AdaptiveOverlay } from '../AdaptiveOverlay';
import { emitEscape, escapeSubscriberCount } from '../escapeKey';

function Body() {
  return <Text testID="overlay-body-text">content</Text>;
}

describe('AdaptiveOverlay', () => {
  it('COMPACT renders the canonical BottomSheet', async () => {
    const view = await renderAdaptive(
      <AdaptiveOverlay open onClose={() => undefined} intent="confirm" title="Confirm" fitContent>
        <Body />
      </AdaptiveOverlay>,
      { width: 390 },
    );
    expect(view.getByTestId('bottom-sheet-panel')).toBeTruthy();
    expect(view.queryByTestId('adaptive-overlay-dialog')).toBeNull();
    expect(view.getByTestId('overlay-body-text')).toBeTruthy();
  });

  it('WIDE confirm renders a centered dialog with a labelled close control', async () => {
    const onClose = jest.fn();
    const view = await renderAdaptive(
      <AdaptiveOverlay open onClose={onClose} intent="confirm" title="Confirm" fitContent>
        <Body />
      </AdaptiveOverlay>,
      { width: 1440 },
    );
    expect(view.getByTestId('adaptive-overlay-dialog')).toBeTruthy();
    expect(view.queryByTestId('bottom-sheet-panel')).toBeNull();
    expect(view.getByTestId('overlay-body-text')).toBeTruthy();
    await fireEvent.press(view.getByTestId('adaptive-overlay-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('WIDE editor / inspector render a side panel', async () => {
    const view = await renderAdaptive(
      <AdaptiveOverlay open onClose={() => undefined} intent="inspector" title="Worker">
        <Body />
      </AdaptiveOverlay>,
      { width: 1366 },
    );
    expect(view.getByTestId('adaptive-overlay-panel')).toBeTruthy();
  });

  it('MEDIUM keeps editors as sheets but promotes pickers to dialogs', async () => {
    const editor = await renderAdaptive(
      <AdaptiveOverlay open onClose={() => undefined} intent="editor" title="Edit">
        <Body />
      </AdaptiveOverlay>,
      { width: 820 },
    );
    expect(editor.getByTestId('bottom-sheet-panel')).toBeTruthy();
    await editor.unmount();

    const picker = await renderAdaptive(
      <AdaptiveOverlay open onClose={() => undefined} intent="picker" title="Pick" fitContent>
        <Body />
      </AdaptiveOverlay>,
      { width: 820 },
    );
    expect(picker.getByTestId('adaptive-overlay-dialog')).toBeTruthy();
  });

  it('Escape closes the top-most open dialog and unsubscribes on unmount', async () => {
    const onClose = jest.fn();
    const view = await renderAdaptive(
      <AdaptiveOverlay open onClose={onClose} intent="picker" title="Pick" fitContent>
        <Body />
      </AdaptiveOverlay>,
      { width: 1440 },
    );
    expect(escapeSubscriberCount()).toBe(1);
    await act(async () => {
      emitEscape();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    await view.unmount();
    expect(escapeSubscriberCount()).toBe(0);
  });

  it('renders nothing when closed and fires onClosed after the close motion', async () => {
    const onClosed = jest.fn();
    const view = await renderAdaptive(
      <AdaptiveOverlay
        open
        onClose={() => undefined}
        onClosed={onClosed}
        intent="confirm"
        title="Confirm"
        fitContent
        modeOverride="dialog"
      >
        <Body />
      </AdaptiveOverlay>,
      { width: 1440 },
    );
    expect(view.getByTestId('adaptive-overlay-dialog')).toBeTruthy();
    await view.rerenderUi(
      <AdaptiveOverlay
        open={false}
        onClose={() => undefined}
        onClosed={onClosed}
        intent="confirm"
        title="Confirm"
        fitContent
        modeOverride="dialog"
      >
        <Body />
      </AdaptiveOverlay>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(view.queryByTestId('adaptive-overlay-dialog')).toBeNull();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});
