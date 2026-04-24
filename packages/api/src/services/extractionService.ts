import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '../db/neo4j';
import * as storage from './storageService';
import { getMediaRecord } from './mediaService';
import type { ExtractionResult, ExtractionJob, ExtractionJobStatus } from '../types';

const MODEL = 'claude-sonnet-4-6';

const EXTRACTION_PROMPT = `You are a genealogy research assistant. Analyze this document and extract biographical information about any persons mentioned.

Return ONLY valid JSON matching this exact schema, with no other text before or after:

{
  "persons": [
    {
      "name": "Full name as written in the document",
      "birthDate": "YYYY-MM-DD or partial like '1892' or '1892-06' — omit field if unknown",
      "birthPlace": "City, Country — omit field if unknown",
      "deathDate": "YYYY-MM-DD or partial — omit field if unknown",
      "deathPlace": "City, Country — omit field if unknown",
      "occupation": "Primary occupation — omit field if unknown",
      "bio": "1-3 sentence biographical summary from the document — omit field if nothing notable"
    }
  ],
  "confidence": "high | medium | low",
  "notes": "Any ambiguities, multiple interpretations, or data quality concerns — omit if none"
}

Rules:
- Include one entry per distinct person with substantive biographical data.
- Normalize dates to ISO format where possible; a year alone is fine.
- confidence = high if dates/places are explicit; medium if inferred; low if very uncertain.
- If no biographical data can be extracted, return {"persons":[],"confidence":"low","notes":"reason"}.`;

function makeClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ── Neo4j CRUD ────────────────────────────────────────────────────────────────

async function createJob(mediaId: string): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const session = getSession();
  try {
    await session.run(
      `MATCH (m:Media {id: $mediaId})
       CREATE (j:ExtractionJob { id: $id, mediaId: $mediaId, status: 'pending', createdAt: $now })
       CREATE (m)-[:HAS_EXTRACTION]->(j)`,
      { id, mediaId, now }
    );
  } finally {
    await session.close();
  }
  return id;
}

async function setJobStatus(
  jobId: string,
  status: ExtractionJobStatus,
  result?: ExtractionResult,
  error?: string
): Promise<void> {
  const session = getSession();
  const now = new Date().toISOString();
  try {
    await session.run(
      `MATCH (j:ExtractionJob {id: $id})
       SET j.status = $status,
           j.result = $result,
           j.error = $error,
           j.completedAt = $now`,
      {
        id: jobId,
        status,
        result: result ? JSON.stringify(result) : null,
        error: error ?? null,
        now,
      }
    );
  } finally {
    await session.close();
  }
}

export async function getJob(jobId: string): Promise<ExtractionJob | null> {
  const session = getSession();
  try {
    const res = await session.run(
      'MATCH (j:ExtractionJob {id: $id}) RETURN j',
      { id: jobId }
    );
    if (res.records.length === 0) return null;
    const p = res.records[0].get('j').properties as Record<string, unknown>;
    return {
      id: p.id as string,
      mediaId: p.mediaId as string,
      status: p.status as ExtractionJobStatus,
      result: p.result ? (JSON.parse(p.result as string) as ExtractionResult) : undefined,
      error: (p.error as string) ?? undefined,
      createdAt: p.createdAt as string,
      completedAt: (p.completedAt as string) ?? undefined,
    };
  } finally {
    await session.close();
  }
}

// ── Extraction logic ──────────────────────────────────────────────────────────

function parseResult(text: string): ExtractionResult {
  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  try {
    return JSON.parse(cleaned) as ExtractionResult;
  } catch {
    return { persons: [], confidence: 'low', notes: `Parse error: ${text.slice(0, 200)}` };
  }
}

async function runExtraction(jobId: string, mediaId: string): Promise<void> {
  await setJobStatus(jobId, 'processing');

  try {
    const record = await getMediaRecord(mediaId);
    if (!record) throw new Error('Media record not found');

    const buffer = await storage.downloadBuffer(record.storageKey);
    const base64 = buffer.toString('base64');

    const isPdf = record.mimeType === 'application/pdf';
    const isImage = record.mimeType.startsWith('image/');

    if (!isPdf && !isImage) {
      throw new Error(`Unsupported media type for extraction: ${record.mimeType}`);
    }

    type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const contentBlock: Anthropic.MessageParam['content'][number] = isPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: record.mimeType as ImageMediaType,
            data: base64,
          },
        };

    const client = makeClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: EXTRACTION_PROMPT }],
        },
      ],
    });

    const responseText =
      message.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
    const result = parseResult(responseText);

    await setJobStatus(jobId, 'done', result);
  } catch (err) {
    await setJobStatus(jobId, 'failed', undefined, String(err));
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function createAndRunExtractionJob(mediaId: string): Promise<string> {
  const jobId = await createJob(mediaId);
  // Fire and forget — caller gets jobId to poll
  setImmediate(() => runExtraction(jobId, mediaId));
  return jobId;
}
