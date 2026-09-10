import { readFileSync } from 'fs';
import { join } from 'path';

const screen = readFileSync(join(__dirname, '../ReceiveGoodsScreen.tsx'), 'utf8');
const queue = readFileSync(join(__dirname, '../ReceiveQueueScreen.tsx'), 'utf8');
const verify = readFileSync(join(__dirname, '../components/ReceiveLineVerifyChip.tsx'), 'utf8');

describe('receive goods floor', () => {
  it('uses steppers, 44px targets, and floor boards', () => {
    expect(screen).toContain('QtyStepperField');
    expect(screen).toContain('PurchasingFloorBoard');
    expect(screen).toContain('theme.sizes.touch.min');
    expect(screen).toContain('useLabelVerifyScan');
    expect(screen).toContain('runLabelVerify');
    expect(screen).toContain('ReceiveFloorTrigger');
    expect(screen).toContain('caption={line.locationName}');
    expect(screen).toContain('receiveDestinationLabel');
    expect(verify).not.toContain("from '@/features/inventory/useLabelVerifyScan'");
    expect(verify).toContain('Presentation only');
    expect(screen).toContain('ReceiveLineVerifyChip');
    expect(screen).toContain('allReceiveLinesChecked');
    expect(screen).toContain('markLineReceived');
    expect(screen).toContain('reviewNeedsAllLines');
    expect(screen).toContain('notes');
    expect(screen).toContain('unitCostFromInventory');
    expect(screen).not.toContain('unitCostActual');
    expect(screen).not.toContain("update(line.lineId, { unitCost");
    expect(queue).toContain('InventoryBoardCard');
    expect(queue).toContain('orderBoardShadow');
    expect(screen).not.toContain('DeskCard');
    expect(queue).not.toContain('colors.info');
  });
});
