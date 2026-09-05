import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { OrderFabricGroupCard } from '@/features/fabric/OrderFabricGroupCard';
import { groupFabricRowsBySalesOrder, type FabricTrackerRow } from '@/features/fabric/selectFabricTracker';

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

function row(partial: Partial<FabricTrackerRow> & { id: string; label: string }): FabricTrackerRow {
  return {
    id: partial.id,
    salesOrderId: 'so-fb1042',
    label: partial.label,
    role: partial.role ?? 'Main body',
    stageCode: 'UPHOLSTERY',
    derivedStatus: partial.derivedStatus ?? 'READY_FOR_PRODUCTION',
    storedState: 'READY_FOR_PICKUP',
    expectedQty: partial.expectedQty ?? 24,
    arrivedQty: partial.arrivedQty ?? 24,
    issuedQty: 0,
    unit: 'm',
    readyForProduction: partial.readyForProduction ?? true,
    overridden: false,
    attentionCode: null,
    orderNumber: 'SO-FB1042',
    dealerName: 'Oasis Living',
    productName: '3-Seater Sofa',
    productImageUrl: null,
    supplierName: null,
    imageUrl: null,
    locationLabel: partial.locationLabel ?? 'Holding A-3',
    qrCodes: partial.qrCodes ?? [],
    lots: [],
  };
}

describe('OrderFabricGroupCard', () => {
  it('shows the sales order once with three fabric children', async () => {
    const onPressOrder = jest.fn();
    const onPressFabric = jest.fn();
    const group = groupFabricRowsBySalesOrder([
      row({ id: 'a', label: 'Velvet 302 · Sand', qrCodes: ['FB-SOFB1042-001'] }),
      row({ id: 'b', label: 'Linen 180 · Natural', role: 'Piping', arrivedQty: 12, expectedQty: 12 }),
      row({
        id: 'c',
        label: 'Bouclé 611 · Cream',
        role: 'Cushions',
        derivedStatus: 'WAITING',
        readyForProduction: false,
        arrivedQty: 0,
        expectedQty: 18,
        locationLabel: null,
      }),
    ])[0]!;

    const view = await render(
      <OrderFabricGroupCard
        group={group}
        onPressOrder={onPressOrder}
        onPressFabric={onPressFabric}
      />,
      { wrapper: Wrapper },
    );

    expect(view.getAllByText('SO-FB1042')).toHaveLength(1);
    expect(view.getByText('Velvet 302 · Sand')).toBeTruthy();
    expect(view.getByText('Linen 180 · Natural')).toBeTruthy();
    expect(view.getByText('Bouclé 611 · Cream')).toBeTruthy();
    expect(view.queryByText('UPHOLSTERY')).toBeNull();

    fireEvent.press(view.getByLabelText('Velvet 302 · Sand'));
    expect(onPressFabric).toHaveBeenCalled();
  });
});

describe('order fabric desk wiring', () => {
  const desk = readFileSync(
    join(__dirname, '../components/FabricDeskSection.tsx'),
    'utf8',
  );

  it('groups by sales order instead of listing holding cards', () => {
    expect(desk).toContain('OrderFabricGroupCard');
    expect(desk).toContain('groupFabricRowsBySalesOrder');
    expect(desk).not.toContain('FabricHoldingCard');
    expect(desk).not.toContain('FabricLaneRail');
  });
});
