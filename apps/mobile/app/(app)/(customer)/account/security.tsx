import { type Href } from 'expo-router';
import { MoreAccountScreen } from '@/features/more/MoreAccountScreen';

export default function CustomerAccountSecurityRoute() {
  return (
    <MoreAccountScreen
      backFallback={'/(app)/(customer)/(tabs)/account' as Href}
      titleMode="dealer"
    />
  );
}
