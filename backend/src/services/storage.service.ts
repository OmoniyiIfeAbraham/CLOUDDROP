export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export interface StorageService {
  putObject(input: PutObjectInput): Promise<void>;
  deleteObject(key: string): Promise<void>;
  getDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

/**
 * Phase 1 contract only. Phase 2 will add a local adapter for development
 * and an S3 adapter that uses private objects + presigned URLs.
 * Bytes never go in PostgreSQL — only metadata (see File.s3Key).
 */
export const STORAGE_PREFIX = "users";
