import { readFileSync } from 'fs';
import { join } from 'path';

const picker = readFileSync(
  join(__dirname, '../components/BomMaterialPickerSheet.tsx'),
  'utf8',
);

describe('BomMaterialPickerSheet create-fabric chain', () => {
  it('closes the picker before opening create so iOS can show the next sheet', () => {
    expect(picker).toContain('fabricNotInSystem');
    expect(picker).toContain('queueCreateFabric');
    expect(picker).toContain('open={open && !createQueued}');
    expect(picker).toMatch(/if \(createQueuedRef\.current\) \{\s*setCreateOpen\(true\)/);
    expect(picker).toContain('CreateInventoryItemSheet');
  });

  it('does not reopen the picker or apply the fabric until create has fully closed', () => {
    expect(picker).toContain('onClose={dismissCreateFabric}');
    expect(picker).toContain('onClosed={onCreateClosed}');
    expect(picker).toContain('pendingCreatedRef.current = created');
    expect(picker).toContain('if (created) applyCreated(created)');
    expect(picker).not.toMatch(/function dismissCreateFabric\(\) \{[^}]*setCreateQueued\(false\)/);
  });

  it('can hide unit cost and line total for floor extras', () => {
    expect(picker).toContain('hideCost');
    expect(picker).toContain('catalog.lineTotal');
    expect(picker).toContain('{hideCost ? (');
  });

  it('adds a floor extra when the worker presses the material row', () => {
    expect(picker).toContain('if (hideCost)');
    expect(picker).toContain('qty: 1');
    expect(picker).toContain('keepOpenOnPick');
    expect(picker).toContain('if (!keepOpenOnPick) onClose()');
  });

  it('pins a confirm footer while the picker stays open for another SKU', () => {
    expect(picker).toContain('InventorySheetFooter');
    expect(picker).toContain('recoveryConfirmParts');
    expect(picker).toContain('{keepOpenOnPick ? (');
  });

  it('offers Scan QR only when the parent passes onRequestScan', () => {
    expect(picker).toContain('onRequestScan');
    expect(picker).toContain('SearchActionRow');
    expect(picker).toContain('qr-code-outline');
    expect(picker).toContain('{onRequestScan ? (');
    expect(picker).not.toContain('ScanInventoryItemAction');
    expect(picker).not.toContain('KnownItemLabelConfirm');
  });
});
