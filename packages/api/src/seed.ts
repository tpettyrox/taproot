/**
 * Run with: npx ts-node src/seed.ts
 * Populates Neo4j with a sample three-generation family.
 */
import dotenv from 'dotenv';
dotenv.config();

import { v4 as uuidv4 } from 'uuid';
import { getSession, initSchema, closeDriver } from './db/neo4j';

interface PersonSeed {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  birthPlace?: string;
  deathDate?: string;
  occupation?: string;
  bio?: string;
}

const now = new Date().toISOString();

const persons: PersonSeed[] = [
  // Generation 1 – grandparents
  {
    id: uuidv4(),
    firstName: 'Harold',
    lastName: 'Oakwood',
    gender: 'male',
    birthDate: '1920-03-14',
    birthPlace: 'Cork, Ireland',
    deathDate: '1998-11-02',
    occupation: 'Farmer',
    bio: 'Harold emigrated from Cork to Boston in 1947 and established the family farm in Vermont.',
  },
  {
    id: uuidv4(),
    firstName: 'Margaret',
    lastName: 'Oakwood',
    gender: 'female',
    birthDate: '1923-07-08',
    birthPlace: 'Dublin, Ireland',
    deathDate: '2005-04-19',
    occupation: 'Schoolteacher',
  },
  {
    id: uuidv4(),
    firstName: 'Victor',
    lastName: 'Brennan',
    gender: 'male',
    birthDate: '1918-01-22',
    birthPlace: 'Lyon, France',
    deathDate: '1991-09-30',
    occupation: 'Physician',
  },
  {
    id: uuidv4(),
    firstName: 'Eloise',
    lastName: 'Brennan',
    gender: 'female',
    birthDate: '1921-05-17',
    birthPlace: 'Paris, France',
    deathDate: '2010-12-25',
    occupation: 'Pianist',
  },

  // Generation 2 – parents
  {
    id: uuidv4(),
    firstName: 'Thomas',
    lastName: 'Oakwood',
    gender: 'male',
    birthDate: '1950-09-01',
    birthPlace: 'Burlington, VT',
    occupation: 'Civil Engineer',
  },
  {
    id: uuidv4(),
    firstName: 'Claire',
    lastName: 'Oakwood',
    gender: 'female',
    birthDate: '1953-02-14',
    birthPlace: 'Quebec, Canada',
    occupation: 'Architect',
    bio: 'Claire met Thomas while studying at MIT and they married in 1977.',
  },
  {
    id: uuidv4(),
    firstName: 'Sophia',
    lastName: 'Oakwood',
    gender: 'female',
    birthDate: '1956-06-28',
    birthPlace: 'Burlington, VT',
    occupation: 'Journalist',
  },

  // Generation 3 – children
  {
    id: uuidv4(),
    firstName: 'Emma',
    lastName: 'Oakwood',
    gender: 'female',
    birthDate: '1979-11-03',
    birthPlace: 'Boston, MA',
    occupation: 'Software Engineer',
  },
  {
    id: uuidv4(),
    firstName: 'Liam',
    lastName: 'Oakwood',
    gender: 'male',
    birthDate: '1982-04-15',
    birthPlace: 'Boston, MA',
    occupation: 'Marine Biologist',
  },
  {
    id: uuidv4(),
    firstName: 'Nora',
    lastName: 'Oakwood',
    gender: 'female',
    birthDate: '1987-08-22',
    birthPlace: 'Cambridge, MA',
    occupation: 'Poet',
  },
];

// Named index for convenience
const [harold, margaret, victor, eloise, thomas, claire, sophia, emma, liam, nora] = persons;

async function seed() {
  await initSchema();
  const session = getSession();

  try {
    // Clear existing
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('Cleared database');

    // Create persons
    for (const p of persons) {
      await session.run(
        `CREATE (:Person {
          id: $id, firstName: $firstName, lastName: $lastName, gender: $gender,
          birthDate: $birthDate, birthPlace: $birthPlace, deathDate: $deathDate,
          occupation: $occupation, bio: $bio, createdAt: $now, updatedAt: $now
        })`,
        {
          ...p,
          birthPlace: p.birthPlace ?? null,
          deathDate: p.deathDate ?? null,
          occupation: p.occupation ?? null,
          bio: p.bio ?? null,
          now,
        }
      );
    }
    console.log(`Created ${persons.length} persons`);

    // Marriages (generation 1)
    await session.run(
      `MATCH (a:Person {id: $a}), (b:Person {id: $b})
       MERGE (a)-[:MARRIED_TO {marriageDate: '1945-06-10', status: 'married'}]-(b)`,
      { a: harold.id, b: margaret.id }
    );
    await session.run(
      `MATCH (a:Person {id: $a}), (b:Person {id: $b})
       MERGE (a)-[:MARRIED_TO {marriageDate: '1947-09-22', status: 'married'}]-(b)`,
      { a: victor.id, b: eloise.id }
    );

    // Marriage generation 2
    await session.run(
      `MATCH (a:Person {id: $a}), (b:Person {id: $b})
       MERGE (a)-[:MARRIED_TO {marriageDate: '1977-05-30', status: 'married'}]-(b)`,
      { a: thomas.id, b: claire.id }
    );

    console.log('Created marriages');

    // Parent-child (gen 1 → gen 2)
    const gen1to2 = [
      [harold.id, thomas.id],
      [margaret.id, thomas.id],
      [harold.id, sophia.id],
      [margaret.id, sophia.id],
      [victor.id, claire.id],
      [eloise.id, claire.id],
    ];
    for (const [p, c] of gen1to2) {
      await session.run(
        `MATCH (p:Person {id: $p}), (c:Person {id: $c}) MERGE (p)-[:PARENT_OF]->(c)`,
        { p, c }
      );
    }

    // Parent-child (gen 2 → gen 3)
    const gen2to3 = [
      [thomas.id, emma.id],
      [claire.id, emma.id],
      [thomas.id, liam.id],
      [claire.id, liam.id],
      [thomas.id, nora.id],
      [claire.id, nora.id],
    ];
    for (const [p, c] of gen2to3) {
      await session.run(
        `MATCH (p:Person {id: $p}), (c:Person {id: $c}) MERGE (p)-[:PARENT_OF]->(c)`,
        { p, c }
      );
    }

    console.log('Created parent-child relationships');
    console.log('\nSeed complete! Family tree loaded with 3 generations of the Oakwood family.');
  } finally {
    await session.close();
    await closeDriver();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
