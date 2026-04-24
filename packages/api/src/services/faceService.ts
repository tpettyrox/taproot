import FormData from 'form-data';
import fetch from 'node-fetch';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '../db/neo4j';
import * as storage from './storageService';
import { getMediaRecord } from './mediaService';
import type { BoundingBox, FaceSuggestion } from '../types';

const CF_URL = () => process.env.COMPREFACE_URL ?? 'http://localhost:8000';
const CF_KEY = () => process.env.COMPREFACE_API_KEY ?? '';
const SIMILARITY_THRESHOLD = parseFloat(process.env.FACE_SIMILARITY_THRESHOLD ?? '0.85');

// ── CompreFace API types ──────────────────────────────────────────────────────

interface CFBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

interface CFSubjectMatch {
  subject: string;
  similarity: number;
}

interface CFRecognizeResult {
  box: CFBox;
  subjects: CFSubjectMatch[];
}

interface CFAddFaceResponse {
  image_id: string;
  subject: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cfHeaders(): Record<string, string> {
  return { 'x-api-key': CF_KEY() };
}

function boxToFraction(box: CFBox, width: number, height: number): BoundingBox {
  return {
    x: box.x_min / width,
    y: box.y_min / height,
    width: (box.x_max - box.x_min) / width,
    height: (box.y_max - box.y_min) / height,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function recognizePhoto(
  imageBuffer: Buffer,
  mimeType: string
): Promise<CFRecognizeResult[]> {
  const form = new FormData();
  form.append('file', imageBuffer, { filename: 'photo.jpg', contentType: mimeType });

  const res = await fetch(
    `${CF_URL()}/api/v1/recognition/recognize?limit=5&det_prob_threshold=0.8`,
    { method: 'POST', body: form, headers: { ...form.getHeaders(), ...cfHeaders() } }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CompreFace recognize failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { result: CFRecognizeResult[] };
  return data.result ?? [];
}

export async function addFaceToSubject(
  personId: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const form = new FormData();
  form.append('file', imageBuffer, { filename: 'face.jpg', contentType: mimeType });

  const res = await fetch(
    `${CF_URL()}/api/v1/recognition/faces?subject=${encodeURIComponent(personId)}&det_prob_threshold=0.8`,
    { method: 'POST', body: form, headers: { ...form.getHeaders(), ...cfHeaders() } }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CompreFace addFace failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as CFAddFaceResponse;
  return data.image_id;
}

export async function removeFaceFromSubject(imageId: string): Promise<void> {
  await fetch(`${CF_URL()}/api/v1/recognition/faces/${encodeURIComponent(imageId)}`, {
    method: 'DELETE',
    headers: cfHeaders(),
  });
}

// ── Main processing function (runs in faceQueue) ──────────────────────────────

export async function processFaceDetection(mediaId: string): Promise<void> {
  const record = await getMediaRecord(mediaId);
  if (!record || record.type !== 'photo') return;

  const buffer = await storage.downloadBuffer(record.storageKey);

  // Get image dimensions for bounding box normalisation
  const meta = await sharp(buffer).metadata();
  const imgWidth = meta.width ?? 1;
  const imgHeight = meta.height ?? 1;

  let results: CFRecognizeResult[];
  try {
    results = await recognizePhoto(buffer, record.mimeType);
  } catch (err) {
    // CompreFace may not be running in dev — log and skip silently
    console.warn(`Face detection skipped for ${mediaId}: ${err}`);
    return;
  }

  const session = getSession();
  const now = new Date().toISOString();
  try {
    for (const result of results) {
      if (!result.subjects || result.subjects.length === 0) continue;

      const best = result.subjects.reduce((a, b) => (a.similarity > b.similarity ? a : b));
      if (best.similarity < SIMILARITY_THRESHOLD) continue;

      const suggestionId = uuidv4();
      const boundingBox = boxToFraction(result.box, imgWidth, imgHeight);

      // Fetch person name for display
      const personRes = await session.run(
        'MATCH (p:Person {id: $id}) RETURN p.firstName AS fn, p.lastName AS ln',
        { id: best.subject }
      );
      const personName =
        personRes.records.length > 0
          ? `${personRes.records[0].get('fn')} ${personRes.records[0].get('ln')}`
          : best.subject;

      await session.run(
        `CREATE (s:FaceSuggestion {
          id: $id,
          mediaId: $mediaId,
          compreFaceImageId: '',
          boundingBox: $bbox,
          suggestedPersonId: $personId,
          suggestedPersonName: $personName,
          confidence: $confidence,
          status: 'pending',
          createdAt: $now
        })`,
        {
          id: suggestionId,
          mediaId,
          bbox: JSON.stringify(boundingBox),
          personId: best.subject,
          personName,
          confidence: best.similarity,
          now,
        }
      );
    }
  } finally {
    await session.close();
  }
}

// ── Suggestion queries ────────────────────────────────────────────────────────

export async function getSuggestions(filters: {
  status?: string;
  personId?: string;
}): Promise<FaceSuggestion[]> {
  const session = getSession();
  try {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters.status) {
      conditions.push('s.status = $status');
      params.status = filters.status;
    }
    if (filters.personId) {
      conditions.push('s.suggestedPersonId = $personId');
      params.personId = filters.personId;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await session.run(
      `MATCH (s:FaceSuggestion) ${where} RETURN s ORDER BY s.createdAt DESC`,
      params
    );

    return result.records.map((r) => {
      const p = r.get('s').properties as Record<string, unknown>;
      return {
        id: p.id as string,
        mediaId: p.mediaId as string,
        compreFaceImageId: (p.compreFaceImageId as string) ?? '',
        boundingBox: JSON.parse(p.boundingBox as string) as BoundingBox,
        suggestedPersonId: p.suggestedPersonId as string,
        suggestedPersonName: p.suggestedPersonName as string,
        confidence: p.confidence as number,
        status: p.status as FaceSuggestion['status'],
        createdAt: p.createdAt as string,
      };
    });
  } finally {
    await session.close();
  }
}

export async function confirmSuggestion(
  suggestionId: string,
  personId: string
): Promise<void> {
  // Fetch the suggestion
  const session = getSession();
  try {
    const res = await session.run(
      'MATCH (s:FaceSuggestion {id: $id}) RETURN s',
      { id: suggestionId }
    );
    if (res.records.length === 0) throw new Error('Suggestion not found');
    const p = res.records[0].get('s').properties as Record<string, unknown>;
    const mediaId = p.mediaId as string;

    // Download the media and add to CompreFace subject
    const record = await getMediaRecord(mediaId);
    if (!record) throw new Error('Media not found');
    const buffer = await storage.downloadBuffer(record.storageKey);
    const imageId = await addFaceToSubject(personId, buffer, record.mimeType);

    // Store HAS_FACE relationship and update suggestion status
    await session.run(
      `MATCH (p:Person {id: $personId}), (m:Media {id: $mediaId})
       MERGE (p)-[r:HAS_FACE]->(m)
       SET r.compreFaceImageId = $imageId
       WITH 1 AS dummy
       MATCH (s:FaceSuggestion {id: $suggestionId})
       SET s.status = 'confirmed', s.compreFaceImageId = $imageId`,
      { personId, mediaId, imageId, suggestionId }
    );
  } finally {
    await session.close();
  }
}

export async function rejectSuggestion(suggestionId: string): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      "MATCH (s:FaceSuggestion {id: $id}) SET s.status = 'rejected'",
      { id: suggestionId }
    );
  } finally {
    await session.close();
  }
}
