import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import {
  costEditFromMaterials,
  costEditToPayload,
  emptyCostBreakdownEdit,
  ManufacturingCostEditor,
  totalFromCostEdit,
} from '../components/ManufacturingCostEditor';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn(async () => {}),
}));

jest.mock('../components/MaterialPickerSheet', () => ({
  MaterialPickerSheet: () => null,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialMode="light">
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    </ThemeProvider>
  );
}

describe('ManufacturingCostEditor math', () => {
  it('sums material costs without changing qty math', () => {
    const edit = {
      ...emptyCostBreakdownEdit(),
      fabricCost: '748',
      woodCost: '644',
      foamCost: '294.4',
    };
    expect(totalFromCostEdit(edit)).toBeCloseTo(1686.4);
    const payload = costEditToPayload(edit);
    expect(payload.manufacturingCost).toBeCloseTo(1686.4);
    expect(payload.costBreakdown.foamCost).toBeCloseTo(294.4);
    expect(payload.costBreakdown.foamQty).toBe(0);
  });

  it('maps materials into the edit model', () => {
    const edit = costEditFromMaterials([
      { key: 'foam', qty: 12, cost: 54 },
    ]);
    expect(edit.foamQty).toBe('12');
    expect(edit.foamCost).toBe('54');
  });
});

describe('ManufacturingCostEditor layout', () => {
  it('shows every material row with amount and qty', async () => {
    const { getByText, getAllByText } = await render(
      <ManufacturingCostEditor
        edit={{
          ...emptyCostBreakdownEdit(),
          fabricCost: '748',
          fabricQty: '88',
          woodCost: '644',
          woodQty: '56',
          foamCost: '294.4',
          foamQty: '12',
        }}
        onChange={() => {}}
        editable={false}
        formatCurrency={(n) => `JOD ${n.toFixed(2)}`}
      />,
      { wrapper: Wrapper },
    );

    expect(getByText('Fabric')).toBeTruthy();
    expect(getByText('Wood')).toBeTruthy();
    expect(getByText('Foam')).toBeTruthy();
    expect(getByText('Accessories')).toBeTruthy();
    expect(getAllByText('Amount')).toHaveLength(4);
    expect(getAllByText('Qty')).toHaveLength(4);
    expect(getByText('JOD 294.40')).toBeTruthy();
  });
});
