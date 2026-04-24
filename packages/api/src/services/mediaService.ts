import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '../db/neo4j';
import * as storage from './storageService';
import { MediaRecord, MediaType } from '../types';

export async function saveMedia(
  personId: string,
  file: Express.Multer.File,
  type: MediaType,
  caption?: string,
  date?: string
): Promise<MediaRecord> {
  const id = uuidv4();
  const ext = storage.extFromMime(file.mimetype) ||
    (file.originalname.includes('.') ? `.${file.originalname.split('.').pop()}` : '.bin');
  const key = storage.mediaKey(id, ext);

  await storage.uploadFile(key, file.buffer, file.mimetype);

  if (type === 'photo' && /image\/(jpe?g|png|webp|gif)/i.test(file.mimetype)) {
    const thumb = await sharp(file.buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    await storage.uploadFile(storage.thumbKey(id), thumb, 'image/jpeg');
  }

  const session = getSession();
  const now = new Date().toISOString();
  try {
    await session.run(
      `MATCH (p:Person {id: $personId})
       CREATE (m:Media {
         id: $id,
         storageKey: $key,
         originalName: $originalName,
         mimeType: $mimeType,
         size: $size,
         type: $type,
         caption: $caption,
         date: $date,
         uploadedAt: $now
       })
       CREATE (p)-[:HAS_MEDIA]->(m)`,
      {
        personId, id, key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type,
        caption: caption ?? null,
        date: date ?? null,
        now,
      }
    );
  } finally {
    await session.close();
  }

  return {
    id,
    storageKey: key,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    type,
    caption,
    date,
    uploadedAt: now,
  };
}

export async function getMediaRecord(id: string): Promise<MediaRecord | null> {
  const session = getSession();
  try {
    const result = await session.run('MATCH (m:Media {id: $id}) RETURN m', { id });
    if (result.records.length === 0) return null;
    const p = result.records[0].get('m').properties as Record<string, unknown>;
    return {
      id: p.id as string,
      storageKey: p.storageKey as string,
      originalName: p.originalName as string,
      mimeType: p.mimeType as string,
      size: p.size as number,
      type: p.type as MediaType,
      caption: (p.caption as string) ?? undefined,
      date: (p.date as string) ?? undefined,
      uploadedAt: p.uploadedAt as string,
    };
  } finally {
    await session.close();
  }
}

export async function deleteMedia(id: string): Promise<boolean> {
  const record = await getMediaRecord(id);
  if (!record) return false;

  await storage.deleteFile(record.storageKey);

  const ext = record.storageKey.split('.').pop() ?? '';
  const base = id;
  // Delete thumbnail if it exists (only for photos)
  if (record.type === 'photo') {
    await storage.deleteFile(storage.thumbKey(base));
  }

  const session = getSession();
  try {
    await session.run('MATCH (m:Media {id: $id}) DETACH DELETE m', { id });
  } finally {
    await session.close();
  }
  return true;
}

export async function updateMediaCaption(id: string, caption: string): Promise<void> {
  const session = getSession();
  try {
    await session.run('MATCH (m:Media {id: $id}) SET m.caption = $caption', { id, caption });
  } finally {
    await session.close();
  }
}
