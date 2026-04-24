import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPersons, addParentChild, removeParentChild, addSpouse, updateSpouse, removeSpouse } from '../../api/client';
import type { PersonWithRelations, PersonRef, SpouseRef, MarriageStatus } from '../../types';

interface Props {
  person: PersonWithRelations;
  onNavigate: (id: string) => void;
}

const inputCls =
  'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-bark-400 transition';

function PersonBadge({
  person,
  onNavigate,
  onRemove,
}: {
  person: PersonRef;
  onNavigate: (id: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group">
      <button
        onClick={() => onNavigate(person.id)}
        className="text-sm font-medium text-bark-700 hover:text-bark-900 hover:underline flex-1 text-left"
      >
        {person.firstName} {person.lastName}
        {person.birthDate && (
          <span className="text-gray-400 font-normal ml-1">({person.birthDate.slice(0, 4)})</span>
        )}
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition text-xs"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function SpouseBadge({
  spouse,
  personId,
  onNavigate,
  onRemove,
}: {
  spouse: SpouseRef;
  personId: string;
  onNavigate: (id: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    marriageDate: spouse.marriageDate ?? '',
    divorceDate: spouse.divorceDate ?? '',
    marriagePlace: spouse.marriagePlace ?? '',
    status: (spouse.status ?? 'married') as MarriageStatus,
  });
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      updateSpouse({ person1Id: personId, person2Id: spouse.id, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person', personId] });
      setEditing(false);
    },
  });

  return (
    <div className="bg-pink-50 rounded-lg px-3 py-2 group">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate(spouse.id)}
          className="text-sm font-medium text-bark-700 hover:underline flex-1 text-left"
        >
          {spouse.firstName} {spouse.lastName}
        </button>
        <button
          onClick={() => setEditing(!editing)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition text-xs"
        >
          ✕
        </button>
      </div>
      <div className="text-xs text-gray-500 mt-0.5">
        {spouse.marriageDate && `Married: ${spouse.marriageDate}`}
        {spouse.divorceDate && ` · Divorced: ${spouse.divorceDate}`}
        {spouse.status !== 'married' && ` · ${spouse.status}`}
      </div>
      {editing && (
        <div className="mt-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.marriageDate}
              onChange={(e) => setForm({ ...form, marriageDate: e.target.value })}
              className={inputCls}
              placeholder="Marriage date"
            />
            <input
              type="date"
              value={form.divorceDate}
              onChange={(e) => setForm({ ...form, divorceDate: e.target.value })}
              className={inputCls}
              placeholder="Divorce date"
            />
          </div>
          <input
            value={form.marriagePlace}
            onChange={(e) => setForm({ ...form, marriagePlace: e.target.value })}
            className={`${inputCls} w-full`}
            placeholder="Marriage place"
          />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as MarriageStatus })}
            className={`${inputCls} w-full`}
          >
            {(['married', 'divorced', 'widowed', 'separated'] as MarriageStatus[]).map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="w-full bg-bark-600 text-white rounded py-1 text-xs hover:bg-bark-700 transition"
          >
            {mut.isPending ? 'Saving…' : 'Save dates'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function RelationshipsTab({ person, onNavigate }: Props) {
  const [addingParent, setAddingParent] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [addingSpouse, setAddingSpouse] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const qc = useQueryClient();
  const { data: allPersons = [] } = useQuery({ queryKey: ['persons'], queryFn: getPersons });

  const filtered = allPersons.filter(
    (p) =>
      p.id !== person.id &&
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addParentMut = useMutation({
    mutationFn: (parentId: string) => addParentChild(parentId, person.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person', person.id] });
      qc.invalidateQueries({ queryKey: ['tree'] });
      setAddingParent(false);
      setSearchQuery('');
    },
  });

  const addChildMut = useMutation({
    mutationFn: (childId: string) => addParentChild(person.id, childId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person', person.id] });
      qc.invalidateQueries({ queryKey: ['tree'] });
      setAddingChild(false);
      setSearchQuery('');
    },
  });

  const addSpouseMut = useMutation({
    mutationFn: (spouseId: string) =>
      addSpouse({ person1Id: person.id, person2Id: spouseId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person', person.id] });
      qc.invalidateQueries({ queryKey: ['tree'] });
      setAddingSpouse(false);
      setSearchQuery('');
    },
  });

  const removeParentMut = useMutation({
    mutationFn: (parentId: string) => removeParentChild(parentId, person.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person', person.id] });
      qc.invalidateQueries({ queryKey: ['tree'] });
    },
  });

  const removeChildMut = useMutation({
    mutationFn: (childId: string) => removeParentChild(person.id, childId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person', person.id] });
      qc.invalidateQueries({ queryKey: ['tree'] });
    },
  });

  const removeSpouseMut = useMutation({
    mutationFn: (spouseId: string) => removeSpouse(person.id, spouseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person', person.id] });
      qc.invalidateQueries({ queryKey: ['tree'] });
    },
  });

  const isAdding = addingParent || addingChild || addingSpouse;
  const currentMode = addingParent ? 'parent' : addingChild ? 'child' : 'spouse';

  function PersonSearch({ onSelect }: { onSelect: (id: string) => void }) {
    return (
      <div className="mt-2 space-y-2">
        <input
          autoFocus
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputCls} w-full`}
          placeholder="Search by name…"
        />
        <div className="max-h-36 overflow-y-auto space-y-1">
          {filtered.slice(0, 10).map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-bark-50 transition"
            >
              {p.firstName} {p.lastName}
              {p.birthDate && (
                <span className="text-gray-400 ml-1">({p.birthDate.slice(0, 4)})</span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-2">No matching persons</p>
          )}
        </div>
        <button
          onClick={() => {
            setAddingParent(false);
            setAddingChild(false);
            setAddingSpouse(false);
            setSearchQuery('');
          }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Parents */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Parents</h3>
          {!isAdding && (
            <button
              onClick={() => setAddingParent(true)}
              className="text-xs text-bark-600 hover:text-bark-800"
            >
              + Add parent
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {person.parents.map((p) => (
            <PersonBadge
              key={p.id}
              person={p}
              onNavigate={onNavigate}
              onRemove={() => removeParentMut.mutate(p.id)}
            />
          ))}
          {person.parents.length === 0 && !addingParent && (
            <p className="text-xs text-gray-400">No parents recorded</p>
          )}
          {addingParent && (
            <PersonSearch
              onSelect={(id) => addParentMut.mutate(id)}
            />
          )}
        </div>
      </section>

      {/* Spouses */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Spouse(s)</h3>
          {!isAdding && (
            <button
              onClick={() => setAddingSpouse(true)}
              className="text-xs text-bark-600 hover:text-bark-800"
            >
              + Add spouse
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {person.spouses.map((s) => (
            <SpouseBadge
              key={s.id}
              spouse={s}
              personId={person.id}
              onNavigate={onNavigate}
              onRemove={() => removeSpouseMut.mutate(s.id)}
            />
          ))}
          {person.spouses.length === 0 && !addingSpouse && (
            <p className="text-xs text-gray-400">No spouses recorded</p>
          )}
          {addingSpouse && (
            <PersonSearch
              onSelect={(id) => addSpouseMut.mutate(id)}
            />
          )}
        </div>
      </section>

      {/* Children */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">Children</h3>
          {!isAdding && (
            <button
              onClick={() => setAddingChild(true)}
              className="text-xs text-bark-600 hover:text-bark-800"
            >
              + Add child
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {person.children.map((c) => (
            <PersonBadge
              key={c.id}
              person={c}
              onNavigate={onNavigate}
              onRemove={() => removeChildMut.mutate(c.id)}
            />
          ))}
          {person.children.length === 0 && !addingChild && (
            <p className="text-xs text-gray-400">No children recorded</p>
          )}
          {addingChild && (
            <PersonSearch
              onSelect={(id) => addChildMut.mutate(id)}
            />
          )}
        </div>
      </section>
    </div>
  );
}
