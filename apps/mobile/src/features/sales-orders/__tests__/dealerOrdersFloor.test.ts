import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '..');

function read(rel: string) {
  return readFileSync(join(dir, rel), 'utf8');
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
}

describe('dealer orders floor', () => {
  it('puts the hub on stamps + chrome search/rail, not a subtitle stack', () => {
    const screen = read('components/OrdersSignatureHome.tsx');
    const rail = read('components/DealerOrdersRail.tsx');
    expect(screen).toContain('DealerOrdersHubBoard');
    expect(screen).toContain('DealerOrdersRail');
    expect(screen).toContain('railStopsForTile');
    expect(screen).toContain('showDealerRail');
    expect(screen).toContain('DealerSearchBar');
    expect(screen).toContain('DealerQuotationsEntry');
    expect(screen).toContain('largeTitle');
    expect(screen).toContain('DealerEmptyState');
    expect(screen).toContain('DealerEmptyPanel');
    expect(screen).not.toMatch(/<OrdersFilterChips/);
    expect(screen).not.toContain('mobile.dealerAccount.ordersSubtitle');
    expect(screen).not.toContain('mobile.dealerAccount.ordersEyebrow');
    expect(rail).not.toContain('ScrollView');
    expect(rail).toContain('flex: 1');
    expect(rail).toContain('segments');
    assertFloor(screen);
    assertFloor(rail);
  });

  it('uses station-stub tickets and a brand Today/Past board', () => {
    const card = read('components/OrdersProgressCard.tsx');
    const stub = read('components/OrderStationStub.tsx');
    const header = read('components/OrdersDaySectionHeader.tsx');
    expect(card).toContain('OrderStationStub');
    expect(card).toContain('ProductThumb');
    expect(card).toContain('selectOrderStationStub');
    expect(stub).toContain('ORDER_STATION_CAPTION_KEY');
    expect(header).toContain('surfaceSecondary');
    expect(header).not.toContain('warningSoft');
    assertFloor(stub);
    assertFloor(header);
    assertFloor(read('components/DealerOrdersHubBoard.tsx'));
  });

  it('floors dealer identity and confirm-receipt sheet', () => {
    const detail = read('OrderDetailScreen.tsx');
    const identity = read('components/OrderIdentityBoard.tsx');
    const sheet = read('components/ConfirmReceiptSheet.tsx');
    expect(detail).toContain('ScreenBackLead');
    expect(detail).toContain('OrderStationStub');
    expect(detail).toContain("variant === 'dealer' ? null : <ImageCarousel");
    expect(identity).toContain('ProductThumb');
    expect(sheet).toContain('DealerBoard');
    expect(sheet).toContain('DealerFormFooter');
    expect(sheet).toContain('fitContent');
    assertFloor(identity);
    assertFloor(sheet);
  });
});
