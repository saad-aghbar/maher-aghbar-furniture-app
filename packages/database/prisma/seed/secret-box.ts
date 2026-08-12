/**
 * Keep in sync with apps/api/src/common/helpers/secret-box.ts
 * (seed cannot import the API package).
 */
import { createCipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'v1';
const IV_LEN = 12;

function deriveSecretBoxKey(keyMaterial: string): Buffer {
  return createHash('sha256').update(keyMaterial, 'utf8').digest();
}

function portalPasswordKey(env: NodeJS.ProcessEnv = process.env): string {
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
  const key = deriveSecretBoxKey(portalPasswordKey(env));
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
