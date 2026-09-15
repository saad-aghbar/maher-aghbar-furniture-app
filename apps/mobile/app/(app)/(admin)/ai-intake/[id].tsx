import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { can } from '@maher/permissions';
import { getAiJob } from '@/api/modules/ai-intake';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { AppScreen } from '@/components/layout/AppScreen';
import { useLocale } from '@/i18n';

/** Old job links open the linked request — there is no separate intake inbox. */
export default function AdminAiIntakeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLocale();
  const jobId = String(id ?? '');
  const allowed = can(user, 'ai-intake.read') || can(user, 'request.read');
  const query = useQuery({
    queryKey: queryKeys.aiIntake.detail(jobId),
    queryFn: () => getAiJob(jobId),
    enabled: allowed && Boolean(jobId),
    retry: false,
  });
  const requestId = query.data?.request?.id;
  if (requestId) {
    return <Redirect href={`/(app)/(admin)/requests/${requestId}` as Href} />;
  }
  if (query.isPending && allowed && jobId) {
    return (
      <AppScreen>
        <AppText color="muted">{t('mobile.adminRequest.loading')}</AppText>
      </AppScreen>
    );
  }
  return <Redirect href={'/(app)/(admin)/(tabs)/orders' as Href} />;
}
