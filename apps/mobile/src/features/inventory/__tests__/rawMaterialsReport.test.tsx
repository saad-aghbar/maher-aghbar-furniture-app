import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { RawMaterialsReportSheet } from '../components/RawMaterialsReportSheet';
import { RawMaterialsReportRow } from '../components/RawMaterialsReportRow';
import {
  canOpenRawMaterialsReport,
  validateRawMaterialsReportRange,
} from '../rawMaterialsReport';
import type { AuthUser } from '@maher/types';
import { readFileSync } from 'fs';
import { join } from 'path';

const inventoryDir = join(__dirname, '..');

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

jest.mock('@/components/calendar', () => {
  const { View, Text } = require('react-native');
  return {
    DatePickerField: ({ label }: { label: string }) => (
      <View accessibilityLabel={label}>
        <Text>{label}</Text>
      </View>
    ),
    MonthCalendar: () => (
      <View testID="raw-report-month-calendar">
        <Text>Month calendar</Text>
      </View>
    ),
    formatYmdLabel: (ymd: string) => ymd,
    initialCursorFromValue: () => ({ year: 2026, month: 8 }),
    nextDateRange: (start: string, end: string, tapped: string) => ({
      start: start || tapped,
      end: start ? tapped : '',
    }),
    todayYmd: () => '2026-09-03',
  };
});

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialMode="light">
      <LocaleProvider initialLocale="en">{children}</LocaleProvider>
    </ThemeProvider>
  );
}

function userWith(perms: string[]): AuthUser {
  return {
    id: 'u1',
    username: 'x',
    email: 'x@example.com',
    name: 'X',
    roles: [],
    permissions: perms,
    preferredLanguage: 'en',
  };
}

describe('raw materials report period', () => {
  it('accepts presets without dates', () => {
    expect(validateRawMaterialsReportRange('today', '', '')).toBeNull();
    expect(validateRawMaterialsReportRange('week', '', '')).toBeNull();
    expect(validateRawMaterialsReportRange('month', '', '')).toBeNull();
  });

  it('requires a custom from/to and blocks from > to', () => {
    expect(validateRawMaterialsReportRange('custom', '', '')).toBe('rangeRequired');
    expect(validateRawMaterialsReportRange('custom', '2026-08-31', '2026-08-01')).toBe(
      'rangeInvalid',
    );
    expect(validateRawMaterialsReportRange('custom', '2026-08-01', '2026-08-31')).toBeNull();
  });
});

describe('canOpenRawMaterialsReport', () => {
  it('requires both report.inventory.read and inventory.cost.read', () => {
    expect(canOpenRawMaterialsReport(userWith(['report.inventory.read']))).toBe(false);
    expect(canOpenRawMaterialsReport(userWith(['inventory.cost.read']))).toBe(false);
    expect(
      canOpenRawMaterialsReport(userWith(['report.inventory.read', 'inventory.cost.read'])),
    ).toBe(true);
    expect(canOpenRawMaterialsReport(null)).toBe(false);
  });
});

describe('inventory home wiring', () => {
  it('places the report row after the category rail and gates it on both permissions', () => {
    const src = readFileSync(join(inventoryDir, 'components/InventorySignatureHome.tsx'), 'utf8');
    expect(src).toContain('InventoryCategoryRail');
    expect(src.indexOf('RawMaterialsReportRow')).toBeGreaterThan(src.indexOf('InventoryCategoryRail'));
    expect(src).toContain('canOpenRawMaterialsReport');
    expect(src).toContain('RawMaterialsReportSheet');
    expect(src).not.toContain('useMutation');
  });

  it('opens language/theme only after the period sheet Modal unmounts', () => {
    const home = readFileSync(join(inventoryDir, 'components/InventorySignatureHome.tsx'), 'utf8');
    const sheet = readFileSync(join(inventoryDir, 'components/RawMaterialsReportSheet.tsx'), 'utf8');
    expect(sheet).not.toContain('pickPdfOptions');
    expect(sheet).toContain('onClosed={onClosed}');
    expect(home).toContain('pendingRawReportRef');
    expect(home).toContain('queueRawMaterialsReport');
    expect(home).toContain('onClosed={flushRawMaterialsReport}');
    const flush = home.slice(
      home.indexOf('function flushRawMaterialsReport'),
      home.indexOf('function lotScanPayload'),
    );
    expect(flush).toContain('pickPdfOptions');
    expect(flush).toContain('openRawMaterialsReportPdf');
  });
});

describe('RawMaterialsReportRow', () => {
  it('renders the floor row', async () => {
    const onPress = jest.fn();
    const view = await render(<RawMaterialsReportRow onPress={onPress} />, { wrapper: Wrapper });
    fireEvent.press(view.getByLabelText('Raw Materials Report'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('RawMaterialsReportSheet', () => {
  it('confirms the default month period without opening another sheet', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <RawMaterialsReportSheet
        open
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
      { wrapper: Wrapper },
    );
    fireEvent.press(view.getByText('Generate'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ period: 'month' }),
    );
  });

  it('renders period chips including custom', async () => {
    const view = await render(
      <RawMaterialsReportSheet
        open
        onClose={() => undefined}
        onConfirm={jest.fn()}
        initialPeriod="custom"
      />,
      { wrapper: Wrapper },
    );
    expect(view.getByTestId('raw-report-period-today')).toBeTruthy();
    expect(view.getByTestId('raw-report-period-custom')).toBeTruthy();
    expect(view.getByText('From')).toBeTruthy();
    expect(view.getByText('To')).toBeTruthy();
    expect(view.getByTestId('raw-report-month-calendar')).toBeTruthy();
  });

  it('lets custom range size to the calendar instead of a collapsed expandable pane', () => {
    const src = readFileSync(join(inventoryDir, 'components/RawMaterialsReportSheet.tsx'), 'utf8');
    expect(src).not.toMatch(/\bexpandable\b/);
    expect(src).toContain('fill={false}');
    expect(src).toContain('calendarMaxH');
    const body = readFileSync(join(inventoryDir, 'components/InventorySheetBody.tsx'), 'utf8');
    expect(body).toContain('fill = true');
  });

  it('blocks confirm when a custom range is missing and shows retry', async () => {
    const onConfirm = jest.fn();
    const view = await render(
      <RawMaterialsReportSheet
        open
        onClose={() => undefined}
        onConfirm={onConfirm}
        initialPeriod="custom"
      />,
      { wrapper: Wrapper },
    );
    fireEvent.press(view.getByText('Generate'));
    expect(await view.findByText('Choose a start and end date.')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(view.getByText('Retry')).toBeTruthy();
  });
});
