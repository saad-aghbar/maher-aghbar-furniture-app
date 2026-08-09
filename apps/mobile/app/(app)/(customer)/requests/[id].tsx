import { useLocalSearchParams } from 'expo-router';
import { EditRequestScreen } from '@/features/requests/EditRequestScreen';

export default function CustomerRequestDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditRequestScreen requestId={String(id)} />;
}
