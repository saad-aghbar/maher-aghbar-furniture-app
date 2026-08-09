import { SurfaceTabsLayout } from '@/navigation/SurfaceTabsLayout';
import { customerTabs } from '@/navigation/tabConfig';

export default function CustomerTabsLayout() {
  return (
    <SurfaceTabsLayout
      surface="customer"
      screens={customerTabs.map((t) => ({ name: t.name, labelKey: t.labelKey }))}
    />
  );
}
