import { Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'crypto';
import { extname } from 'path';
import type { Readable } from 'stream';
import { Readable as NodeReadable } from 'stream';
import type { ObjectStorage, StoredObject } from './storage.types';
import { resolveJwtAccessSecret } from '../../common/helpers/jwt-secret';

/**
 * MinIO / S3-compatible storage. Used when S3_ENDPOINT + credentials are set.
 * AWS SigV4 via fetch (no SDK dependency).
 */
@Injectable()
export class S3StorageService implements ObjectStorage {
  private readonly log = new Logger(S3StorageService.name);
  private readonly endpoint: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly bucket: string;
  private readonly forcePathStyle: boolean;

  constructor() {
    this.endpoint = (process.env.S3_ENDPOINT ?? '').replace(/\/$/, '');
    this.region = process.env.S3_REGION ?? 'us-east-1';
    this.accessKey = process.env.S3_ACCESS_KEY ?? '';
    this.secretKey = process.env.S3_SECRET_KEY ?? '';
    this.bucket = process.env.S3_BUCKET ?? 'maher-erp';
    this.forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';
  }

  /** Opt-in only — set STORAGE_PROVIDER=s3 plus S3_* credentials. */
  static isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    if ((env.STORAGE_PROVIDER ?? '').toLowerCase() !== 's3') return false;
    return Boolean(
      env.S3_ENDPOINT?.trim() &&
        env.S3_ACCESS_KEY?.trim() &&
        env.S3_SECRET_KEY?.trim() &&
        env.S3_BUCKET?.trim(),
    );
  }

  async putObject(
    fileName: string,
    mimeType: string,
    data: Buffer | Readable,
  ): Promise<StoredObject> {
    const safeExt = extname(fileName).slice(0, 12);
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${safeExt}`;
    const body = Buffer.isBuffer(data) ? data : await readableToBuffer(data);
    const url = this.objectUrl(key);
    const headers = this.signedHeaders('PUT', key, mimeType, body);
    const res = await fetch(url, { method: 'PUT', headers, body });
    if (!res.ok) {
      const text = await res.text();
      this.log.error(`S3 PUT failed ${res.status}: ${text}`);
      throw new Error(`S3 upload failed (${res.status})`);
    }
    return { key, sizeBytes: body.length, mimeType };
  }

  async getObjectStream(key: string): Promise<Readable> {
    const url = this.objectUrl(key);
    const headers = this.signedHeaders('GET', key);
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok || !res.body) {
      throw new Error('Object not found');
    }
    return NodeReadable.fromWeb(res.body as import('stream/web').ReadableStream);
  }

  createAccessToken(key: string, ttlSeconds = 900): string {
    const exp = Date.now() + ttlSeconds * 1000;
    const secret = resolveJwtAccessSecret();
    const payload = `${key}|${exp}`;
    const sig = createHash('sha256').update(`${payload}|${secret}`).digest('hex').slice(0, 24);
    return Buffer.from(`${payload}|${sig}`).toString('base64url');
  }

  verifyAccessToken(token: string): string {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [key, expStr, sig] = raw.split('|');
    if (!key || !expStr || !sig) throw new Error('Invalid token');
    const secret = resolveJwtAccessSecret();
    const expected = createHash('sha256')
      .update(`${key}|${expStr}|${secret}`)
      .digest('hex')
      .slice(0, 24);
    if (sig !== expected) throw new Error('Invalid token signature');
    if (Date.now() > Number(expStr)) throw new Error('Token expired');
    return key;
  }

  private objectUrl(key: string): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    if (this.forcePathStyle) {
      return `${this.endpoint}/${this.bucket}/${encodedKey}`;
    }
    const host = this.endpoint.replace(/^https?:\/\//, '');
    const proto = this.endpoint.startsWith('https') ? 'https' : 'http';
    return `${proto}://${this.bucket}.${host}/${encodedKey}`;
  }

  private signedHeaders(
    method: 'GET' | 'PUT',
    key: string,
    contentType?: string,
    body?: Buffer,
  ): Record<string, string> {
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash('sha256')
      .update(body ?? '')
      .digest('hex');
    const host = new URL(this.objectUrl(key)).host;
    const canonicalUri = new URL(this.objectUrl(key)).pathname;
    const headerLines = [
      contentType ? `content-type:${contentType}` : null,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
    ].filter(Boolean) as string[];
    const canonicalHeaders = `${headerLines.join('\n')}\n`;
    const signedHeaders = headerLines.map((l) => l.split(':')[0]).join(';');
    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signingKey = getSignatureKey(this.secretKey, dateStamp, this.region);
    const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      Host: host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorization,
    };
    if (contentType) headers['Content-Type'] = contentType;
    if (body) headers['Content-Length'] = String(body.length);
    return headers;
  }
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string): Buffer {
  const kDate = createHmac('sha256', `AWS4${secretKey}`).update(dateStamp, 'utf8').digest();
  const kRegion = createHmac('sha256', kDate).update(region, 'utf8').digest();
  const kService = createHmac('sha256', kRegion).update('s3', 'utf8').digest();
  return createHmac('sha256', kService).update('aws4_request', 'utf8').digest();
}

async function readableToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
