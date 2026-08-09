import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCustomer,
  createCustomerAddress,
  createCustomerCommunication,
  createCustomerContact,
  deleteCustomer,
  deleteCustomerAddress,
  deleteCustomerDealerPrice,
  getCustomer,
  listCustomerCommunications,
  listCustomerDealerPrices,
  listCustomers,
  updateCustomer,
  updateCustomerAddress,
  updateCustomerCommunication,
  upsertCustomerDealerPrice,
  type CreateCustomerInput,
  type DeleteCustomerInput,
  type UpdateCustomerInput,
} from '@/api/modules/customers';
import { queryKeys } from '@/api/queryKeys';

export function useDealersListQuery(filters: { page?: number; pageSize?: number; q?: string }) {
  return useQuery({
    queryKey: queryKeys.dealers.list(filters),
    queryFn: () =>
      listCustomers({
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 40,
        q: filters.q?.trim() || undefined,
      }),
  });
}

export function useDealerDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dealers.detail(id ?? ''),
    queryFn: () => getCustomer(id!),
    enabled: Boolean(id),
  });
}

export function useDealerNotesQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dealers.notes(id ?? ''),
    queryFn: () => listCustomerCommunications(id!),
    enabled: Boolean(id),
  });
}

export function useDealerPricesQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dealers.prices(id ?? ''),
    queryFn: () => listCustomerDealerPrices(id!),
    enabled: Boolean(id),
  });
}

function invalidateDealer(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: queryKeys.dealers.lists() });
  if (id) {
    void qc.invalidateQueries({ queryKey: queryKeys.dealers.detail(id) });
    void qc.invalidateQueries({ queryKey: queryKeys.dealers.notes(id) });
    void qc.invalidateQueries({ queryKey: queryKeys.dealers.prices(id) });
  }
}

export function useCreateDealerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCustomerInput) => createCustomer(body),
    onSuccess: () => invalidateDealer(qc),
  });
}

export function useUpdateDealerMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCustomerInput) => updateCustomer(id, body),
    onSuccess: () => invalidateDealer(qc, id),
  });
}

export function useDeleteDealerMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DeleteCustomerInput) => deleteCustomer(id, body),
    onSuccess: () => invalidateDealer(qc, id),
  });
}

export function useAddDealerContactMutation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; phone?: string; email?: string; position?: string }) =>
      createCustomerContact(customerId, body),
    onSuccess: () => invalidateDealer(qc, customerId),
  });
}

export function useAddDealerAddressMutation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      label: string;
      city: string;
      street?: string;
      country?: string;
      isDefaultDelivery?: boolean;
      isDefaultBilling?: boolean;
      latitude?: number;
      longitude?: number;
    }) => createCustomerAddress(customerId, body),
    onSuccess: () => invalidateDealer(qc, customerId),
  });
}

export function useUpdateDealerAddressMutation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      addressId: string;
      body: {
        label: string;
        city: string;
        street?: string;
        country?: string;
        isDefaultDelivery?: boolean;
        isDefaultBilling?: boolean;
        latitude?: number | null;
        longitude?: number | null;
      };
    }) => updateCustomerAddress(customerId, args.addressId, args.body),
    onSuccess: () => invalidateDealer(qc, customerId),
  });
}

export function useDeleteDealerAddressMutation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) => deleteCustomerAddress(customerId, addressId),
    onSuccess: () => invalidateDealer(qc, customerId),
  });
}

export function useAddDealerNoteMutation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (summary: string) =>
      createCustomerCommunication(customerId, { type: 'NOTE', summary }),
    onSuccess: () => invalidateDealer(qc, customerId),
  });
}

export function useUpdateDealerNoteMutation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { noteId: string; summary: string }) =>
      updateCustomerCommunication(customerId, args.noteId, { summary: args.summary }),
    onSuccess: () => invalidateDealer(qc, customerId),
  });
}

export function useUpsertDealerPriceMutation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { productId: string; price: number; currency?: string }) =>
      upsertCustomerDealerPrice(customerId, body),
    onSuccess: () => invalidateDealer(qc, customerId),
  });
}

export function useDeleteDealerPriceMutation(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (priceId: string) => deleteCustomerDealerPrice(customerId, priceId),
    onSuccess: () => invalidateDealer(qc, customerId),
  });
}
