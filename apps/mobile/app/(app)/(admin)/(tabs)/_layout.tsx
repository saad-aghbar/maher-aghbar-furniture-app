import { SurfaceTabsLayout } from '@/navigation/SurfaceTabsLayout';
import { adminTabs } from '@/navigation/tabConfig';

export default function AdminTabsLayout() {
  return (
    <SurfaceTabsLayout
      surface="admin"
      screens={adminTabs.map((t) => ({ name: t.name, labelKey: t.labelKey }))}
    />
  );
}
