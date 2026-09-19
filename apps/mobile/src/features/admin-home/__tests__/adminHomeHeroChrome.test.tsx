import { renderAdaptive } from '@/test/adaptiveHarness';
import { AdminHomeLivingHero } from '../components/AdminHomeLivingHero';

function hero() {
  return (
    <AdminHomeLivingHero
      userName="Maher Aghbar"
      unreadNotifications={0}
      canOpenNotifications={false}
      attention={0}
    />
  );
}

describe('AdminHomeLivingHero chrome', () => {
  it('offers text size next to the language switcher on sidebar widths', async () => {
    const view = await renderAdaptive(hero(), { width: 1366 });
    expect(view.getByTestId('locale-switcher')).toBeTruthy();
    expect(view.getByLabelText('Text size')).toBeTruthy();
  });

  it('leaves text size to the More hub on phone widths', async () => {
    const view = await renderAdaptive(hero(), { width: 390 });
    expect(view.getByTestId('locale-switcher')).toBeTruthy();
    expect(view.queryByLabelText('Text size')).toBeNull();
  });
});
