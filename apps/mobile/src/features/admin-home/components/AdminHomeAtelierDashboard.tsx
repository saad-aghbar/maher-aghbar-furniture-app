import { View } from 'react-native';
import { AdminHomeActionRibbons } from './AdminHomeActionRibbons';
import { AdminHomeRecentCard } from './AdminHomeRecentCard';
import { AdminHomeSignalMarquee } from './AdminHomeSignalMarquee';
import { AdminHomeStageBoard } from './AdminHomeStageBoard';
import { AdminHomeTrackingCard } from './AdminHomeTrackingCard';
import { UrgentAlertCard } from './UrgentAlertCard';
import { UrgentTasksList } from './UrgentTasksList';
import { pickTrackingOrder } from '../pickTrackingOrder';
import { selectUrgentAlert } from '../selectUrgentAlert';
import type { AdminHomePayload } from '../api';

type Props = {
  data: AdminHomePayload;
};

/**
 * Preserved atelier ops dashboard (pre–living-home).
 * Kept intact so we can restore via `ADMIN_HOME_COMPOSITION = 'atelierDashboard'`.
 *
 * Structure:
 * 1. Production queues (What to clear next + pressure + featured + ranked + throughput)
 * 2. Floor stage board
 * 3. Tracking spotlight
 * 4. Zigzag action ribbons
 * 5. Urgent alert stamp
 * 6. Recent timeline
 * 7. Worker tickets
 */
export function AdminHomeAtelierDashboard({ data }: Props) {
  const alert = selectUrgentAlert(data);
  const tracking = pickTrackingOrder(data);

  return (
    <View>
      <AdminHomeSignalMarquee data={data} />
      <AdminHomeStageBoard data={data} />
      {tracking ? (
        <AdminHomeTrackingCard
          order={tracking.order}
          stepIndex={tracking.stepIndex}
          reason={tracking.reason}
          peerCount={tracking.peerCount}
        />
      ) : null}
      <AdminHomeActionRibbons />
      {alert ? <UrgentAlertCard alert={alert} /> : null}
      <AdminHomeRecentCard orders={data.recentOrders} />
      <UrgentTasksList tasks={data.urgentTasks} />
    </View>
  );
}
