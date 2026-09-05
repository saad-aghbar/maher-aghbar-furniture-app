import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ApiError } from '@/api/errors';
import type { CatalogSeedPreview } from '@/api/modules/sales-orders';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { CatalogTemplatePreviewSheet } from '../components/CatalogTemplatePreviewSheet';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

jest.mock('@/components/sheets/BottomSheet', () => ({
  BottomSheet: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? children : null,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialMode="light">
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    </ThemeProvider>
  );
}

function preview(overrides: Partial<CatalogSeedPreview> = {}): CatalogSeedPreview {
  return {
    salesOrderId: 'so-1',
    lineId: 'line-1',
    setupLineId: 'ls-1',
    manufacturingComplexity: 'STANDARD',
    productId: 'p-1',
    product: {
      id: 'p-1',
      sku: 'SF-MIL-03',
      nameEn: 'Milano Sofa',
      nameAr: null,
      nameHe: null,
    },
    quantity: 1,
    requestedFabricLabel: null,
    actionAvailable: true,
    unavailableReason: null,
    hasUsableDefinition: true,
    workflowWouldChange: false,
    requiresWorkflowChangeConfirmation: false,
    factoryLocked: false,
    current: {
      materials: 0,
      workflow: null,
      stages: 0,
      tasks: 0,
      semiWip: 0,
      hasDurationEstimates: false,
      hasExistingPlan: false,
    },
    productPlan: {
      materials: 4,
      workflow: {
        id: 'wf-1',
        code: 'STANDARD_FURNITURE',
        nameEn: 'Standard furniture',
        nameAr: null,
        nameHe: null,
        versionNumber: 4,
      },
      stages: 7,
      tasks: 6,
      semiWip: 2,
      hasDurationEstimates: true,
    },
    materials: [],
    willNotChange: ['workers', 'datesTimes', 'dealerDelivery'],
    assignmentImpact: {
      workersPreserved: true,
      datesPreserved: true,
      timesPreserved: true,
      sequencePreserved: true,
      assignmentsWouldBeRemoved: false,
    },
    unreleasedProductionOrderIds: ['po-1'],
    ...overrides,
  };
}

describe('CatalogTemplatePreviewSheet terminal states', () => {
  it('covers success, error+retry, loading close, applying close, and human codes', async () => {
    const success = await render(
      <CatalogTemplatePreviewSheet
        open
        preview={preview()}
        loading={false}
        applying={false}
        onClose={() => undefined}
        onApply={() => undefined}
      />,
      { wrapper: Wrapper },
    );
    expect(success.queryByTestId('catalog-preview-spinner')).toBeNull();
    expect(success.getByText('Milano Sofa')).toBeTruthy();
    expect(success.getByText('Apply production plan')).toBeTruthy();
    expect(success.getByText('Cancel')).toBeTruthy();
    success.unmount();

    const onRetry = jest.fn();
    const onCloseError = jest.fn();
    const locked = await render(
      <CatalogTemplatePreviewSheet
        open
        preview={undefined}
        loading={false}
        applying={false}
        error={new ApiError('Production has started', { status: 400, code: 'SETUP_LOCKED' })}
        onRetry={onRetry}
        onClose={onCloseError}
        onApply={() => undefined}
      />,
      { wrapper: Wrapper },
    );
    expect(locked.queryByTestId('catalog-preview-spinner')).toBeNull();
    expect(
      locked.getByText(/Production plan can no longer be changed|started or been confirmed/i),
    ).toBeTruthy();
    fireEvent.press(locked.getByText('Retry'));
    expect(onRetry).toHaveBeenCalled();
    fireEvent.press(locked.getByText('Cancel'));
    expect(onCloseError).toHaveBeenCalled();
    locked.unmount();
  });
});
