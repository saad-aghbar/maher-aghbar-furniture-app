import { SurfaceTabsLayout } from '@/navigation/SurfaceTabsLayout';
import {
  customerBasketTab,
  customerNewOrderTab,
  customerScheduleTab,
  customerTabs,
} from '@/navigation/tabConfig';

export default function CustomerTabsLayout() {
  const screens = [
    ...customerTabs.map((t) => ({ name: t.name, labelKey: t.labelKey })),
    // Hidden routes — registered for routing, href:null via visibility (not in customerTabs).
    { name: customerScheduleTab.name, labelKey: customerScheduleTab.labelKey },
    { name: customerNewOrderTab.name, labelKey: customerNewOrderTab.labelKey },
    { name: customerBasketTab.name, labelKey: customerBasketTab.labelKey },
  ];
  return <SurfaceTabsLayout surface="customer" screens={screens} />;
}
