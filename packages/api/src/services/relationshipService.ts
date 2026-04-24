import { getSession } from '../db/neo4j';
import { AddSpouseInput, UpdateSpouseInput } from '../types';

export async function addParentChild(parentId: string, childId: string): Promise<void> {
  if (parentId === childId) throw new Error('A person cannot be their own parent');
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (parent:Person {id: $parentId}), (child:Person {id: $childId})
       MERGE (parent)-[:PARENT_OF]->(child)
       RETURN parent, child`,
      { parentId, childId }
    );
    if (result.records.length === 0) throw new Error('One or both persons not found');
  } finally {
    await session.close();
  }
}

export async function removeParentChild(parentId: string, childId: string): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      `MATCH (parent:Person {id: $parentId})-[r:PARENT_OF]->(child:Person {id: $childId})
       DELETE r`,
      { parentId, childId }
    );
  } finally {
    await session.close();
  }
}

export async function addSpouse(input: AddSpouseInput): Promise<{ relationshipId: string }> {
  if (input.person1Id === input.person2Id) throw new Error('A person cannot marry themselves');
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (p1:Person {id: $person1Id}), (p2:Person {id: $person2Id})
       MERGE (p1)-[r:MARRIED_TO]-(p2)
       SET r.marriageDate = $marriageDate,
           r.divorceDate = $divorceDate,
           r.marriagePlace = $marriagePlace,
           r.status = $status
       RETURN elementId(r) AS relId`,
      {
        person1Id: input.person1Id,
        person2Id: input.person2Id,
        marriageDate: input.marriageDate ?? null,
        divorceDate: input.divorceDate ?? null,
        marriagePlace: input.marriagePlace ?? null,
        status: input.status ?? 'married',
      }
    );
    if (result.records.length === 0) throw new Error('One or both persons not found');
    return { relationshipId: result.records[0].get('relId') as string };
  } finally {
    await session.close();
  }
}

export async function updateSpouse(
  person1Id: string,
  person2Id: string,
  input: UpdateSpouseInput
): Promise<void> {
  const session = getSession();
  try {
    const setParts: string[] = [];
    if (input.marriageDate !== undefined) setParts.push('r.marriageDate = $marriageDate');
    if (input.divorceDate !== undefined) setParts.push('r.divorceDate = $divorceDate');
    if (input.marriagePlace !== undefined) setParts.push('r.marriagePlace = $marriagePlace');
    if (input.status !== undefined) setParts.push('r.status = $status');

    if (setParts.length === 0) return;

    await session.run(
      `MATCH (p1:Person {id: $person1Id})-[r:MARRIED_TO]-(p2:Person {id: $person2Id})
       SET ${setParts.join(', ')}`,
      { person1Id, person2Id, ...input }
    );
  } finally {
    await session.close();
  }
}

export async function removeSpouse(person1Id: string, person2Id: string): Promise<void> {
  const session = getSession();
  try {
    await session.run(
      `MATCH (p1:Person {id: $person1Id})-[r:MARRIED_TO]-(p2:Person {id: $person2Id})
       DELETE r`,
      { person1Id, person2Id }
    );
  } finally {
    await session.close();
  }
}
