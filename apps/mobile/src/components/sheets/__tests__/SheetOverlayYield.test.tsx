import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import {
  SheetOverlayYieldProvider,
  useSheetOverlayYield,
} from '../SheetOverlayYield';

function Probe() {
  const { isOpen, acquire, release } = useSheetOverlayYield();
  return (
    <View>
      <Text>{isOpen ? 'yielding' : 'idle'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="acquire" onPress={acquire}>
        <Text>acquire</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="release" onPress={release}>
        <Text>release</Text>
      </Pressable>
    </View>
  );
}

function OverlayMount({ open }: { open: boolean }) {
  const { acquire, release } = useSheetOverlayYield();
  useEffect(() => {
    if (!open) return undefined;
    acquire();
    return () => release();
  }, [open, acquire, release]);
  return null;
}

describe('SheetOverlayYield', () => {
  it('counts stacked acquires and does not leak after unmount', async () => {
    const view = await render(
      <SheetOverlayYieldProvider>
        <Probe />
        <OverlayMount open />
      </SheetOverlayYieldProvider>,
    );
    expect(view.getByText('yielding')).toBeTruthy();
    fireEvent.press(view.getByLabelText('acquire'));
    expect(view.getByText('yielding')).toBeTruthy();
    fireEvent.press(view.getByLabelText('release'));
    expect(view.getByText('yielding')).toBeTruthy();
    view.unmount();
  });
});
