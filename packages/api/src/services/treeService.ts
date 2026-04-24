import { getSession } from '../db/neo4j';
import { TreeData, TreePerson } from '../types';

export async function getFullTree(): Promise<TreeData> {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (p:Person)
      OPTIONAL MATCH (parent:Person)-[:PARENT_OF]->(p)
      OPTIONAL MATCH (p)-[:PARENT_OF]->(child:Person)
      OPTIONAL MATCH (p)-[mr:MARRIED_TO]-(spouse:Person)
      RETURN p,
        collect(DISTINCT parent.id) AS parentIds,
        collect(DISTINCT child.id) AS childIds,
        collect(DISTINCT {
          id: spouse.id,
          relId: elementId(mr),
          marriageDate: mr.marriageDate,
          divorceDate: mr.divorceDate,
          status: mr.status
        }) AS spouseRels
    `);

    const persons: TreePerson[] = result.records
      .filter((r) => r.get('p') !== null)
      .map((r) => {
        const p = r.get('p').properties as Record<string, unknown>;
        const spouseRels = (
          r.get('spouseRels') as Array<Record<string, unknown>>
        ).filter((s) => s.id !== null);

        return {
          id: p.id as string,
          firstName: p.firstName as string,
          lastName: p.lastName as string,
          gender: (p.gender as TreePerson['gender']) ?? 'unknown',
          birthDate: (p.birthDate as string) ?? undefined,
          deathDate: (p.deathDate as string) ?? undefined,
          birthPlace: (p.birthPlace as string) ?? undefined,
          occupation: (p.occupation as string) ?? undefined,
          profilePhotoId: (p.profilePhotoId as string) ?? undefined,
          parentIds: (r.get('parentIds') as string[]).filter(Boolean),
          childIds: (r.get('childIds') as string[]).filter(Boolean),
          spouses: spouseRels.map((s) => ({
            id: s.id as string,
            relationshipId: s.relId as string,
            marriageDate: (s.marriageDate as string) ?? undefined,
            divorceDate: (s.divorceDate as string) ?? undefined,
            status: (s.status as TreePerson['spouses'][0]['status']) ?? 'married',
          })),
        };
      });

    return { persons };
  } finally {
    await session.close();
  }
}
