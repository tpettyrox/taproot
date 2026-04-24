import neo4j, { Driver, Session } from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

let driver: Driver;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI ?? 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER ?? 'neo4j';
    const password = process.env.NEO4J_PASSWORD ?? 'taprootpass';
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

export function getSession(): Session {
  return getDriver().session();
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
  }
}

export async function initSchema(): Promise<void> {
  const session = getSession();
  try {
    await session.run('CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT media_id IF NOT EXISTS FOR (m:Media) REQUIRE m.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT face_suggestion_id IF NOT EXISTS FOR (s:FaceSuggestion) REQUIRE s.id IS UNIQUE');
    await session.run('CREATE CONSTRAINT extraction_job_id IF NOT EXISTS FOR (e:ExtractionJob) REQUIRE e.id IS UNIQUE');
    await session.run('CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.lastName, p.firstName)');
    await session.run('CREATE INDEX face_suggestion_media IF NOT EXISTS FOR (s:FaceSuggestion) ON (s.mediaId)');
    await session.run('CREATE INDEX face_suggestion_status IF NOT EXISTS FOR (s:FaceSuggestion) ON (s.status)');
    console.log('Neo4j schema initialized');
  } finally {
    await session.close();
  }
}

export function toNativeTypes<T extends Record<string, unknown>>(record: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (neo4j.isInt(value)) {
      result[key] = value.toNumber();
    } else if (value instanceof neo4j.types.Date) {
      result[key] = value.toString();
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
