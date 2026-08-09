import { SurfaceTabsLayout } from '@/navigation/SurfaceTabsLayout';
import { employeeTabs } from '@/navigation/tabConfig';

export default function EmployeeTabsLayout() {
  return (
    <SurfaceTabsLayout
      surface="employee"
      screens={employeeTabs.map((t) => ({ name: t.name, labelKey: t.labelKey }))}
    />
  );
}
