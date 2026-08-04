import { createHmac, randomBytes } from 'crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Generate a base32 TOTP secret suitable for authenticator apps. */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function buildOtpauthUrl(opts: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = opts.issuer ?? 'MaherERP';
  const label = encodeURIComponent(`${issuer}:${opts.accountName}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  const cleaned = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  const secret = base32Decode(secretBase32);
  if (!secret.length) return false;
  const now = Math.floor(Date.now() / 1000 / 30);
  for (let w = -window; w <= window; w++) {
    if (hotp(secret, now + w) === cleaned) return true;
  }
  return false;
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
