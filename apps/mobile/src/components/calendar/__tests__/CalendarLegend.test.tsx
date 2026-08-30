import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Locale } from '@maher/types';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { CalendarLegend } from '../CalendarLegend';

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

describe('CalendarLegend', () => {
  it('renders sentence-case admin load labels in English', async () => {
    const view = await render(<CalendarLegend />, {
      wrapper: ({ children }) => <Wrapper locale="en">{children}</Wrapper>,
    });
    expect(view.getByText('Empty')).toBeTruthy();
    expect(view.getByText('Light')).toBeTruthy();
    expect(view.getByText('Half')).toBeTruthy();
    expect(view.getByText('Busy')).toBeTruthy();
    expect(view.getByText('Closed')).toBeTruthy();
    expect(view.queryByText('EMPTY')).toBeNull();
  });

  it('renders Arabic load labels without English leftovers', async () => {
    const view = await render(<CalendarLegend />, {
      wrapper: ({ children }) => <Wrapper locale="ar">{children}</Wrapper>,
    });
    expect(view.getByText('فارغ')).toBeTruthy();
    expect(view.getByText('خفيف')).toBeTruthy();
    expect(view.getByText('متوسط')).toBeTruthy();
    expect(view.getByText('مزدحم')).toBeTruthy();
    expect(view.getByText('مغلق')).toBeTruthy();
  });
});
