import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { isCatalogTemplateActionAvailable } from '../catalogTemplateAction';
import { StandardProductPlanBoard } from '../components/StandardProductPlanBoard';

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

const customTemplate = {
  showBoard: true,
  actionAvailable: false,
  hasUsableDefinition: false,
  manufacturingComplexity: 'CUSTOM',
  product: null,
  quantity: 1,
};

describe('Custom production plan desk', () => {
  it('renders the Custom header with no template action', async () => {
    const view = await render(
      <StandardProductPlanBoard catalogTemplate={customTemplate} onUsePlan={() => undefined} />,
      { wrapper: Wrapper },
    );
    expect(view.getByText('Custom product')).toBeTruthy();
    expect(view.getByText('Production plan must be prepared for this order.')).toBeTruthy();
    expect(view.queryByText('Use product production plan')).toBeNull();
    expect(isCatalogTemplateActionAvailable(customTemplate)).toBe(false);
  });
});
