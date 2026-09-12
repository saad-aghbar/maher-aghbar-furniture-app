import { View } from 'react-native';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { expectEveryActionWired, renderScreen } from '../screenHarness';

function DummyScreen({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <View>
      <PrimaryButton label="Save draft" onPress={onSave} />
      <SecondaryButton label="Cancel draft" onPress={onCancel} />
    </View>
  );
}

describe('screen interaction harness', () => {
  it('renderScreen wraps providers and expectEveryActionWired fires each button', async () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    const view = await renderScreen(<DummyScreen onSave={onSave} onCancel={onCancel} />);
    expectEveryActionWired(view);
    expect(onSave).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders loading, empty, and error-shaped children without throwing', async () => {
    await expect(renderScreen(<View accessibilityLabel="Loading state" />)).resolves.toBeTruthy();
    await expect(renderScreen(<View accessibilityLabel="Empty state" />)).resolves.toBeTruthy();
    await expect(renderScreen(<View accessibilityLabel="Error state" />)).resolves.toBeTruthy();
  });
});
