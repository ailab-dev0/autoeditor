/**
 * Object storage service — MinIO/S3 compatible.
 *
 * Stores video files, generated images, and exports.
 * Uses @aws-sdk/client-s3 which works with both MinIO and AWS S3.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';
import { Readable } from 'stream';

const BUCKET = process.env.MINIO_BUCKET || 'editorlens';

let client: S3Client | null = null;

export function getStorageClient(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: config.minioEndpoint,
      region: config.minioRegion || 'us-east-1',
      credentials: {
        accessKeyId: config.minioAccessKey,
        secretAccessKey: config.minioSecretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return client;
}

export function isStorageConfigured(): boolean {
  return !!(config.minioEndpoint && config.minioAccessKey && config.minioSecretKey);
}

/**
 * Upload a file buffer to storage.
 * Returns the object key.
 */
export async function uploadFile(
  key: string,
  body: Buffer | Readable,
  contentType: string,
): Promise<string> {
  const s3 = getStorageClient();

  // For streams (potentially large files), use multipart upload
  if (body instanceof Readable) {
    const partSize = 64 * 1024 * 1024; // 64 MB parts
    const { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } = await import('@aws-sdk/client-s3');

    const { UploadId } = await s3.send(new CreateMultipartUploadCommand({
      Bucket: BUCKET, Key: key, ContentType: contentType,
    }));

    const parts: Array<{ ETag: string; PartNumber: number }> = [];
    let partNumber = 1;
    let buffer = Buffer.alloc(0);

    try {
      for await (const chunk of body) {
        buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
        while (buffer.length >= partSize) {
          const part = buffer.subarray(0, partSize);
          buffer = buffer.subarray(partSize);
          const { ETag } = await s3.send(new UploadPartCommand({
            Bucket: BUCKET, Key: key, UploadId, PartNumber: partNumber, Body: part,
          }));
          parts.push({ ETag: ETag!, PartNumber: partNumber });
          partNumber++;
        }
      }
      // Upload remaining bytes
      if (buffer.length > 0 || parts.length === 0) {
        const { ETag } = await s3.send(new UploadPartCommand({
          Bucket: BUCKET, Key: key, UploadId, PartNumber: partNumber, Body: buffer,
        }));
        parts.push({ ETag: ETag!, PartNumber: partNumber });
      }

      await s3.send(new CompleteMultipartUploadCommand({
        Bucket: BUCKET, Key: key, UploadId, MultipartUpload: { Parts: parts },
      }));
    } catch (err) {
      // Abort multipart on failure to avoid orphaned parts
      await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId })).catch(() => {});
      throw err;
    }
  } else {
    // Buffer — direct put (small files like JSON, JSONL, checkpoints)
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: key, Body: body, ContentType: contentType,
    }));
  }

  return key;
}

/**
 * Upload a video file for a project.
 * key format: projects/{projectId}/videos/{filename}
 */
export async function uploadVideo(
  projectId: string,
  filename: string,
  body: Buffer | Readable,
  contentType: string = 'video/mp4',
): Promise<{ key: string; url: string }> {
  const key = `projects/${projectId}/videos/${filename}`;
  await uploadFile(key, body, contentType);
  const url = await getPresignedUrl(key, 86400); // 24h URL
  return { key, url };
}

/**
 * Get a presigned download URL (default 1 hour).
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const s3 = getStorageClient();
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn });
}

/**
 * Get file as a readable stream.
 */
export async function getFileStream(key: string): Promise<Readable> {
  const s3 = getStorageClient();
  const response = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  return response.Body as Readable;
}

/**
 * Check if a file exists.
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const s3 = getStorageClient();
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a file.
 */
export async function deleteFile(key: string): Promise<void> {
  const s3 = getStorageClient();
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * List files in a prefix (folder).
 */
export async function listFiles(prefix: string): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const s3 = getStorageClient();
  const response = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
  }));
  return (response.Contents || []).map((obj) => ({
    key: obj.Key!,
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
  }));
}

/**
 * List all videos for a project.
 */
export async function listProjectVideos(projectId: string): Promise<{ key: string; filename: string; size: number; url: string }[]> {
  const files = await listFiles(`projects/${projectId}/videos/`);
  const results = [];
  for (const f of files) {
    const filename = f.key.split('/').pop() || f.key;
    const url = await getPresignedUrl(f.key, 3600);
    results.push({ key: f.key, filename, size: f.size, url });
  }
  return results;
}
