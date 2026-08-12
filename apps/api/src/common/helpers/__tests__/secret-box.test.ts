import {
  decryptPortalPassword,
  decryptSecret,
  encryptPortalPassword,
  encryptSecret,
} from '../secret-box';

const KEY = 'dev-access-secret-change-me-min-32-chars!!';

describe('secret-box', () => {
  it('round-trips unicode plaintext', () => {
    const plain = 'مفروشات-123!';
    const enc = encryptSecret(plain, KEY);
    expect(enc.startsWith('v1.')).toBe(true);
    expect(enc).not.toContain(plain);
    expect(decryptSecret(enc, KEY)).toBe(plain);
  });

  it('uses a fresh iv so two encryptions differ', () => {
    const a = encryptSecret('123', KEY);
    const b = encryptSecret('123', KEY);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, KEY)).toBe('123');
    expect(decryptSecret(b, KEY)).toBe('123');
  });

  it('returns null when the payload is tampered', () => {
    const enc = encryptSecret('nile-pass', KEY);
    const parts = enc.split('.');
    parts[3] = Buffer.from('nope').toString('base64url');
    expect(decryptSecret(parts.join('.'), KEY)).toBeNull();
  });

  it('returns null for a wrong key or junk payload', () => {
    const enc = encryptSecret('123', KEY);
    expect(decryptSecret(enc, 'other-key-material-min-32-chars!!!!')).toBeNull();
    expect(decryptSecret('not-a-blob', KEY)).toBeNull();
    expect(decryptSecret('', KEY)).toBeNull();
  });

  it('encryptPortalPassword does not store plaintext', () => {
    const env = { JWT_ACCESS_SECRET: KEY };
    const enc = encryptPortalPassword('secret-pass', env);
    expect(enc).not.toContain('secret-pass');
    expect(decryptPortalPassword(enc, env)).toBe('secret-pass');
    expect(decryptPortalPassword(null, env)).toBeNull();
  });
});
