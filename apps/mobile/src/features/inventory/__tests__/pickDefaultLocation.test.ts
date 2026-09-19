import { readFileSync } from 'fs';
import { join } from 'path';
import {
  pickDefaultLocationId,
  locationPickerLabel,
  warehouseBinLine,
  sortBinsForPicker,
  pickerViewportHeights,
  PICKER_WAREHOUSE_MIN,
  PICKER_WAREHOUSE_MAX,
  PICKER_BIN_MIN,
  PICKER_BIN_MAX,
} from '../pickDefaultLocation';

const inventoryDir = join(__dirname, '..');

describe('pickDefaultLocationId', () => {
  const bins = [
    { id: 'a', code: 'A1', isDefault: false },
    { id: 'main', code: 'MAIN', isDefault: true },
    { id: 'off', code: 'OFF', isDefault: false, isActive: false },
  ];

  it('keeps the current active selection', () => {
    expect(pickDefaultLocationId(bins, 'a')).toBe('a');
  });

  it('falls back to the default bin', () => {
    expect(pickDefaultLocationId(bins)).toBe('main');
  });

  it('skips inactive bins when choosing a default', () => {
    expect(pickDefaultLocationId([{ id: 'off', isActive: false }, { id: 'b' }])).toBe('b');
  });
});

describe('sortBinsForPicker', () => {
  it('puts the default bin first, then code order', () => {
    const rows = sortBinsForPicker([
      { id: 'a', code: 'ASSEMBLY', isDefault: false },
      { id: 'c', code: 'CARPENTRY', isDefault: false },
      { id: 'm', code: 'SEMI-MAIN', isDefault: true },
    ]);
    expect(rows.map((row) => row.id)).toEqual(['m', 'a', 'c']);
  });
});

describe('warehouseBinLine', () => {
  it('joins warehouse and bin', () => {
    expect(warehouseBinLine('Raw', 'MAIN')).toBe('Raw · \u2066MAIN\u2069');
  });

  it('returns warehouse alone when the bin is empty', () => {
    expect(warehouseBinLine('Raw', '  ')).toBe('Raw');
  });
});

describe('pickerViewportHeights', () => {
  it('keeps warehouse and bin boxes independently scrollable', () => {
    const short = pickerViewportHeights(700);
    expect(short.warehouse).toBe(PICKER_WAREHOUSE_MIN);
    expect(short.bin).toBe(PICKER_BIN_MIN);
    const tall = pickerViewportHeights(2000);
    expect(tall.warehouse).toBe(PICKER_WAREHOUSE_MAX);
    expect(tall.bin).toBe(PICKER_BIN_MAX);
    expect(tall.sheet).toBeGreaterThan(760);
    const desk = pickerViewportHeights(1024, true);
    expect(desk.warehouse).toBeGreaterThanOrEqual(400);
    expect(desk.bin).toBeGreaterThanOrEqual(360);
  });

  it('wires shared heights into every warehouse+bin pop-up', () => {
    const sheets = [
      'components/AddStockSheet.tsx',
      'components/CreateTransferSheet.tsx',
      'components/CreateStockCountSheet.tsx',
      join('..', 'purchasing', 'components', 'DestinationPickSheet.tsx'),
      join('..', 'purchasing', 'components', 'CreatePurchaseOrderSheet.tsx'),
      join('..', 'returns', 'components', 'ReturnReceiveSheet.tsx'),
      join('..', 'purchasing', 'components', 'AddMaterialSheet.tsx'),
      join('..', 'workflow', 'components', 'ProductionStageSetupSheet.tsx'),
    ];
    for (const rel of sheets) {
      const src = readFileSync(join(inventoryDir, rel), 'utf8');
      expect(src).toContain('pickerViewportHeights');
    }
    const strip = readFileSync(join(inventoryDir, 'components/WarehouseBinBoard.tsx'), 'utf8');
    expect(strip).toContain('pickerViewportHeights(height, isDesk).bin');
  });
});

describe('locationPickerLabel', () => {
  it('shows code and name together', () => {
    expect(locationPickerLabel({ id: '1', code: 'RAW-MAIN', name: 'Main floor' })).toBe(
      'RAW-MAIN — Main floor',
    );
  });

  it('does not duplicate when name equals code', () => {
    expect(locationPickerLabel({ id: '1', code: 'A1', name: 'A1' })).toBe('A1');
  });
});
