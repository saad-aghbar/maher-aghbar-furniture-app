import { apiDelete, apiGet, apiPatch, apiPost } from '../client';
import { toSearchParams, type PageParams } from '../pagination';

export type CustomerType = 'INDIVIDUAL' | 'COMPANY' | 'SHOWROOM';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'ON_HOLD';

export type CustomerMetrics = {
  waitingOrdersCount?: number;
  inWorkOrdersCount?: number;
  doneOrdersCount?: number;
  activeOrdersCount?: number;
  invoicedTotal?: number;
  paidTotal?: number;
  outstandingTotal?: number;
};

export type CustomerContact = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  position?: string | null;
  isPrimary?: boolean;
};

export type CustomerAddress = {
  id: string;
  label?: string | null;
  line1: string;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  area?: string | null;
  isDefaultDelivery?: boolean;
  isDefaultBilling?: boolean;
  latitude?: number | null;
  longitude?: number | null;
};

export type CustomerListItem = {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  nameEn?: string | null;
  nameHe?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  customerType?: CustomerType | string;
  companyName?: string | null;
  status?: CustomerStatus | string;
} & CustomerMetrics;

export type CustomerDetail = CustomerListItem & {
  notes?: string | null;
  preferredLanguage?: string | null;
  contacts?: CustomerContact[];
  addresses?: CustomerAddress[];
};

export type CreateCustomerInput = {
  nameAr?: string;
  nameEn?: string;
  nameHe?: string;
  customerType?: CustomerType | string;
  companyName?: string;
  phone: string;
  fax?: string;
  email?: string;
  preferredLanguage?: string;
  notes?: string;
  portalUsername: string;
  portalPassword: string;
  address: {
    label: string;
    city: string;
    street?: string;
    country?: string;
  };
};

export type UpdateCustomerInput = {
  nameAr?: string;
  nameEn?: string;
  nameHe?: string;
  customerType?: CustomerType | string;
  companyName?: string | null;
  phone?: string;
  fax?: string | null;
  email?: string | null;
  preferredLanguage?: string;
  notes?: string | null;
  status?: CustomerStatus | string;
};

export type CreateCustomerResult = CustomerDetail & {
  portalCredentials?: { username: string; temporaryPassword: string };
};

export type CommunicationNote = {
  id: string;
  type: string;
  summary: string;
  subject?: string | null;
  occurredAt?: string;
  createdAt?: string;
  employee?: { firstName?: string | null; lastName?: string | null } | null;
};

export type DealerPriceRow = {
  id: string;
  price: number | string;
  currency: string;
  productId?: string;
  product?: {
    id?: string;
    sku: string;
    nameEn: string;
    nameAr?: string | null;
    nameHe?: string | null;
    basePrice?: number | string | null;
    manufacturingCost?: number | string | null;
    imageUrl?: string | null;
  };
};

export async function listCustomers(
  params: PageParams & { q?: string; status?: string } = {},
) {
  const qs = toSearchParams(params);
  return apiGet<{ data: CustomerListItem[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }>(
    `/customers${qs}`,
  );
}

export async function getCustomer(id: string): Promise<CustomerDetail> {
  const row = await apiGet<CustomerDetail>(`/customers/${encodeURIComponent(id)}`);
  return {
    ...row,
    addresses: (row.addresses ?? []).map(normalizeAddress),
  };
}

function normalizeAddress(a: CustomerAddress & { street?: string | null }): CustomerAddress {
  return {
    ...a,
    line1: (a.line1 || a.street || a.city || '').trim() || '—',
  };
}

export async function createCustomer(body: CreateCustomerInput): Promise<CreateCustomerResult> {
  return apiPost<CreateCustomerResult>('/customers', body);
}

export async function updateCustomer(
  id: string,
  body: UpdateCustomerInput,
): Promise<CustomerDetail> {
  return apiPatch<CustomerDetail>(`/customers/${encodeURIComponent(id)}`, body);
}

export type DeleteCustomerInput = {
  portalUsername: string;
  portalPassword: string;
};

export async function deleteCustomer(
  id: string,
  body: DeleteCustomerInput,
): Promise<{ id: string; archived: true }> {
  return apiDelete(`/customers/${encodeURIComponent(id)}`, body);
}

export async function listCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const rows = await apiGet<CustomerAddress[]>(
    `/customers/${encodeURIComponent(customerId)}/addresses`,
  );
  return rows.map(normalizeAddress);
}

export async function createCustomerContact(
  customerId: string,
  body: { name: string; phone?: string; email?: string; position?: string },
): Promise<CustomerContact> {
  return apiPost(`/customers/${encodeURIComponent(customerId)}/contacts`, body);
}

export async function createCustomerAddress(
  customerId: string,
  body: {
    label: string;
    city: string;
    street?: string;
    country?: string;
    isDefaultDelivery?: boolean;
    isDefaultBilling?: boolean;
    latitude?: number;
    longitude?: number;
  },
): Promise<CustomerAddress> {
  return apiPost(`/customers/${encodeURIComponent(customerId)}/addresses`, body);
}

export async function updateCustomerAddress(
  customerId: string,
  addressId: string,
  body: {
    label: string;
    city: string;
    street?: string;
    country?: string;
    isDefaultDelivery?: boolean;
    isDefaultBilling?: boolean;
    latitude?: number | null;
    longitude?: number | null;
  },
): Promise<CustomerAddress> {
  return apiPatch(
    `/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
    body,
  );
}

export async function deleteCustomerAddress(
  customerId: string,
  addressId: string,
): Promise<CustomerAddress> {
  return apiDelete(
    `/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
  );
}

export async function listCustomerCommunications(
  customerId: string,
): Promise<CommunicationNote[]> {
  return apiGet(`/customers/${encodeURIComponent(customerId)}/communications`);
}

export async function createCustomerCommunication(
  customerId: string,
  body: { type: string; summary: string; subject?: string },
): Promise<CommunicationNote> {
  return apiPost(`/customers/${encodeURIComponent(customerId)}/communications`, body);
}

export async function updateCustomerCommunication(
  customerId: string,
  noteId: string,
  body: { summary: string; subject?: string; contactName?: string },
): Promise<CommunicationNote> {
  return apiPatch(
    `/customers/${encodeURIComponent(customerId)}/communications/${encodeURIComponent(noteId)}`,
    body,
  );
}

export async function listCustomerDealerPrices(
  customerId: string,
): Promise<DealerPriceRow[]> {
  return apiGet(`/customers/${encodeURIComponent(customerId)}/dealer-prices`);
}

export async function upsertCustomerDealerPrice(
  customerId: string,
  body: { productId: string; price: number; currency?: string },
): Promise<DealerPriceRow> {
  return apiPost(`/customers/${encodeURIComponent(customerId)}/dealer-prices`, {
    productId: body.productId,
    price: body.price,
    currency: body.currency ?? 'JOD',
  });
}

export async function deleteCustomerDealerPrice(
  customerId: string,
  priceId: string,
): Promise<unknown> {
  return apiDelete(
    `/customers/${encodeURIComponent(customerId)}/dealer-prices/${encodeURIComponent(priceId)}`,
  );
}
