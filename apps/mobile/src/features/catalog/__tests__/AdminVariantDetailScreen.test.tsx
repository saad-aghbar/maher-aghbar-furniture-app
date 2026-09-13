import { waitFor } from '@testing-library/react-native';
import { AdminVariantDetailScreen } from '../AdminVariantDetailScreen';
import { expectEveryActionWired, renderScreen } from '@/test/screenHarness';

const variant = {
  id: 'v-ukr',
  productId: 'p-karina',
  sku: 'SOF-KARINA-UKR',
  code: 'UKR',
  nameAr: 'أوكرانيه',
  nameEn: 'Ukrainian',
  isDefault: false,
  isActive: true,
  measurements: [{ key: 'width', labelAr: 'ص', labelEn: 'W', value: 1.15, unit: 'm' }],
  composition: [{ labelAr: 'ثنائي', labelEn: '2-seater', qty: 1 }],
  includedItems: [],
  options: [],
  factoryNotesAr: 'لف بسيط',
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'admin-1', permissions: ['catalog.manage', 'customer.update'] } }),
}));

jest.mock('@/components/feedback/Toast', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('@/api/queryClient', () => ({
  toastMessageForError: () => 'error',
}));

jest.mock('@/api/modules/catalogAdmin', () => ({
  getAdminProduct: jest.fn(async () => ({
    id: 'p-karina',
    sku: 'SOF-KARINA',
    nameAr: 'كارينا',
    nameEn: 'Karina',
    isActive: true,
    basePrice: 1200,
    manufacturingCost: 400,
    width: 200,
    height: 90,
    depth: 95,
    customMeasurements: [],
    bomDefaults: { materials: [{ sku: 'FOAM-D35', qty: 2, unitCost: 50 }] },
  })),
  getProductVariant: jest.fn(async () => variant),
  patchProductVariant: jest.fn(async () => variant),
  duplicateProductVariant: jest.fn(async () => ({ ...variant, id: 'v-copy' })),
  deactivateProductVariant: jest.fn(async () => ({ ...variant, isActive: false })),
  activateProductVariant: jest.fn(async () => variant),
  listProductDealerPrices: jest.fn(async () => []),
  copyVariantFromStandard: jest.fn(async () => variant),
  getVariantCost: jest.fn(async () => ({
    materials: { total: 100, breakdown: {} },
    labor: { minutes: 60, hours: 1, cost: 50 },
    manufacturingCost: 150,
  })),
  upsertDealerPrice: jest.fn(async () => ({})),
  deleteDealerPrice: jest.fn(async () => ({})),
  translateCatalogName: jest.fn(async (text: string, _kind?: string, sourceLocale?: string) => ({
    nameAr: sourceLocale === 'ar' ? text : '',
    nameEn: sourceLocale === 'en' ? text : '',
    nameHe: sourceLocale === 'he' ? text : '',
  })),
  listMaterials: jest.fn(async () => ({ data: [] })),
}));

jest.mock('../components/BomMaterialPickerSheet', () => ({
  BomMaterialPickerSheet: () => null,
}));

jest.mock('@/api/modules/workflow', () => ({
  getProductProductionSetup: jest.fn(async () => ({ workflow: null, stages: [] })),
  listWorkflows: jest.fn(async () => []),
}));

jest.mock('@/api/modules/customers', () => ({
  listCustomers: jest.fn(async () => ({ data: [] })),
}));

jest.mock('@/api/modules/catalog', () => ({
  listSpecOptionGroups: jest.fn(async () => ({ data: [] })),
  listSpecOptionValues: jest.fn(async () => ({ data: [] })),
}));

describe('AdminVariantDetailScreen', () => {
  it('renders spec editors and wires every action', async () => {
    const view = await renderScreen(
      <AdminVariantDetailScreen productId="p-karina" variantId="v-ukr" />,
    );
    await waitFor(() => {
      expect(view.getByDisplayValue('Ukrainian')).toBeTruthy();
    });
    expectEveryActionWired(view);
  });
});
