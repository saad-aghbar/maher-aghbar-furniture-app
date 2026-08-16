import type { Locale } from '@maher/database';
import type { SequenceService } from '../sequence.service';
import type { PrismaService } from '../prisma.service';

export type ProvisionDealerCustomerInput = {
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  preferredLanguage?: Locale | null;
  createdById?: string | null;
};

/**
 * Creates a dealer (Customer) row and links it to a portal user.
 * Used when a CUSTOMER-role user was created without a dealer record.
 */
export async function provisionLinkedDealerCustomer(
  prisma: PrismaService,
  sequences: SequenceService,
  input: ProvisionDealerCustomerInput,
): Promise<string> {
  const name = `${input.firstName} ${input.lastName}`.trim() || input.firstName || 'Dealer';
  const code = await sequences.next('CUST', 'CUST');

  const customer = await prisma.customer.create({
    data: {
      code,
      name,
      nameEn: name,
      customerType: 'COMPANY',
      phone: input.phone?.trim() || null,
      email: input.email?.trim()?.toLowerCase() || null,
      preferredLanguage: input.preferredLanguage ?? 'ar',
      status: 'ACTIVE',
      createdById: input.createdById ?? input.userId,
      updatedById: input.createdById ?? input.userId,
      addresses: {
        create: {
          label: 'Primary',
          city: 'Amman',
          country: 'JO',
          isDefaultBilling: true,
          isDefaultDelivery: true,
        },
      },
    },
    select: { id: true },
  });

  await prisma.user.update({
    where: { id: input.userId },
    data: { customerId: customer.id },
  });

  return customer.id;
}

export function roleCodesIncludeCustomer(
  roles: ReadonlyArray<{ code: string; kind?: string | null }>,
): boolean {
  return roles.some((r) => r.code === 'CUSTOMER' || r.kind === 'CUSTOMER');
}
