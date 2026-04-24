export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type MarriageStatus = 'married' | 'divorced' | 'widowed' | 'separated';
export type MediaType = 'photo' | 'document';
export type RelationshipType = 'PARENT_OF' | 'MARRIED_TO';

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

export interface PersonWithRelations extends Person {
  parents: PersonRef[];
  children: PersonRef[];
  spouses: SpouseRef[];
  media: MediaRecord[];
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
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: MediaType;
  caption?: string;
  date?: string;
  uploadedAt: string;
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

export interface UpdatePersonInput extends Partial<CreatePersonInput> {
  profilePhotoId?: string;
}

export interface AddSpouseInput {
  person1Id: string;
  person2Id: string;
  marriageDate?: string;
  divorceDate?: string;
  marriagePlace?: string;
  status?: MarriageStatus;
}

export interface UpdateSpouseInput {
  marriageDate?: string;
  divorceDate?: string;
  marriagePlace?: string;
  status?: MarriageStatus;
}

export interface TreePerson extends PersonRef {
  birthDate?: string;
  deathDate?: string;
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

// ── Face recognition ─────────────────────────────────────────────────────────

export interface BoundingBox {
  x: number;   // 0-1 fraction of image width
  y: number;   // 0-1 fraction of image height
  width: number;
  height: number;
}

export type FaceSuggestionStatus = 'pending' | 'confirmed' | 'rejected';

export interface FaceSuggestion {
  id: string;
  mediaId: string;
  compreFaceImageId: string;
  boundingBox: BoundingBox;
  suggestedPersonId: string;
  suggestedPersonName: string;
  confidence: number;
  status: FaceSuggestionStatus;
  createdAt: string;
}

// ── Document extraction ───────────────────────────────────────────────────────

export interface ExtractedPerson {
  name?: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  occupation?: string;
  bio?: string;
}

export interface ExtractionResult {
  persons: ExtractedPerson[];
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

export type ExtractionJobStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface ExtractionJob {
  id: string;
  mediaId: string;
  status: ExtractionJobStatus;
  result?: ExtractionResult;
  error?: string;
  createdAt: string;
  completedAt?: string;
}
