import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { FONT_SCALE_DEFAULT, FONT_SCALE_STORAGE_KEY } from '../fontScale';
import { FontScaleProvider, useFontScale } from '../FontScaleProvider';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

function Probe() {
  const { fontScale } = useFontScale();
  return <Text testID="scale">{String(fontScale)}</Text>;
}

describe('FontScaleProvider', () => {
  const getItem = SecureStore.getItemAsync as jest.MockedFunction<
    typeof SecureStore.getItemAsync
  >;

  beforeEach(() => {
    getItem.mockReset();
    getItem.mockResolvedValue(null);
  });

  it('hydrates to default when storage is empty', async () => {
    const view = await render(
      <FontScaleProvider>
        <Probe />
      </FontScaleProvider>,
    );
    await waitFor(() => {
      expect(view.getByTestId('scale').props.children).toBe(String(FONT_SCALE_DEFAULT));
    });
  });

  it('treats an invalid stored value as default', async () => {
    getItem.mockResolvedValue('nope');
    const view = await render(
      <FontScaleProvider>
        <Probe />
      </FontScaleProvider>,
    );
    await waitFor(() => {
      expect(getItem).toHaveBeenCalledWith(FONT_SCALE_STORAGE_KEY);
      expect(view.getByTestId('scale').props.children).toBe(String(FONT_SCALE_DEFAULT));
    });
  });

  it('restores a valid stored scale', async () => {
    getItem.mockResolvedValue('1.2');
    const view = await render(
      <FontScaleProvider>
        <Probe />
      </FontScaleProvider>,
    );
    await waitFor(() => {
      expect(view.getByTestId('scale').props.children).toBe('1.2');
    });
  });
});
