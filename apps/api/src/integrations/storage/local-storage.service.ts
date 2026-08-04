import { Injectable } from '@nestjs/common';
import type { Readable } from 'stream';
import { LocalDiskStorage } from './local-disk.storage';
import { S3StorageService } from './s3-storage.service';
import type { ObjectStorage, StoredObject } from './storage.types';

/**
 * Facade used app-wide. Switches to MinIO/S3 when S3_* env is configured
 * (and STORAGE_PROVIDER is not forced to `local`).
 */
@Injectable()
export class LocalStorageService implements ObjectStorage {
  private readonly backend: ObjectStorage;

  constructor() {
    this.backend = S3StorageService.isConfigured()
      ? new S3StorageService()
      : new LocalDiskStorage();
  }

  putObject(fileName: string, mimeType: string, data: Buffer | Readable): Promise<StoredObject> {
    return this.backend.putObject(fileName, mimeType, data);
  }

  getObjectStream(key: string) {
    return this.backend.getObjectStream(key);
  }

  createAccessToken(key: string, ttlSeconds = 900): string {
    return this.backend.createAccessToken(key, ttlSeconds);
  }

  verifyAccessToken(token: string): string {
    return this.backend.verifyAccessToken(token);
  }

  get providerName(): string {
    return this.backend instanceof S3StorageService ? 's3' : 'local';
  }
}
