import { readFileSync } from 'fs';
import { join } from 'path';

const schedulingDir = join(__dirname, '..');
const salesOrdersDir = join(__dirname, '../../sales-orders');

function read(rel: string) {
  return readFileSync(join(schedulingDir, rel), 'utf8');
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
}

describe('dealer schedule floor', () => {
  it('puts the hub on stamps + a wood Upcoming/Calendar rail', () => {
    const screen = read('DealerDeliveryCalendarScreen.tsx');
    expect(screen).toContain('DealerScheduleHubBoard');
    expect(screen).toContain('DealerScheduleRail');
    expect(screen).toContain('DealerSearchBar');
    expect(screen).toContain('DealerMonthBoard');
    expect(screen).toContain('largeTitle');
    expect(screen).toContain('ScreenBackLead');
    expect(screen).not.toContain('mobile.dealerAccount.calendarSubtitle');
    expect(screen).not.toContain("backgroundColor: selected ? colors.brand");
    assertFloor(screen);
  });

  it('wraps the month in a dealer board with marker legend, not load %', () => {
    const month = read('components/DealerMonthBoard.tsx');
    expect(month).toContain('DealerBoard');
    expect(month).toContain('variant="dealer"');
    expect(month).toContain('legendConfirmed');
    expect(month).not.toContain('CalendarLegend');
    expect(month).not.toContain('loadPercent');
    assertFloor(month);
  });

  it('uses filed-date tickets and dealer expand copy on group boards', () => {
    const card = readFileSync(join(salesOrdersDir, 'components/DealerDeliveryCard.tsx'), 'utf8');
    const board = read('components/DealerDeliveryOrdersBoard.tsx');
    const stub = read('components/DealerScheduleDateStub.tsx');
    expect(card).toContain('DealerScheduleDateStub');
    expect(card).toContain('ProductThumb');
    expect(card).toContain('deliveryAddress');
    expect(board).toContain('mobile.orders.viewAllDeliveries');
    expect(board).toContain('DealerEmptyPanel');
    expect(stub).toContain('DEALER_STUB_CAPTION_KEY');
    assertFloor(card);
    assertFloor(board);
    assertFloor(stub);
  });

  it('floors the order promise board and change-date sheet', () => {
    const schedule = readFileSync(join(salesOrdersDir, 'components/OrderScheduleCard.tsx'), 'utf8');
    const sheet = readFileSync(
      join(salesOrdersDir, 'components/ChangeDeliveryDateSheet.tsx'),
      'utf8',
    );
    expect(schedule).toContain('DealerBoard');
    expect(schedule).toContain('DealerScheduleDateStub');
    expect(schedule).toContain('DEALER_JOURNEY_LABEL_KEY');
    expect(schedule).not.toContain('OrderBoardCard');
    expect(sheet).toContain('DealerBoard');
    expect(sheet).toContain('CalendarLegend');
    expect(sheet).toContain('DealerFormFooter');
    assertFloor(schedule);
    assertFloor(sheet);
  });
});
