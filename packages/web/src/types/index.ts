export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type MarriageStatus = 'married' | 'divorced' | 'widowed' | 'separated';
export type MediaType = 'photo' | 'document';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  occupation?: string;
  bio?: string;
  profilePhotoId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  profilePhotoId?: string;
}

export interface SpouseRef extends PersonRef {
  relationshipId: string;
  marriageDate?: string;
  divorceDate?: string;
  marriagePlace?: string;
  status: MarriageStatus;
}

export interface MediaRecord {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: MediaType;
  caption?: string;
  date?: string;
  uploadedAt: string;
}

export interface PersonWithRelations extends Person {
  parents: PersonRef[];
  children: PersonRef[];
  spouses: SpouseRef[];
  media: MediaRecord[];
}

export interface TreePerson extends PersonRef {
  birthPlace?: string;
  occupation?: string;
  parentIds: string[];
  childIds: string[];
  spouses: {
    id: string;
    relationshipId: string;
    marriageDate?: string;
    divorceDate?: string;
    status: MarriageStatus;
  }[];
}

export interface TreeData {
  persons: TreePerson[];
}

// D3 layout types
export interface LayoutNode {
  person: TreePerson;
  x: number;
  y: number;
  generation: number;
  familyUnitId?: string;
}

export interface LayoutEdge {
  type: 'parent-child' | 'spouse';
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CreatePersonInput {
  firstName: string;
  lastName: string;
  gender?: Gender;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  occupation?: string;
  bio?: string;
}
