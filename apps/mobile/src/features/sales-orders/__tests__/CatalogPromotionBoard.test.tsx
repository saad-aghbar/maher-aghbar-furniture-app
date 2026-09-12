import { waitFor } from '@testing-library/react-native';
import { promoteProductFromOrderLine } from '@/api/modules/catalogAdmin';
import { CatalogPromotionBoard } from '../components/CatalogPromotionBoard';
import { expectEveryActionWired, renderScreen } from '@/test/screenHarness';

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', permissions: ['catalog.manage'], roles: ['SYSTEM_ADMINISTRATOR'] },
  }),
}));

jest.mock('@/components/feedback/Toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('@/api/queryClient', () => ({
  toastMessageForError: () => 'error',
}));

jest.mock('@/api/modules/catalogAdmin', () => ({
  promoteProductFromOrderLine: jest.fn(async () => ({ id: 'prod-1' })),
  promoteVariantFromOrderLine: jest.fn(async () => ({ id: 'var-1' })),
}));

describe('CatalogPromotionBoard', () => {
  it('promotes a custom line as a catalog product', async () => {
    const view = await renderScreen(
      <CatalogPromotionBoard
        orderId="so-1"
        lines={[
          {
            id: 'line-custom',
            description: 'Custom Karina 250',
            quantity: 1,
            unitPrice: 0,
            lineTotal: 0,
            manufacturingComplexity: 'CUSTOM',
            commercialPriceStatus: 'OPEN',
          },
        ]}
      />,
    );
    expectEveryActionWired(view);
    await waitFor(() => {
      expect(promoteProductFromOrderLine).toHaveBeenCalledWith('line-custom');
    });
  });
});
