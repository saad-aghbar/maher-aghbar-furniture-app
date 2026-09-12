import { fireEvent } from '@testing-library/react-native';
import { emptyOrderLine } from '../newOrderLine';
import { OrderBasketBoard } from '../components/OrderBasketBoard';
import { renderScreen } from '@/test/screenHarness';

describe('OrderBasketBoard', () => {
  it('adds, selects, and removes lines including the last remaining row', async () => {
    const onAdd = jest.fn();
    const onSelect = jest.fn();
    const onRemove = jest.fn();
    const onEditSpec = jest.fn();
    const first = emptyOrderLine({ customProductName: 'Karina', quantity: '2' });
    const second = emptyOrderLine({ customProductName: 'Milano', quantity: '1' });
    const view = await renderScreen(
      <OrderBasketBoard
        lines={[first, second]}
        activeId={first.id}
        onSelect={onSelect}
        onRemove={onRemove}
        onAdd={onAdd}
        onEditSpec={onEditSpec}
      />,
    );
    fireEvent.press(view.getByTestId(`order-basket-${first.id}`));
    expect(onSelect).toHaveBeenCalledWith(first.id);
    expect(onEditSpec).toHaveBeenCalledWith(first.id);
    fireEvent.press(view.getByTestId(`order-basket-remove-${second.id}`));
    expect(onRemove).toHaveBeenCalledWith(second.id);
    fireEvent.press(view.getByTestId(`order-basket-remove-${first.id}`));
    expect(onRemove).toHaveBeenCalledWith(first.id);
    fireEvent.press(view.getByTestId('order-basket-add'));
    expect(onAdd).toHaveBeenCalled();
  });
});
