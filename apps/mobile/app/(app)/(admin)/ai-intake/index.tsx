import { Redirect, type Href } from 'expo-router';

/** Legacy More tile / list — AI reading lives on the dealer request. */
export default function AdminAiIntakeListRoute() {
  return <Redirect href={'/(app)/(admin)/(tabs)/orders' as Href} />;
}
