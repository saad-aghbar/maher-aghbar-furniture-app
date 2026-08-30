import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { ProductGalleryBoard } from '../components/ProductGalleryBoard';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialMode="light">
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    </ThemeProvider>
  );
}

describe('ProductGalleryBoard', () => {
  it('keeps a single add control when photos exist (dashed slot, no hero overlay)', async () => {
    const view = await render(
      <ProductGalleryBoard
        photos={['https://example.com/a.jpg', 'https://example.com/b.jpg']}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onRemoveAt={() => {}}
        onAddPress={() => {}}
      />,
      { wrapper: Wrapper },
    );

    expect(view.getAllByLabelText('Add more photos')).toHaveLength(1);
    expect(view.queryByText('Add more photos')).toBeTruthy();
    expect(view.getByText('1/2')).toBeTruthy();
  });

  it('uses the empty hero as the only add control when there are no photos', async () => {
    const view = await render(
      <ProductGalleryBoard
        photos={[]}
        selectedIndex={0}
        onSelectIndex={() => {}}
        onRemoveAt={() => {}}
        onAddPress={() => {}}
      />,
      { wrapper: Wrapper },
    );

    expect(view.getByLabelText('Product photos')).toBeTruthy();
    expect(view.getByText('Tap to add product photos')).toBeTruthy();
    expect(view.queryByLabelText('Add more photos')).toBeNull();
  });
});
