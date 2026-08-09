import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, invalidateKeys } from '@/api/queryKeys';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './api';

export function useNotificationsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => listNotifications({ page: 1, pageSize: 50 }),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      for (const key of invalidateKeys.afterNotificationRead()) {
        await qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      for (const key of invalidateKeys.afterNotificationRead()) {
        await qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
