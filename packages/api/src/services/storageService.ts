import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import path from 'path';

const BUCKET = process.env.STORAGE_BUCKET ?? 'taproot-media';
const REGION = process.env.STORAGE_REGION ?? 'us-east-1';

function makeClient(): S3Client {
  const endpoint = process.env.STORAGE_ENDPOINT;
  return new S3Client({
    region: REGION,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? 'taproot',
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? 'taprootpass',
    },
  });
}

let client: S3Client;
function getClient(): S3Client {
  if (!client) client = makeClient();
  return client;
}

export function mediaKey(id: string, ext: string): string {
  return `media/${id}${ext}`;
}

export function thumbKey(id: string): string {
  return `thumbnails/${id}.jpg`;
}

export function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'application/pdf': '.pdf',
  };
  return map[mimeType] ?? path.extname(mimeType) ?? '.bin';
}

export async function ensureBucket(): Promise<void> {
  const s3 = getClient();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Created MinIO bucket: ${BUCKET}`);
  }
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

export async function getReadStream(key: string): Promise<Readable> {
  const resp = await getClient().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return resp.Body as Readable;
}

export async function downloadBuffer(key: string): Promise<Buffer> {
  const stream = await getReadStream(key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // Ignore missing keys on delete
  }
}
