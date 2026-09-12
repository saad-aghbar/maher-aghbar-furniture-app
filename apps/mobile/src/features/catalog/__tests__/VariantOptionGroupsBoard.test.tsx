import { VariantOptionGroupsBoard } from '../components/VariantOptionGroupsBoard';
import { renderScreen } from '@/test/screenHarness';

describe('VariantOptionGroupsBoard', () => {
  it('renders nothing when there are no active spec groups', async () => {
    const view = await renderScreen(
      <VariantOptionGroupsBoard
        groups={[]}
        values={[]}
        selectedByGroup={{}}
        onChange={() => undefined}
      />,
    );
    expect(view.queryByText('Foam density')).toBeNull();
    expect(view.queryByLabelText(/pick/i)).toBeNull();
  });
});
