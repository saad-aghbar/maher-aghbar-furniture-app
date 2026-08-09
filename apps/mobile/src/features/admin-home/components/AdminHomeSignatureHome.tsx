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
 * Clear factory Home — one next step, floor glance, places to go, recent.
 * No repeating attention meters, spotlights, or ticket lists.
 */
export function AdminHomeSignatureHome({ data }: Props) {
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
