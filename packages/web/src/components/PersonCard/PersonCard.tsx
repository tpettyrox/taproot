import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPerson, updatePerson, deletePerson, thumbnailUrl } from '../../api/client';
import type { CreatePersonInput } from '../../types';
import Modal from '../ui/Modal';
import PersonForm from './PersonForm';
import RelationshipsTab from './RelationshipsTab';
import MediaTab from './MediaTab';

type Tab = 'overview' | 'relationships' | 'media';

interface PersonCardProps {
  personId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onDeleted: () => void;
}

const GENDER_BADGE: Record<string, string> = {
  male: 'bg-blue-100 text-blue-700',
  female: 'bg-pink-100 text-pink-700',
  other: 'bg-purple-100 text-purple-700',
  unknown: 'bg-gray-100 text-gray-600',
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="text-xs font-medium text-gray-400 w-24 shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  );
}

export default function PersonCard({ personId, onClose, onNavigate, onDeleted }: PersonCardProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  const { data: person, isLoading } = useQuery({
    queryKey: ['person', personId],
    queryFn: () => getPerson(personId!),
    enabled: !!personId,
  });

  const updateMut = useMutation({
    mutationFn: (data: CreatePersonInput) => updatePerson(personId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person', personId] });
      qc.invalidateQueries({ queryKey: ['tree'] });
      setEditing(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deletePerson(personId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tree'] });
      qc.invalidateQueries({ queryKey: ['persons'] });
      onDeleted();
      onClose();
    },
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'relationships', label: 'Family' },
    { id: 'media', label: 'Photos & Docs' },
  ];

  return (
    <Modal open={!!personId} onClose={onClose} wide>
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-bark-200 border-t-bark-600 rounded-full animate-spin" />
        </div>
      )}

      {person && !isLoading && (
        <>
          {/* Header */}
          <div className="relative bg-gradient-to-br from-bark-50 to-stone-100 px-6 pt-6 pb-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 rounded-lg p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex gap-4 pb-4">
              {/* Profile photo */}
              <div className="shrink-0">
                {person.profilePhotoId ? (
                  <img
                    src={thumbnailUrl(person.profilePhotoId)}
                    alt={`${person.firstName} ${person.lastName}`}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-white/60 border-2 border-white shadow-md
                    flex items-center justify-center text-3xl text-gray-300">
                    {person.gender === 'male' ? '♂' : person.gender === 'female' ? '♀' : '⊕'}
                  </div>
                )}
              </div>

              {/* Name and quick info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900 font-serif">
                    {person.firstName} {person.lastName}
                  </h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      GENDER_BADGE[person.gender] ?? GENDER_BADGE.unknown
                    }`}
                  >
                    {person.gender}
                  </span>
                  {person.deathDate && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                      Deceased
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {person.birthDate
                    ? `${person.birthDate.slice(0, 4)}${
                        person.deathDate ? ` – ${person.deathDate.slice(0, 4)}` : ''
                      }`
                    : ''}
                  {person.birthPlace ? ` · ${person.birthPlace}` : ''}
                </p>
                {person.occupation && (
                  <p className="text-sm text-bark-700 font-medium mt-0.5">{person.occupation}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs border border-bark-300 text-bark-700 rounded-lg px-3 py-1
                      hover:bg-bark-50 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${person.firstName} ${person.lastName}?`))
                        deleteMut.mutate();
                    }}
                    className="text-xs border border-red-200 text-red-500 rounded-lg px-3 py-1
                      hover:bg-red-50 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 -mb-px">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition
                    ${tab === t.id
                      ? 'border-bark-600 text-bark-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {t.label}
                  {t.id === 'relationships' && (
                    <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5">
                      {person.parents.length + person.children.length + person.spouses.length}
                    </span>
                  )}
                  {t.id === 'media' && person.media.length > 0 && (
                    <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5">
                      {person.media.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          {tab === 'overview' && (
            <div className="p-6">
              <dl className="space-y-3">
                <InfoRow label="Birth date" value={person.birthDate} />
                <InfoRow label="Birth place" value={person.birthPlace} />
                <InfoRow label="Death date" value={person.deathDate} />
                <InfoRow label="Death place" value={person.deathPlace} />
                <InfoRow label="Occupation" value={person.occupation} />
              </dl>

              {person.bio && (
                <div className="mt-5">
                  <h3 className="text-xs font-medium text-gray-400 mb-2">Biography</h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {person.bio}
                  </p>
                </div>
              )}

              {!person.bio && !person.birthDate && !person.occupation && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">No details recorded yet.</p>
                  <button
                    onClick={() => setEditing(true)}
                    className="mt-2 text-sm text-bark-600 hover:text-bark-800 font-medium"
                  >
                    Add information →
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'relationships' && (
            <RelationshipsTab
              person={person}
              onNavigate={(id) => {
                onNavigate(id);
                setTab('overview');
              }}
            />
          )}

          {tab === 'media' && <MediaTab person={person} />}
        </>
      )}

      {/* Edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Person">
        {person && (
          <PersonForm
            initial={person}
            onSubmit={(data) => updateMut.mutate(data)}
            onCancel={() => setEditing(false)}
            isLoading={updateMut.isPending}
          />
        )}
      </Modal>
    </Modal>
  );
}
