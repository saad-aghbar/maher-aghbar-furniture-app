import { SurfaceTabsLayout } from '@/navigation/SurfaceTabsLayout';
import { customerNewOrderTab, customerTabs } from '@/navigation/tabConfig';

export default function CustomerTabsLayout() {
  const screens = [
    ...customerTabs.map((t) => ({ name: t.name, labelKey: t.labelKey })),
    // FAB destination — registered for routing, href:null via visibility (not in customerTabs).
    { name: customerNewOrderTab.name, labelKey: customerNewOrderTab.labelKey },
  ];
  return <SurfaceTabsLayout surface="customer" screens={screens} />;
}
