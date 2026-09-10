import { openDriverDeliveryScope } from './delivery-load.service';

describe('openDriverDeliveryScope', () => {
  it('includes packed outbound sales orders and return reships', () => {
    const scope = openDriverDeliveryScope();
    expect(scope.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ salesOrderId: { not: null } }),
        { purpose: 'RETURN_RESHIP' },
      ]),
    );
  });
});
