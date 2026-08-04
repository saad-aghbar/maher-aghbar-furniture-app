import type { Readable } from 'stream';

export interface StoredObject {
  key: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ObjectStorage {
  putObject(fileName: string, mimeType: string, data: Buffer | Readable): Promise<StoredObject>;
  getObjectStream(key: string): Promise<Readable>;
  createAccessToken(key: string, ttlSeconds?: number): string;
  verifyAccessToken(token: string): string;
}
