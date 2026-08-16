import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryKeys';
import { invalidateKeys } from '@/api/queryKeys';
import {
  approveSchedule,
  dealerDateChange,
  getAtRisk,
  getCalendar,
  getCapacity,
  getConflicts,
  getDashboard,
  getOrderSchedule,
  postAvailability,
  recalculateSchedule,
  getOwnDeliveries,
  type AvailabilityRequest,
  type CapacityQueryParams,
} from '@/api/modules/scheduling';

/** Dealer + admin — checks factory availability for a set of draft items. */
export function useAvailabilityQuery(request: AvailabilityRequest | null) {
  return useQuery({
    queryKey: queryKeys.scheduling.availability(request ?? {}),
    queryFn: () => postAvailability(request!),
    enabled: Boolean(request && request.items.length > 0),
    staleTime: 15_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}

/** Order schedule — dealer-safe or admin-enriched shape depending on caller role. */
export function useOrderScheduleQuery(productionOrderId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.scheduling.orderSchedule(productionOrderId ?? ''),
    queryFn: () => getOrderSchedule(productionOrderId!),
    enabled: Boolean(productionOrderId) && enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useOwnDeliveriesQuery(
  params: { from?: string; to?: string } | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.scheduling.ownDeliveries(params ?? {}),
    queryFn: () => getOwnDeliveries(params),
    enabled,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useSchedulingDashboardQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.scheduling.dashboard(),
    queryFn: () => getDashboard(),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useAtRiskQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.scheduling.atRisk(),
    queryFn: () => getAtRisk(),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useSchedulingCalendarQuery(
  params: { from: string; to: string; view?: 'day' | 'week' | 'month' } | null,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.scheduling.calendar(params ?? {}),
    queryFn: () => getCalendar(params!),
    enabled: Boolean(params) && enabled,
    staleTime: 30_000,
    /** Month prev/next must not blank the whole board. */
    placeholderData: keepPreviousData,
  });
}

export function useSchedulingCapacityQuery(params: CapacityQueryParams | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.scheduling.capacity(params ?? {}),
    queryFn: () => getCapacity(params!),
    enabled: Boolean(params) && enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useSchedulingConflictsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.scheduling.conflicts(),
    queryFn: () => getConflicts(),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useDealerDateChangeMutation(productionOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { requestedDeliveryDate: string; reason?: string; idempotencyKey?: string }) =>
      dealerDateChange(productionOrderId, body),
    onSuccess: () => {
      for (const key of invalidateKeys.afterScheduleMutation(productionOrderId)) {
        void queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
      }
    },
  });
}

export function useApproveScheduleMutation(productionOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { version: number; idempotencyKey?: string }) =>
      approveSchedule(productionOrderId, body),
    onSuccess: () => {
      for (const key of invalidateKeys.afterScheduleMutation(productionOrderId)) {
        void queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
      }
    },
  });
}

export function useRecalculateScheduleMutation(productionOrderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { mode?: 'forward' | 'backward'; reason?: string } = {}) =>
      recalculateSchedule(productionOrderId, body),
    onSuccess: () => {
      for (const key of invalidateKeys.afterScheduleMutation(productionOrderId)) {
        void queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
      }
    },
  });
}
