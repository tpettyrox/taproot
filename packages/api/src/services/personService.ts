import { v4 as uuidv4 } from 'uuid';
import { getSession } from '../db/neo4j';
import {
  Person,
  PersonWithRelations,
  PersonRef,
  SpouseRef,
  CreatePersonInput,
  UpdatePersonInput,
  MediaRecord,
} from '../types';

function rowToPerson(props: Record<string, unknown>): Person {
  return {
    id: props.id as string,
    firstName: props.firstName as string,
    lastName: props.lastName as string,
    gender: (props.gender as Person['gender']) ?? 'unknown',
    birthDate: (props.birthDate as string) ?? undefined,
    birthPlace: (props.birthPlace as string) ?? undefined,
    deathDate: (props.deathDate as string) ?? undefined,
    deathPlace: (props.deathPlace as string) ?? undefined,
    occupation: (props.occupation as string) ?? undefined,
    bio: (props.bio as string) ?? undefined,
    profilePhotoId: (props.profilePhotoId as string) ?? undefined,
    createdAt: props.createdAt as string,
    updatedAt: props.updatedAt as string,
  };
}

function rowToPersonRef(props: Record<string, unknown>): PersonRef {
  return {
    id: props.id as string,
    firstName: props.firstName as string,
    lastName: props.lastName as string,
    gender: (props.gender as PersonRef['gender']) ?? 'unknown',
    birthDate: (props.birthDate as string) ?? undefined,
    deathDate: (props.deathDate as string) ?? undefined,
    profilePhotoId: (props.profilePhotoId as string) ?? undefined,
  };
}

export async function getAllPersons(): Promise<Person[]> {
  const session = getSession();
  try {
    const result = await session.run('MATCH (p:Person) RETURN p ORDER BY p.lastName, p.firstName');
    return result.records.map((r) => rowToPerson(r.get('p').properties));
  } finally {
    await session.close();
  }
}

export async function getPersonById(id: string): Promise<PersonWithRelations | null> {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (p:Person {id: $id})
       OPTIONAL MATCH (parent:Person)-[:PARENT_OF]->(p)
       OPTIONAL MATCH (p)-[:PARENT_OF]->(child:Person)
       OPTIONAL MATCH (p)-[mr:MARRIED_TO]-(spouse:Person)
       OPTIONAL MATCH (p)-[:HAS_MEDIA]->(m:Media)
       RETURN p,
         collect(DISTINCT parent) AS parents,
         collect(DISTINCT child) AS children,
         collect(DISTINCT {spouse: spouse, rel: mr}) AS spouseRels,
         collect(DISTINCT m) AS media`,
      { id }
    );

    if (result.records.length === 0) return null;

    const record = result.records[0];
    const person = rowToPerson(record.get('p').properties);

    const parents: PersonRef[] = record
      .get('parents')
      .filter((n: {properties: Record<string, unknown>} | null) => n !== null)
      .map((n: {properties: Record<string, unknown>}) => rowToPersonRef(n.properties));

    const children: PersonRef[] = record
      .get('children')
      .filter((n: {properties: Record<string, unknown>} | null) => n !== null)
      .map((n: {properties: Record<string, unknown>}) => rowToPersonRef(n.properties));

    const spouseRels: SpouseRef[] = record
      .get('spouseRels')
      .filter((s: {spouse: {properties: Record<string, unknown>} | null}) => s.spouse !== null)
      .map((s: {spouse: {properties: Record<string, unknown>}; rel: {properties: Record<string, unknown>; elementId: string}}) => ({
        ...rowToPersonRef(s.spouse.properties),
        relationshipId: s.rel.elementId,
        marriageDate: (s.rel.properties.marriageDate as string) ?? undefined,
        divorceDate: (s.rel.properties.divorceDate as string) ?? undefined,
        marriagePlace: (s.rel.properties.marriagePlace as string) ?? undefined,
        status: (s.rel.properties.status as SpouseRef['status']) ?? 'married',
      }));

    const media: MediaRecord[] = record
      .get('media')
      .filter((m: {properties: Record<string, unknown>} | null) => m !== null)
      .map((m: {properties: Record<string, unknown>}) => ({
        id: m.properties.id as string,
        filename: m.properties.filename as string,
        originalName: m.properties.originalName as string,
        mimeType: m.properties.mimeType as string,
        size: m.properties.size as number,
        type: m.properties.type as MediaRecord['type'],
        caption: (m.properties.caption as string) ?? undefined,
        date: (m.properties.date as string) ?? undefined,
        uploadedAt: m.properties.uploadedAt as string,
      }));

    return { ...person, parents, children, spouses: spouseRels, media };
  } finally {
    await session.close();
  }
}

export async function createPerson(input: CreatePersonInput): Promise<Person> {
  const session = getSession();
  const now = new Date().toISOString();
  const id = uuidv4();
  try {
    const result = await session.run(
      `CREATE (p:Person {
        id: $id,
        firstName: $firstName,
        lastName: $lastName,
        gender: $gender,
        birthDate: $birthDate,
        birthPlace: $birthPlace,
        deathDate: $deathDate,
        deathPlace: $deathPlace,
        occupation: $occupation,
        bio: $bio,
        createdAt: $now,
        updatedAt: $now
      }) RETURN p`,
      {
        id,
        firstName: input.firstName,
        lastName: input.lastName,
        gender: input.gender ?? 'unknown',
        birthDate: input.birthDate ?? null,
        birthPlace: input.birthPlace ?? null,
        deathDate: input.deathDate ?? null,
        deathPlace: input.deathPlace ?? null,
        occupation: input.occupation ?? null,
        bio: input.bio ?? null,
        now,
      }
    );
    return rowToPerson(result.records[0].get('p').properties);
  } finally {
    await session.close();
  }
}

export async function updatePerson(id: string, input: UpdatePersonInput): Promise<Person | null> {
  const session = getSession();
  const now = new Date().toISOString();
  try {
    const setClause = Object.entries(input)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => `p.${k} = $${k}`)
      .join(', ');

    if (!setClause) {
      return getPersonById(id).then((p) => (p ? { ...p } : null));
    }

    const result = await session.run(
      `MATCH (p:Person {id: $id}) SET ${setClause}, p.updatedAt = $now RETURN p`,
      { id, ...input, now }
    );

    if (result.records.length === 0) return null;
    return rowToPerson(result.records[0].get('p').properties);
  } finally {
    await session.close();
  }
}

export async function deletePerson(id: string): Promise<boolean> {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (p:Person {id: $id})
       OPTIONAL MATCH (p)-[:HAS_MEDIA]->(m:Media)
       DETACH DELETE p, m
       RETURN count(p) AS deleted`,
      { id }
    );
    const deleted = result.records[0]?.get('deleted')?.toNumber() ?? 0;
    return deleted > 0;
  } finally {
    await session.close();
  }
}
