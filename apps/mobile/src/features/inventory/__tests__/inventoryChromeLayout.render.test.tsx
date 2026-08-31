import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/feedback/Toast';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { InventoryCompositionChrome } from '../components/InventoryCompositionChrome';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

jest.mock('../components/InventoryLifecycleTabs', () => ({
  InventoryLifecycleTabs: () => null,
}));

jest.mock('../components/InventorySectionTabs', () => ({
  InventorySectionTabs: () => null,
}));

function Wrapper({
  children,
  locale,
}: {
  children: ReactNode;
  locale: 'en' | 'ar';
}) {
  return (
    <ThemeProvider initialMode="light">
      <LocaleProvider initialLocale={locale}>
        <ToastProvider>{children}</ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

const base = {
  title: 'Inventory',
  subtitle: 'Floor',
  onLifecycleChange: () => undefined,
  onSectionChange: () => undefined,
  showSearch: true,
  searchInput: '',
  setSearchInput: () => undefined,
  searchPlaceholder: 'Search',
  scanLabel: 'Scan',
  onScan: () => undefined,
  canScan: true,
  createLabel: 'Add item',
  onCreate: () => undefined,
  warehouseLabel: 'Add warehouse',
  onCreateWarehouse: () => undefined,
  onSync: () => undefined,
};

describe('inventory chrome action placement', () => {
  it('EN materials items: Scan + Sync on search, Add item + Add warehouse below', async () => {
    const view = await render(
      <InventoryCompositionChrome
        {...base}
        lifecycle="materials"
        section="items"
        canSync
        canCreate
        canCreateWarehouse
      />,
      { wrapper: ({ children }) => <Wrapper locale="en">{children}</Wrapper> },
    );
    expect(view.getByLabelText('Scan')).toBeTruthy();
    expect(view.getByLabelText('Sync from materials')).toBeTruthy();
    expect(view.getByLabelText('Add item')).toBeTruthy();
    expect(view.getByLabelText('Add warehouse')).toBeTruthy();
    expect(view.queryByText('Scan')).toBeNull();
  });

  it('EN finished items: Scan stays, create and warehouse and sync hide', async () => {
    const view = await render(
      <InventoryCompositionChrome
        {...base}
        lifecycle="finished"
        section="items"
        canSync
        canCreate={false}
        canCreateWarehouse
      />,
      { wrapper: ({ children }) => <Wrapper locale="en">{children}</Wrapper> },
    );
    expect(view.getByLabelText('Scan')).toBeTruthy();
    expect(view.queryByLabelText('Sync from materials')).toBeNull();
    expect(view.queryByLabelText('Add item')).toBeNull();
    expect(view.queryByLabelText('Add warehouse')).toBeNull();
  });

  it('AR materials items: labeled creates and scan a11y, no title-side Scan text', async () => {
    const view = await render(
      <InventoryCompositionChrome
        {...base}
        title="المخزون"
        scanLabel="مسح"
        createLabel="إضافة مادة"
        warehouseLabel="إضافة مستودع"
        lifecycle="materials"
        section="items"
        canSync
        canCreate
        canCreateWarehouse
      />,
      { wrapper: ({ children }) => <Wrapper locale="ar">{children}</Wrapper> },
    );
    expect(view.getByLabelText('مسح')).toBeTruthy();
    expect(view.getByLabelText('إضافة مادة')).toBeTruthy();
    expect(view.getByLabelText('إضافة مستودع')).toBeTruthy();
    expect(view.queryByText('مسح')).toBeNull();
  });
});
