import axios from 'axios';
import type {
  Person,
  PersonWithRelations,
  TreeData,
  CreatePersonInput,
  MediaRecord,
  FaceSuggestion,
  ExtractionJob,
} from '../types';

const api = axios.create({ baseURL: '/api' });

// Persons
export const getPersons = () => api.get<Person[]>('/persons').then((r) => r.data);
export const getPerson = (id: string) =>
  api.get<PersonWithRelations>(`/persons/${id}`).then((r) => r.data);
export const createPerson = (data: CreatePersonInput) =>
  api.post<Person>('/persons', data).then((r) => r.data);
export const updatePerson = (id: string, data: Partial<CreatePersonInput & { profilePhotoId: string }>) =>
  api.put<Person>(`/persons/${id}`, data).then((r) => r.data);
export const deletePerson = (id: string) => api.delete(`/persons/${id}`);

// Tree
export const getTree = () => api.get<TreeData>('/tree').then((r) => r.data);

// Relationships
export const addParentChild = (parentId: string, childId: string) =>
  api.post('/relationships/parent', { parentId, childId });
export const removeParentChild = (parentId: string, childId: string) =>
  api.delete('/relationships/parent', { data: { parentId, childId } });
export const addSpouse = (data: {
  person1Id: string;
  person2Id: string;
  marriageDate?: string;
  divorceDate?: string;
  marriagePlace?: string;
  status?: string;
}) => api.post('/relationships/spouse', data);
export const updateSpouse = (data: {
  person1Id: string;
  person2Id: string;
  marriageDate?: string;
  divorceDate?: string;
  marriagePlace?: string;
  status?: string;
}) => api.put('/relationships/spouse', data);
export const removeSpouse = (person1Id: string, person2Id: string) =>
  api.delete('/relationships/spouse', { data: { person1Id, person2Id } });

// Media
export const uploadMedia = (
  personId: string,
  file: File,
  type: 'photo' | 'document',
  caption?: string,
  date?: string
) => {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  if (caption) form.append('caption', caption);
  if (date) form.append('date', date);
  return api.post<MediaRecord>(`/media/upload/${personId}`, form).then((r) => r.data);
};
export const deleteMedia = (id: string) => api.delete(`/media/${id}`);
export const updateCaption = (id: string, caption: string) =>
  api.patch(`/media/${id}/caption`, { caption });

export const mediaUrl = (id: string) => `/api/media/${id}`;
export const thumbnailUrl = (id: string) => `/api/media/${id}/thumbnail`;

// Face recognition
export const getFaceSuggestions = (personId: string, status = 'pending') =>
  api
    .get<FaceSuggestion[]>('/faces/suggestions', { params: { personId, status } })
    .then((r) => r.data);

export const confirmFace = (suggestionId: string, personId: string) =>
  api.post(`/faces/${suggestionId}/confirm`, { personId });

export const rejectFace = (suggestionId: string) =>
  api.post(`/faces/${suggestionId}/reject`);

// Document extraction
export const triggerExtraction = (mediaId: string) =>
  api.post<{ jobId: string; status: string }>(`/extraction/${mediaId}`).then((r) => r.data);

export const pollExtractionJob = (jobId: string) =>
  api.get<ExtractionJob>(`/extraction/${jobId}`).then((r) => r.data);
