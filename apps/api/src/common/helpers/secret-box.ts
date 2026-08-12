import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'v1';
const IV_LEN = 12;

export function deriveSecretBoxKey(keyMaterial: string): Buffer {
  return createHash('sha256').update(keyMaterial, 'utf8').digest();
}

/** AES-256-GCM. Payload: `v1.<iv>.<tag>.<ciphertext>` (base64url). */
export function encryptSecret(plain: string, keyMaterial: string): string {
  const key = deriveSecretBoxKey(keyMaterial);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptSecret(payload: string, keyMaterial: string): string | null {
  try {
    const parts = payload.split('.');
    if (parts.length !== 4 || parts[0] !== PREFIX) return null;
    const ivB64 = parts[1];
    const tagB64 = parts[2];
    const dataB64 = parts[3];
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const key = deriveSecretBoxKey(keyMaterial);
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function portalPasswordKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.PORTAL_PASSWORD_KEY || env.JWT_ACCESS_SECRET;
  if (!key || key.length < 16) {
    throw new Error(
      'PORTAL_PASSWORD_KEY or JWT_ACCESS_SECRET is required to store dealer portal passwords.',
    );
  }
  return key;
}

export function encryptPortalPassword(
  plain: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return encryptSecret(plain, portalPasswordKey(env));
}

export function decryptPortalPassword(
  payload: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!payload) return null;
  return decryptSecret(payload, portalPasswordKey(env));
}
