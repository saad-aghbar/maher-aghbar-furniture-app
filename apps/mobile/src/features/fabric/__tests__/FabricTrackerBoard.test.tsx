import type { ReactNode } from 'react';
import { render } from '@testing-library/react-native';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { FabricTrackerBoard } from '../FabricTrackerBoard';
import type { FabricTrackerRow } from '../selectFabricTracker';

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

function row(partial: Partial<FabricTrackerRow> & { id: string }): FabricTrackerRow {
  return {
    id: partial.id,
    label: partial.label ?? 'Velvet 302 · Sand',
    role: partial.role ?? 'Main body',
    stageCode: 'UPHOLSTERY',
    derivedStatus: partial.derivedStatus ?? 'READY_FOR_PRODUCTION',
    storedState: 'READY_FOR_PICKUP',
    expectedQty: partial.expectedQty ?? 24,
    arrivedQty: partial.arrivedQty ?? 24,
    issuedQty: 0,
    unit: 'm',
    readyForProduction: partial.readyForProduction ?? true,
    overridden: partial.overridden ?? false,
    attentionCode: null,
    orderNumber: partial.orderNumber ?? 'SO-FB1042',
    salesOrderId: 'so-fb1042',
    productImageUrl: null,
    dealerName: 'Oasis Living',
    productName: '3-Seater Sofa',
    supplierName: partial.supplierName ?? 'Abdali Textile Mill',
    imageUrl: null,
    locationLabel:
      'locationLabel' in partial ? partial.locationLabel! : 'Fabric Holding A-3',
    qrCodes: ['FB-SOFB1042-001'],
    lots: [],
  };
}

describe('FabricTrackerBoard', () => {
  it('renders the fabric, its state, quantity, and holding location', async () => {
    const view = await render(
      <>
        <FabricTrackerBoard
          rows={[
            row({ id: 'a' }),
            row({
              id: 'b',
              label: 'Bouclé 611 · Cream',
              role: 'Cushions',
              derivedStatus: 'WAITING',
              readyForProduction: false,
              arrivedQty: 0,
              expectedQty: 8,
              locationLabel: null,
            }),
          ]}
          ready={1}
          required={2}
        />
      </>,
      { wrapper: Wrapper },
    );

    expect(view.getByText('Fabric')).toBeTruthy();
    expect(view.getByText('1 of 2 ready')).toBeTruthy();
    expect(view.getByText('Velvet 302 · Sand')).toBeTruthy();
    expect(view.getByText('Bouclé 611 · Cream')).toBeTruthy();
    expect(view.getByText('Ready')).toBeTruthy();
    expect(view.getByText('Waiting')).toBeTruthy();
    expect(view.getByText('24/24 m')).toBeTruthy();
    expect(view.getByText('0/8 m')).toBeTruthy();
    expect(view.getByText('Fabric Holding A-3')).toBeTruthy();
  });

  it('stays on screen while loading instead of hiding', async () => {
    const view = await render(<FabricTrackerBoard rows={[]} loading />, {
      wrapper: Wrapper,
    });
    expect(view.getByText('Fabric')).toBeTruthy();
    expect(view.getByText('Loading fabric…')).toBeTruthy();
  });

  it('shows a retry instead of vanishing when the query fails', async () => {
    const onRetry = jest.fn();
    const view = await render(<FabricTrackerBoard rows={[]} error onRetry={onRetry} />, {
      wrapper: Wrapper,
    });
    expect(view.getByText("Couldn't load fabric.")).toBeTruthy();
    expect(view.getByText('Retry')).toBeTruthy();
  });

  it('renders nothing when the order genuinely has no fabric', async () => {
    const view = await render(<FabricTrackerBoard rows={[]} />, { wrapper: Wrapper });
    expect(view.queryByText('Fabric')).toBeNull();
  });
});
