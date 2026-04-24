import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '../db/neo4j';
import { MediaRecord, MediaType } from '../types';

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? './uploads';
const THUMB_DIR = path.join(UPLOADS_DIR, 'thumbnails');

function ensureDirs(): void {
  [UPLOADS_DIR, THUMB_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

export function getFilePath(filename: string): string {
  return path.resolve(UPLOADS_DIR, filename);
}

export function getThumbnailPath(filename: string): string {
  return path.resolve(THUMB_DIR, filename);
}

export async function saveMedia(
  personId: string,
  file: Express.Multer.File,
  type: MediaType,
  caption?: string,
  date?: string
): Promise<MediaRecord> {
  ensureDirs();
  const id = uuidv4();
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${id}${ext}`;
  const destPath = path.join(UPLOADS_DIR, filename);

  fs.renameSync(file.path, destPath);

  if (type === 'photo' && /\.(jpe?g|png|webp|gif|tiff?)$/i.test(ext)) {
    await sharp(destPath)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(path.join(THUMB_DIR, `${id}.jpg`));
  }

  const session = getSession();
  const now = new Date().toISOString();
  try {
    await session.run(
      `MATCH (p:Person {id: $personId})
       CREATE (m:Media {
         id: $id,
         filename: $filename,
         originalName: $originalName,
         mimeType: $mimeType,
         size: $size,
         type: $type,
         caption: $caption,
         date: $date,
         uploadedAt: $now
       })
       CREATE (p)-[:HAS_MEDIA]->(m)
       RETURN m`,
      {
        personId,
        id,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        type,
        caption: caption ?? null,
        date: date ?? null,
        now,
      }
    );

    return {
      id,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      type,
      caption,
      date,
      uploadedAt: now,
    };
  } finally {
    await session.close();
  }
}

export async function getMediaRecord(id: string): Promise<MediaRecord | null> {
  const session = getSession();
  try {
    const result = await session.run('MATCH (m:Media {id: $id}) RETURN m', { id });
    if (result.records.length === 0) return null;
    const p = result.records[0].get('m').properties as Record<string, unknown>;
    return {
      id: p.id as string,
      filename: p.filename as string,
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
  const session = getSession();
  try {
    const result = await session.run(
      'MATCH (m:Media {id: $id}) RETURN m.filename AS filename',
      { id }
    );
    if (result.records.length === 0) return false;

    const filename = result.records[0].get('filename') as string;
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);

    const filesToRemove = [
      path.join(UPLOADS_DIR, filename),
      path.join(THUMB_DIR, `${base}.jpg`),
    ];
    filesToRemove.forEach((f) => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    await session.run('MATCH (m:Media {id: $id}) DETACH DELETE m', { id });
    return true;
  } finally {
    await session.close();
  }
}

export async function updateMediaCaption(id: string, caption: string): Promise<void> {
  const session = getSession();
  try {
    await session.run('MATCH (m:Media {id: $id}) SET m.caption = $caption', { id, caption });
  } finally {
    await session.close();
  }
}
