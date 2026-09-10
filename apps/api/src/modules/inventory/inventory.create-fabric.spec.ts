import { InventoryController } from './inventory.controller';

describe('inventory create fabric', () => {
  function makeCtrl() {
    const created: Array<Record<string, unknown>> = [];
    const inventory = {
      createItem: jest.fn(async (dto: Record<string, unknown>, userId: string) => {
        created.push({ ...dto, userId });
        return { id: 'inv-new', ...dto };
      }),
    };
    return {
      ctrl: new InventoryController(inventory as never, {} as never),
      created,
      inventory,
    };
  }

  it('lets production.setup.edit create a FABRIC item', async () => {
    const { ctrl, created } = makeCtrl();
    await ctrl.createItem(
      { nameEn: 'Velvet 302', nameAr: 'مخمل 302', category: 'FABRIC', standardCost: 18 } as never,
      { id: 'user-1', permissions: ['production.setup.edit'] } as never,
    );
    expect(created[0]).toMatchObject({ category: 'FABRIC', nameEn: 'Velvet 302' });
  });

  it('refuses production.setup.edit creating a non-fabric item', async () => {
    const { ctrl, inventory } = makeCtrl();
    await expect(
      Promise.resolve().then(() =>
        ctrl.createItem(
          { nameEn: 'Foam 28', nameAr: 'فوم 28', category: 'FOAM' } as never,
          { id: 'user-1', permissions: ['production.setup.edit'] } as never,
        ),
      ),
    ).rejects.toMatchObject({ response: { code: 'ITEM_CATEGORY_FORBIDDEN' } });
    expect(inventory.createItem).not.toHaveBeenCalled();
  });
});
