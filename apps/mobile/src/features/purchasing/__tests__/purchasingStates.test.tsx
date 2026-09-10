import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { PurchasingSkeleton } from '../components/PurchasingSkeleton';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

function wrap(mode: 'light' | 'dark', locale: 'en' | 'ar') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider initialMode={mode}>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </ThemeProvider>
    );
  };
}

describe('purchasing states', () => {
  it('renders skeleton and empty panel in light and dark Arabic', () => {
    expect(() =>
      render(<PurchasingSkeleton />, { wrapper: wrap('light', 'en') }),
    ).not.toThrow();
    expect(() =>
      render(<PurchasingSkeleton />, { wrapper: wrap('dark', 'ar') }),
    ).not.toThrow();
    expect(() =>
      render(<DealerEmptyPanel text="Nothing here" />, { wrapper: wrap('dark', 'ar') }),
    ).not.toThrow();
  });
});
