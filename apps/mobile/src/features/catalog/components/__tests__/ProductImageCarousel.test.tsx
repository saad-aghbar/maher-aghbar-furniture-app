import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Locale } from '@maher/types';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { ProductImageCarousel } from '../ProductImageCarousel';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

jest.mock('@/components/media/ImageViewer', () => ({
  ImageViewer: () => null,
}));

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Wrapper({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={insets}>
      <ThemeProvider initialMode="light">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function leafTexts(node: ReturnType<ReturnType<typeof render>['toJSON']>): string[] {
  if (node == null) return [];
  if (Array.isArray(node)) return node.flatMap((child) => leafTexts(child));
  if (typeof node !== 'object') return [];
  const out: string[] = [];
  const children = 'children' in node ? node.children : null;
  if (!Array.isArray(children)) return out;
  for (const child of children) {
    if (typeof child === 'string') out.push(child);
    else out.push(...leafTexts(child));
  }
  return out;
}

describe('ProductImageCarousel empty hero', () => {
  it('does not show leftover No product image text', async () => {
    const view = await render(
      <ProductImageCarousel uris={[]} onBack={() => undefined} onToggleFavorite={() => undefined} />,
      { wrapper: ({ children }) => <Wrapper locale="en">{children}</Wrapper> },
    );
    const visible = leafTexts(view.toJSON()).join(' ');
    expect(visible).not.toMatch(/no product image/i);
    expect(visible).not.toMatch(/no image/i);
    expect(visible).toMatch(/Photo coming soon/);
    expect(view.getByLabelText('No image')).toBeTruthy();
    expect(view.getByLabelText('Back')).toBeTruthy();
  });
});
