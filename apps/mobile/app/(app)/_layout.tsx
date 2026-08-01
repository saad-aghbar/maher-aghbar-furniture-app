import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/providers/auth-provider';
import { useI18n } from '../../src/providers/i18n-provider';
import { colors, typography } from '../../src/theme/tokens';

/**
 * Authenticated stack. The tab bar lives in `(tabs)`; every feature list and
 * detail screen pushes on top of it with a native header.
 *
 * Every route is registered with a translated title. Without this, the native
 * header falls back to the file-system route name, so a detail screen shows
 * "[id]" until its data loads and the back button inherits "(tabs)".
 */
export default function AppLayout() {
  const { user } = useAuth();
  const { t, direction } = useI18n();

  if (!user) return <Redirect href="/(auth)/login" />;

  const titles: Record<string, string> = {
    customers: t('navigation.customers', 'Customers'),
    deliveries: t('navigation.deliveries', 'Deliveries'),
    inventory: t('navigation.inventory', 'Inventory'),
    invoices: t('navigation.invoices', 'Invoices'),
    production: t('navigation.production', 'Production'),
    purchasing: t('navigation.purchasing', 'Purchasing'),
    quality: t('navigation.quality', 'Quality'),
    quotations: t('navigation.quotations', 'Quotations'),
    reports: t('navigation.reports', 'Reports'),
    requests: t('navigation.rfqRequests', 'Requests'),
    'sales-orders': t('navigation.salesOrders', 'Sales orders'),
    tasks: t('navigation.tasks', 'Tasks'),
  };

  /** Modules that also have a `[id]` detail route. */
  const withDetail = [
    'deliveries',
    'invoices',
    'production',
    'purchasing',
    'quality',
    'quotations',
    'requests',
    'sales-orders',
    'tasks',
  ];

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.brand,
        headerTitleStyle: { ...typography.heading, color: colors.textPrimary },
        headerShadowVisible: false,
        // Chevron only. Any text label here would be the previous route's
        // title, which is how "(tabs)" ended up on the back button.
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: '',
        contentStyle: { backgroundColor: colors.background },
        animation: direction === 'rtl' ? 'slide_from_left' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {Object.entries(titles).map(([route, title]) => (
        <Stack.Screen key={route} name={`${route}/index`} options={{ title }} />
      ))}
      {withDetail.map((route) => (
        <Stack.Screen key={`${route}-detail`} name={`${route}/[id]`} options={{ title: titles[route] }} />
      ))}
    </Stack>
  );
}
