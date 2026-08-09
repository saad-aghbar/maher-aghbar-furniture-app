import { View } from 'react-native';
import { AdminHomeFloorJourney } from './AdminHomeFloorJourney';
import { AdminHomeFocusMoment } from './AdminHomeFocusMoment';
import { AdminHomeMoments } from './AdminHomeMoments';
import { AdminHomeQuickAccess } from './AdminHomeQuickAccess';
import { pickHomeFocus } from '../pickHomeFocus';
import type { AdminHomePayload } from '../api';

type Props = {
  data: AdminHomePayload;
};

/**
 * Living mobile Home — same calm hierarchy as signature (no repeats).
 */
export function AdminHomeLivingHome({ data }: Props) {
  const focus = pickHomeFocus(data);

  return (
    <View>
      <AdminHomeFocusMoment focus={focus} />
      <AdminHomeFloorJourney data={data} />
      <AdminHomeQuickAccess />
      <AdminHomeMoments orders={data.recentOrders} />
    </View>
  );
}
