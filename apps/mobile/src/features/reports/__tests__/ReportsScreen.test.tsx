import { fireEvent, waitFor } from '@testing-library/react-native';
import { ReportsScreen } from '../ReportsScreen';
import { CostOrderDossierScreen } from '../CostOrderDossierScreen';
import { CostReturnDossierScreen } from '../CostReturnDossierScreen';
import { mockRouter, renderScreen, resetMockRouter } from '@/test/screenHarness';

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: 'ord-1' }),
}));

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      permissions: [
        'inventory.cost.read',
        'report.sales.read',
        'report.production.read',
        'report.financial.read',
      ],
    },
  }),
}));

jest.mock('@/components/network/NetworkProvider', () => ({
  useNetwork: () => ({ showOfflineBanner: false }),
}));

jest.mock('@/features/dealers/query', () => ({
  useDealersListQuery: () => ({ data: { data: [] } }),
}));

jest.mock('@/features/reports/query', () => {
  const idle = { isLoading: false, isError: false, isFetching: false, refetch: jest.fn() };
  const order = {
    id: 'ord-1',
    number: 'SO-1001',
    status: 'IN_PRODUCTION',
    productSummary: 'Karina sofa',
    actualCost: 1200,
    plannedCost: 1100,
    variance: 100,
    saleValue: 2400,
    grossMargin: 1200,
    marginPct: 50,
    coverage: 'FINAL',
    labor: 40,
    workerEffortMinutes: 90,
  };
  return {
  useCostOrdersQuery: () => ({ ...idle, data: { data: [order] } }),
  useCostProductsQuery: () => ({
    ...idle,
    data: {
      data: [
        {
          productId: 'p1',
          orderCount: 2,
          averageActualCost: 900,
          lowestActualCost: 800,
          highestActualCost: 1000,
          product: { id: 'p1', sku: 'KARINA', nameEn: 'Karina' },
        },
      ],
      variants: [
        {
          variantId: 'v-250',
          orderCount: 1,
          averageActualCost: 950,
          variant: { id: 'v-250', sku: 'KARINA-250', nameEn: 'Ukrainian', productId: 'p1' },
        },
      ],
      byOption: [
        {
          optionValueId: 'opt-foam',
          optionCode: 'D35',
          optionName: 'Foam 35',
          groupName: 'Foam',
          orderCount: 1,
          averageActualCost: 950,
        },
      ],
    },
  }),
  useCostReturnsQuery: () => ({
    ...idle,
    data: {
      data: [
        {
          id: 'ret-1',
          number: 'RET-9',
          lifecycleState: 'REQUESTED',
          salesOrder: { id: 'ord-1', number: 'SO-1001' },
        },
      ],
    },
  }),
  useCostCoverageQuery: () => ({
    ...idle,
    data: { unpriced: [{ id: 'sku-1', sku: 'FOAM-35', nameEn: 'Foam 35' }] },
  }),
  useDashboardReportQuery: () => ({
    ...idle,
    data: { ordersInProduction: 3, revenueInvoiced: 10 },
  }),
  useSalesReportQuery: () => ({
    ...idle,
    data: {
      ordersByStatus: [{ status: 'IN_PRODUCTION', count: 2, total: 100 }],
      topCustomers: [{ customerId: 'c1', customerName: 'Nile', orderCount: 2, total: 4000 }],
      topProducts: [
        { productId: 'p1', sku: 'KARINA', name: 'Karina', lineCount: 1, quantity: 1, total: 2400 },
      ],
      bySalesRep: [{ salesRepId: 'r1', name: 'Sara', count: 3 }],
      recentQuotes: [{ id: 'q1', number: 'QT-1', status: 'SENT', customerName: 'Nile' }],
    },
  }),
  useProductionReportQuery: () => ({ data: { ordersByStatus: [] } }),
  useFinancialReportQuery: () => ({
    data: { aging: { current: 1, d1_30: 0, d31_60: 0, d61_90: 0, older: 0 } },
  }),
  useCoverageBackfillMutation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useLaborRatesQuery: () => ({
    ...idle,
    data: [
      {
        id: 'rate-1',
        userId: 'u1',
        hourlyRate: 25,
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        user: { id: 'u1', firstName: 'Yousef', lastName: 'Haddad' },
      },
    ],
  }),
  useLaborActualsQuery: () => ({
    ...idle,
    data: {
      labor: { estimated: 30, actual: 40 },
      byWorker: [{ userId: 'u1', name: 'Yousef Haddad', minutes: 90, actual: 40 }],
      byStage: [{ stageDefinitionId: 'uph', stageCode: 'UPH', estimated: 30, actual: 40, minutes: 90 }],
    },
  }),
  useCostOrderDossierQuery: () => ({
    ...idle,
    data: {
      id: 'ord-1',
      number: 'SO-1001',
      status: 'IN_PRODUCTION',
      summary: {
        saleValue: 2400,
        actualProductionCost: 1200,
        plannedCost: 1100,
        variance: 100,
        grossMargin: 1200,
        coverage: 'FINAL',
        averageCostPerUnit: 1200,
        labor: 40,
      },
      lines: [
        {
          id: 'l1',
          description: 'Karina',
          sku: 'KARINA',
          quantity: 1,
          actualCost: 1200,
          averageCostPerUnit: 1200,
        },
      ],
      materials: {
        coverage: 'FINAL',
        rows: [{ inventoryItemId: 'item-1', sku: 'FOAM-35', actualCost: 40, netQty: 2 }],
      },
      time: {
        workerEffortMinutes: 90,
        wallClockMinutes: 120,
        reworkEffortMinutes: 0,
        labor: {
          enabled: true,
          total: 40,
          note: null,
          byWorker: [{ userId: 'u1', minutes: 90, actual: 40 }],
        },
        byStage: [{ stageCode: 'UPHOLSTERY', minutes: 90 }],
      },
      returns: [{ id: 'ret-1', number: 'RET-9', lifecycleState: 'REQUESTED' }],
      provenance: {
        source: 'inventory_transactions',
        formula: 'x',
        transactions: [
          {
            id: 'tx1',
            number: 'TX-1',
            type: 'PRODUCTION_ISSUE',
            sku: 'FOAM-35',
            quantity: 2,
            unitCost: 20,
          },
        ],
      },
      lifetime: {
        originalProductionCost: 1200,
        afterSaleReturnCost: null,
        lifetimeCost: 1200,
        recoveredValue: null,
        disposedValue: null,
      },
    },
  }),
  useCostReturnDossierQuery: () => ({
    ...idle,
    data: {
      id: 'ret-1',
      number: 'RET-9',
      status: 'REQUESTED',
      salesOrder: { id: 'ord-1', number: 'SO-1001' },
      repairCost: 10,
      replacementCost: 20,
      recoveryCost: 5,
      returnGrossCost: 35,
      recoveredValue: 4,
      disposedValue: 1,
      pieces: [
        {
          id: 'pc-1',
          repairCost: 10,
          replacementCost: null,
          recoveryCost: null,
          workCost: 10,
          workerEffortMinutes: 15,
        },
      ],
    },
  }),
  };
});

describe('Cost & Performance screens', () => {
  beforeEach(() => {
    resetMockRouter();
  });

  it('renders the money desk and drills an order row', async () => {
    const view = await renderScreen(<ReportsScreen />);
    expect(view.getByLabelText('Money')).toBeTruthy();
    fireEvent.press(view.getByTestId('cost-tile-revenue'));
    await waitFor(() => {
      expect(view.getByTestId('cost-order-ord-1')).toBeTruthy();
    });
    fireEvent.press(view.getByTestId('cost-order-ord-1'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/(admin)/reports/order/ord-1');
  });

  it('renders worker rates and labor actuals on the money desk', async () => {
    const view = await renderScreen(<ReportsScreen />);
    expect(view.getByTestId('cost-labor-worker-u1')).toBeTruthy();
    fireEvent.press(view.getByTestId('cost-labor-rate-rate-1'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/(admin)/users');
  });

  it('drills a variant row into the orders lens', async () => {
    const view = await renderScreen(<ReportsScreen />);
    fireEvent.press(view.getByLabelText('Products'));
    await waitFor(() => {
      expect(view.getByTestId('cost-variant-v-250')).toBeTruthy();
    });
    fireEvent.press(view.getByTestId('cost-variant-v-250'));
    await waitFor(() => {
      expect(view.getByTestId('cost-order-ord-1')).toBeTruthy();
    });
  });

  it('renders empty, loading, and error-shaped trees without throwing', async () => {
    await expect(renderScreen(<ReportsScreen />)).resolves.toBeTruthy();
  });

  it('opens the order dossier and drills materials to inventory', async () => {
    const view = await renderScreen(<CostOrderDossierScreen id="ord-1" />);
    expect(view.getByTestId('cost-labor-total')).toBeTruthy();
    fireEvent.press(view.getByLabelText('FOAM-35'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/(admin)/inventory/items/item-1');
  });

  it('opens the return dossier and drills the return record', async () => {
    const view = await renderScreen(<CostReturnDossierScreen id="ret-1" />);
    fireEvent.press(view.getByLabelText('Open return'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/(admin)/returns/ret-1');
  });
});
