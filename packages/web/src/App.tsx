import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTree, createPerson } from './api/client';
import FamilyTree from './components/FamilyTree/FamilyTree';
import PersonCard from './components/PersonCard/PersonCard';
import Modal from './components/ui/Modal';
import PersonForm from './components/PersonCard/PersonForm';
import type { CreatePersonInput } from './types';

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const qc = useQueryClient();

  const { data: tree, isLoading, isError, refetch } = useQuery({
    queryKey: ['tree'],
    queryFn: getTree,
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (data: CreatePersonInput) => createPerson(data),
    onSuccess: (person) => {
      qc.invalidateQueries({ queryKey: ['tree'] });
      qc.invalidateQueries({ queryKey: ['persons'] });
      setAddingPerson(false);
      setSelectedId(person.id);
    },
  });

  return (
    <div className="flex flex-col h-screen bg-stone-100 font-sans">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-stone-200 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bark-700 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 3v1m0 16v1M5.636 5.636l.707.707m11.314 11.314l.707.707M3 12h1m16 0h1M5.636 18.364l.707-.707M18.364 5.636l-.707.707" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 font-serif tracking-tight">Taproot</h1>
            <p className="text-xs text-gray-400">Family History</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {tree && (
            <span className="text-xs text-gray-400 hidden sm:block">
              {tree.persons.length} {tree.persons.length === 1 ? 'person' : 'people'}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition"
            title="Refresh tree"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => setAddingPerson(true)}
            className="flex items-center gap-2 bg-bark-700 text-white text-sm px-4 py-2 rounded-lg
              hover:bg-bark-800 active:bg-bark-900 transition font-medium shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add person
          </button>
        </div>
      </header>

      {/* Canvas */}
      <main className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-bark-200 border-t-bark-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading family tree…</p>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="text-4xl">⚠️</div>
            <p className="text-lg font-semibold text-gray-700">Cannot connect to database</p>
            <p className="text-sm text-gray-500 max-w-sm">
              Make sure Neo4j is running (<code className="bg-gray-100 px-1 rounded">docker compose up</code>)
              and the API server is started.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 bg-bark-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-bark-800 transition"
            >
              Retry
            </button>
          </div>
        )}

        {tree && tree.persons.length === 0 && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="text-5xl mb-2">🌳</div>
            <p className="text-xl font-semibold text-gray-700 font-serif">Your family tree awaits</p>
            <p className="text-sm text-gray-500 max-w-sm">
              Add the first person to begin building your family history.
            </p>
            <button
              onClick={() => setAddingPerson(true)}
              className="mt-4 bg-bark-700 text-white text-sm px-6 py-2.5 rounded-xl
                hover:bg-bark-800 transition font-medium shadow"
            >
              Add first person
            </button>
          </div>
        )}

        {tree && tree.persons.length > 0 && (
          <FamilyTree
            data={tree}
            onSelectPerson={setSelectedId}
            highlightId={selectedId ?? undefined}
          />
        )}

        {/* Zoom hint */}
        {tree && tree.persons.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur
            rounded-full px-4 py-2 text-xs text-gray-500 shadow pointer-events-none">
            Scroll to zoom · Drag to pan · Click a person to view details
          </div>
        )}
      </main>

      {/* Person card modal */}
      <PersonCard
        personId={selectedId}
        onClose={() => setSelectedId(null)}
        onNavigate={(id) => setSelectedId(id)}
        onDeleted={() => setSelectedId(null)}
      />

      {/* Add person modal */}
      <Modal open={addingPerson} onClose={() => setAddingPerson(false)} title="Add Person">
        <PersonForm
          onSubmit={(data) => createMut.mutate(data)}
          onCancel={() => setAddingPerson(false)}
          isLoading={createMut.isPending}
        />
      </Modal>
    </div>
  );
}
