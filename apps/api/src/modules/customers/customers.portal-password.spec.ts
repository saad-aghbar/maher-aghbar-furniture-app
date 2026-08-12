import { CustomersService } from './customers.service';

const KEY = 'dev-access-secret-change-me-min-32-chars!!';

describe('CustomersService dealer portal password', () => {
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = KEY;
  });

  it('writes portalPasswordEnc ciphertext, not plaintext', async () => {
    let userCreateData: Record<string, unknown> | undefined;
    const tx = {
      customer: {
        create: jest.fn().mockResolvedValue({ id: 'cus-1', name: 'Nile Interiors' }),
      },
      user: {
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          userCreateData = data;
          return Promise.resolve({ id: 'user-1' });
        }),
      },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      role: { findUnique: jest.fn().mockResolvedValue({ id: 'role-cust' }) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const sequences = { next: jest.fn().mockResolvedValue('CUST-0109') };
    const service = new CustomersService(
      prisma as never,
      sequences as never,
      {} as never,
    );

    await service.create(
      {
        nameEn: 'Nile Interiors',
        phone: '+962792100000',
        portalUsername: 'nile2',
        portalPassword: 'Showroom-Pass-1',
        address: { label: 'Showroom', city: 'Amman' },
      },
      'admin-1',
    );

    expect(userCreateData?.portalPasswordEnc).toEqual(expect.any(String));
    expect(String(userCreateData?.portalPasswordEnc)).not.toContain('Showroom-Pass-1');
    expect(userCreateData?.passwordHash).not.toBe('Showroom-Pass-1');
    expect(JSON.stringify(userCreateData)).not.toContain('Showroom-Pass-1');
  });
});
