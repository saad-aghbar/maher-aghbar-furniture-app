import { createHash, randomUUID } from 'crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, promises as fs } from 'fs';
import { dirname, join, extname } from 'path';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';
import type { ObjectStorage, StoredObject } from './storage.types';

/** Local filesystem backend under LOCAL_UPLOAD_DIR (default ./uploads). */
export class LocalDiskStorage implements ObjectStorage {
  private readonly root = process.env.LOCAL_UPLOAD_DIR
    ? process.env.LOCAL_UPLOAD_DIR
    : join(process.cwd(), '../../uploads');

  constructor() {
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }

  async putObject(
    fileName: string,
    mimeType: string,
    data: Buffer | Readable,
  ): Promise<StoredObject> {
    const safeExt = extname(fileName).slice(0, 12);
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${safeExt}`;
    const fullPath = join(this.root, key);
    mkdirSync(dirname(fullPath), { recursive: true });

    if (Buffer.isBuffer(data)) {
      await fs.writeFile(fullPath, data);
      return { key, sizeBytes: data.length, mimeType };
    }

    await pipeline(data, createWriteStream(fullPath));
    const stat = await fs.stat(fullPath);
    return { key, sizeBytes: stat.size, mimeType };
  }

  async getObjectStream(key: string) {
    const fullPath = join(this.root, key);
    if (!existsSync(fullPath)) {
      throw new Error('Object not found');
    }
    return createReadStream(fullPath);
  }

  createAccessToken(key: string, ttlSeconds = 900): string {
    const exp = Date.now() + ttlSeconds * 1000;
    const secret = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-min-32-chars!!';
    const payload = `${key}|${exp}`;
    const sig = createHash('sha256').update(`${payload}|${secret}`).digest('hex').slice(0, 24);
    return Buffer.from(`${payload}|${sig}`).toString('base64url');
  }

  verifyAccessToken(token: string): string {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [key, expStr, sig] = raw.split('|');
    if (!key || !expStr || !sig) throw new Error('Invalid token');
    const secret = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me-min-32-chars!!';
    const expected = createHash('sha256')
      .update(`${key}|${expStr}|${secret}`)
      .digest('hex')
      .slice(0, 24);
    if (sig !== expected) throw new Error('Invalid token signature');
    if (Date.now() > Number(expStr)) throw new Error('Token expired');
    return key;
  }
}
