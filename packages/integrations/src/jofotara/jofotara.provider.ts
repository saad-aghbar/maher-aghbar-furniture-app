import { randomUUID } from 'crypto';
import type { JoFotaraClearanceResult, JoFotaraInvoicePayload, JoFotaraProvider } from './types';

const DEFAULT_BASE = 'https://backend.jofotara.gov.jo/core/invoices/';

export class JoFotaraHttpProvider implements JoFotaraProvider {
  readonly name = 'jofotara';
  readonly hasCredentials: boolean;

  constructor(
    private readonly clientId: string | undefined,
    private readonly secretKey: string | undefined,
    private readonly baseUrl = process.env.JOFOTARA_BASE_URL ?? DEFAULT_BASE,
  ) {
    this.hasCredentials = Boolean(clientId?.trim() && secretKey?.trim());
  }

  async submitInvoice(payload: JoFotaraInvoicePayload): Promise<JoFotaraClearanceResult> {
    if (!this.hasCredentials) {
      const uuid = randomUUID();
      return {
        uuid,
        qr: `MOCK-JOFOTARA-QR:${uuid}`,
        status: 'MOCK_CLEARED',
        clearedAt: new Date(),
        mock: true,
      };
    }

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': this.clientId!,
        'Secret-Key': this.secretKey!,
      },
      body: JSON.stringify(payload.raw ?? payload),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`JoFotara clearance failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      uuid?: string;
      invoiceUUID?: string;
      qr?: string;
      qrCode?: string;
      status?: string;
      EINVqr?: string;
    };

    const uuid = json.uuid ?? json.invoiceUUID ?? randomUUID();
    const qr = json.qr ?? json.qrCode ?? json.EINVqr ?? `JOFOTARA-QR:${uuid}`;

    return {
      uuid,
      qr,
      status: json.status ?? 'CLEARED',
      clearedAt: new Date(),
      mock: false,
      providerResponse: json,
    };
  }
}

export function createJoFotaraProvider(env: NodeJS.ProcessEnv = process.env): JoFotaraProvider {
  return new JoFotaraHttpProvider(
    env.JOFOTARA_CLIENT_ID,
    env.JOFOTARA_SECRET_KEY,
    env.JOFOTARA_BASE_URL ?? DEFAULT_BASE,
  );
}
