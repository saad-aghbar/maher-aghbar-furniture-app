import { fireEvent } from '@testing-library/react-native';
import { emptyOrderLine } from '../newOrderLine';
import { OrderBasketItemRail } from '../components/OrderBasketItemRail';
import { renderScreen } from '@/test/screenHarness';

describe('OrderBasketItemRail', () => {
  it('selects another piece and can remove the hero ticket', async () => {
    const onSelect = jest.fn();
    const onRemove = jest.fn();
    const onOpenBasket = jest.fn();
    const first = emptyOrderLine({ customProductName: 'Karina', quantity: '2', productId: 'p1' });
    const second = emptyOrderLine({
      customProductName: 'Corner bench',
      productId: '',
      quantity: '1',
    });
    const view = await renderScreen(
      <OrderBasketItemRail
        lines={[first, second]}
        activeId={first.id}
        onSelect={onSelect}
        onRemove={onRemove}
        onOpenBasket={onOpenBasket}
      />,
    );
    fireEvent.press(view.getByTestId(`order-item-rail-${second.id}`));
    expect(onSelect).toHaveBeenCalledWith(second.id);
    fireEvent.press(view.getByTestId(`order-item-rail-remove-${first.id}`));
    expect(onRemove).toHaveBeenCalledWith(first.id);
    fireEvent.press(view.getByTestId('order-item-rail-open-basket'));
    expect(onOpenBasket).toHaveBeenCalled();
  });
});
