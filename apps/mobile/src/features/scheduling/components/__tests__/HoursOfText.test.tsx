import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Locale } from '@maher/types';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { HoursOfText } from '../HoursOfText';

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

async function renderPair(
  locale: Locale,
  allocated: string | number,
  available: string | number,
) {
  return render(<HoursOfText allocated={allocated} available={available} />, {
    wrapper: ({ children }) => <Wrapper locale={locale}>{children}</Wrapper>,
  });
}

function leafTexts(node: ReturnType<Awaited<ReturnType<typeof render>>['toJSON']>): string[] {
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

describe('HoursOfText', () => {
  it('renders Arabic 14 / 7.5 as five sibling nodes in allocated-unit-slash order', async () => {
    const view = await renderPair('ar', 14, 7.5);
    expect(leafTexts(view.toJSON())).toEqual(['14', 'س', '/', '7.5', 'س']);
    expect(view.getByLabelText('14 ساعة من أصل 7.5 ساعة')).toBeTruthy();
    expect(leafTexts(view.toJSON())).not.toEqual(['14 س / 7.5 س']);
  });

  it('renders Arabic 6.5 / 14 without swapping values or leading with س', async () => {
    const texts = leafTexts((await renderPair('ar', 6.5, 14)).toJSON());
    expect(texts).toEqual(['6.5', 'س', '/', '14', 'س']);
    expect(texts[0]).not.toBe('س');
    expect(texts[0]).not.toBe('14');
  });

  it.each([
    [0, 14, ['0', 'س', '/', '14', 'س']],
    [14, 14, ['14', 'س', '/', '14', 'س']],
    [19.1, 14, ['19.1', 'س', '/', '14', 'س']],
    [0.5, 7, ['0.5', 'س', '/', '7', 'س']],
    [6.5, 14, ['6.5', 'س', '/', '14', 'س']],
    [7, 7, ['7', 'س', '/', '7', 'س']],
  ] as const)(
    'keeps Arabic %s / %s decimals and order stable',
    async (allocated, available, expected) => {
      expect(leafTexts((await renderPair('ar', allocated, available)).toJSON())).toEqual([
        ...expected,
      ]);
    },
  );

  it('renders English 14h / 7.5h as five nodes without reversing', async () => {
    const view = await renderPair('en', 14, 7.5);
    expect(leafTexts(view.toJSON())).toEqual(['14', 'h', '/', '7.5', 'h']);
    expect(view.getByLabelText('14 hours of 7.5 hours')).toBeTruthy();
  });
});
