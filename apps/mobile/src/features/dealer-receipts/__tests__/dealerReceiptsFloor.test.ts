import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '..');
const homeDir = join(__dirname, '../../dealer-home');
const accountDir = join(__dirname, '../../account');

function read(rel: string) {
  return readFileSync(join(dir, rel), 'utf8');
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
}

describe('dealer receipts floor', () => {
  it('puts the list on 1×2 stamps + search chrome, not a calendar or orders rail', () => {
    const screen = read('DealerReceiptsListScreen.tsx');
    const hub = read('components/DealerReceiptsHubBoard.tsx');
    expect(screen).toContain('DealerReceiptsHubBoard');
    expect(screen).toContain('DealerSearchBar');
    expect(screen).toContain('DealerReceiptCard');
    expect(screen).toContain('ConfirmReceiptSheet');
    expect(screen).toContain('largeTitle');
    expect(screen).toContain('ScreenBackLead');
    expect(screen).toContain('DealerEmptyState');
    expect(screen).not.toContain('DealerOrdersRail');
    expect(screen).not.toContain('DealerMonthBoard');
    expect(hub).not.toContain('ScrollView');
    expect(hub).toContain('stampAwaiting');
    expect(hub).toContain('stampReceived');
    expect(hub).toContain('warningSoft');
    assertFloor(screen);
    assertFloor(hub);
  });

  it('uses receipt-stub tickets and a confirm footer when awaiting', () => {
    const card = read('components/DealerReceiptCard.tsx');
    const stub = read('components/DealerReceiptStub.tsx');
    expect(card).toContain('DealerReceiptStub');
    expect(card).toContain('ProductThumb');
    expect(card).toContain('selectReceiptStub');
    expect(card).toContain('lifecycle.confirmWhenReceived');
    expect(card).not.toContain('selectOrderStationStub');
    expect(card).not.toContain('DealerScheduleDateStub');
    expect(stub).toContain('RECEIPT_STUB_CAPTION_KEY');
    assertFloor(card);
    assertFloor(stub);
  });

  it('floors the confirm desk without the commercial order stack', () => {
    const detail = read('DealerReceiptDetailScreen.tsx');
    const identity = read('components/DealerReceiptIdentityBoard.tsx');
    expect(detail).toContain('ScreenBackLead');
    expect(detail).toContain('DealerReceiptIdentityBoard');
    expect(detail).toContain('ConfirmReceiptSheet');
    expect(detail).toContain('mobile.dealerReceipts.confirmHint');
    expect(detail).not.toContain('ImageCarousel');
    expect(detail).not.toContain('OrderStationStub');
    expect(detail).not.toContain('OrdersStageSpine');
    expect(identity).toContain('ProductThumb');
    expect(identity).toContain('DealerReceiptStub');
    assertFloor(detail);
    assertFloor(identity);
  });

  it('points home Deliveries tiles at the receipts list without orders chips', () => {
    const dest = readFileSync(
      join(homeDir, 'components/DealerHomeDestinations.tsx'),
      'utf8',
    );
    const dock = readFileSync(join(accountDir, 'components/DealerPlacesDock.tsx'), 'utf8');
    expect(dest).toContain('/(app)/(customer)/deliveries');
    expect(dest).not.toContain('chip=shipped');
    expect(dest).not.toContain('chip=delivered');
    expect(dock).toContain('/(app)/(customer)/deliveries');
    expect(dock).not.toContain('chip=shipped');
    expect(dock).not.toContain('chip=delivered');
  });
});
