import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Locale } from '@maher/types';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { EmptyProductImage } from '../EmptyProductImage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

function Wrapper({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <ThemeProvider initialMode="light">
      <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
    </ThemeProvider>
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

describe('EmptyProductImage', () => {
  it('does not render a raw No image label', () => {
    const view = render(<EmptyProductImage />, {
      wrapper: ({ children }) => <Wrapper locale="en">{children}</Wrapper>,
    });
    expect(leafTexts(view.toJSON()).join(' ')).not.toMatch(/no image/i);
    expect(view.getByLabelText('No image')).toBeTruthy();
  });

  it('keeps Arabic and Hebrew a11y labels', () => {
    const ar = render(<EmptyProductImage />, {
      wrapper: ({ children }) => <Wrapper locale="ar">{children}</Wrapper>,
    });
    expect(ar.getByLabelText('لا توجد صورة')).toBeTruthy();
    ar.unmount();

    const he = render(<EmptyProductImage />, {
      wrapper: ({ children }) => <Wrapper locale="he">{children}</Wrapper>,
    });
    expect(he.getByLabelText('אין תמונה')).toBeTruthy();
  });
});
