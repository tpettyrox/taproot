import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerExtraction, pollExtractionJob, getPersons, updatePerson, createPerson } from '../../api/client';
import type { ExtractedPerson, ExtractionJobStatus } from '../../types';
import Modal from '../ui/Modal';

interface Props {
  mediaId: string;
  onClose: () => void;
}

const FIELD_LABELS: Record<keyof ExtractedPerson, string> = {
  name: 'Name',
  birthDate: 'Birth date',
  birthPlace: 'Birth place',
  deathDate: 'Death date',
  deathPlace: 'Death place',
  occupation: 'Occupation',
  bio: 'Biography',
};

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-red-100 text-red-600',
};

function StatusBadge({ status }: { status: ExtractionJobStatus }) {
  const map: Record<ExtractionJobStatus, { label: string; cls: string }> = {
    pending: { label: 'Queued', cls: 'bg-gray-100 text-gray-600' },
    processing: { label: 'Reading document…', cls: 'bg-blue-100 text-blue-700' },
    done: { label: 'Complete', cls: 'bg-green-100 text-green-700' },
    failed: { label: 'Failed', cls: 'bg-red-100 text-red-600' },
  };
  const { label, cls } = map[status];
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export default function ExtractionModal({ mediaId, onClose }: Props) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<Record<number, Set<keyof ExtractedPerson>>>(
    {}
  );
  const [targetPersonIds, setTargetPersonIds] = useState<Record<number, string>>({});
  const [applied, setApplied] = useState(false);
  const qc = useQueryClient();

  const triggerMut = useMutation({
    mutationFn: () => triggerExtraction(mediaId),
    onSuccess: (data) => setJobId(data.jobId),
  });

  const { data: job } = useQuery({
    queryKey: ['extraction-job', jobId],
    queryFn: () => pollExtractionJob(jobId!),
    enabled: !!jobId && !applied,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'pending' || s === 'processing' ? 2000 : false;
    },
  });

  const { data: allPersons = [] } = useQuery({
    queryKey: ['persons'],
    queryFn: getPersons,
    enabled: job?.status === 'done',
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!job?.result) return;
      for (let i = 0; i < job.result.persons.length; i++) {
        const extracted = job.result.persons[i];
        const fields = selectedFields[i] ?? new Set(Object.keys(extracted) as (keyof ExtractedPerson)[]);
        const targetId = targetPersonIds[i];

        const payload: Record<string, string> = {};
        fields.forEach((f) => {
          if (f !== 'name' && extracted[f]) {
            payload[f] = extracted[f] as string;
          }
        });

        if (Object.keys(payload).length === 0) continue;

        if (targetId === '__new__') {
          const nameParts = (extracted.name ?? 'Unknown').trim().split(' ');
          const firstName = nameParts[0] ?? 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || 'Unknown';
          const newPerson = await createPerson({ firstName, lastName, ...payload });
          qc.invalidateQueries({ queryKey: ['persons'] });
          qc.invalidateQueries({ queryKey: ['tree'] });
          console.log('Created new person', newPerson.id);
        } else if (targetId) {
          await updatePerson(targetId, payload);
          qc.invalidateQueries({ queryKey: ['person', targetId] });
          qc.invalidateQueries({ queryKey: ['tree'] });
        }
      }
      setApplied(true);
    },
  });

  function toggleField(personIdx: number, field: keyof ExtractedPerson) {
    setSelectedFields((prev) => {
      const copy = { ...prev };
      const set = new Set(copy[personIdx] ?? (Object.keys(
        job?.result?.persons[personIdx] ?? {}
      ) as (keyof ExtractedPerson)[]));
      if (set.has(field)) {
        set.delete(field);
      } else {
        set.add(field);
      }
      copy[personIdx] = set;
      return copy;
    });
  }

  function getFields(personIdx: number): Set<keyof ExtractedPerson> {
    if (selectedFields[personIdx]) return selectedFields[personIdx];
    const p = job?.result?.persons[personIdx];
    return new Set(Object.keys(p ?? {}) as (keyof ExtractedPerson)[]);
  }

  return (
    <Modal open onClose={onClose} title="Extract with AI" wide>
      <div className="p-6 space-y-6">

        {/* Trigger state */}
        {!jobId && (
          <div className="text-center py-8 space-y-4">
            <div className="text-4xl">📄</div>
            <p className="text-sm text-gray-600 max-w-sm mx-auto">
              Claude will read this document and extract biographical details — names, dates, places,
              and occupations — for your review.
            </p>
            <button
              onClick={() => triggerMut.mutate()}
              disabled={triggerMut.isPending}
              className="bg-bark-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium
                hover:bg-bark-800 transition disabled:opacity-50"
            >
              {triggerMut.isPending ? 'Starting…' : 'Start extraction'}
            </button>
          </div>
        )}

        {/* Loading/processing */}
        {jobId && job && (job.status === 'pending' || job.status === 'processing') && (
          <div className="text-center py-10 space-y-4">
            <div className="w-10 h-10 border-4 border-bark-200 border-t-bark-600 rounded-full animate-spin mx-auto" />
            <StatusBadge status={job.status} />
            <p className="text-sm text-gray-500">Claude is reading the document…</p>
          </div>
        )}

        {/* Failed */}
        {job?.status === 'failed' && (
          <div className="text-center py-8 space-y-3">
            <div className="text-4xl">⚠️</div>
            <p className="text-sm font-medium text-gray-700">Extraction failed</p>
            <p className="text-xs text-red-500 font-mono max-w-sm mx-auto">{job.error}</p>
            <button
              onClick={() => { setJobId(null); triggerMut.reset(); }}
              className="text-sm text-bark-600 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Applied */}
        {applied && (
          <div className="text-center py-8 space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-sm font-medium text-gray-700">Fields applied successfully</p>
            <button
              onClick={onClose}
              className="bg-bark-700 text-white px-5 py-2 rounded-xl text-sm hover:bg-bark-800 transition"
            >
              Done
            </button>
          </div>
        )}

        {/* Results */}
        {job?.status === 'done' && job.result && !applied && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusBadge status="done" />
                {job.result.confidence && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_BADGE[job.result.confidence]}`}>
                    {job.result.confidence} confidence
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {job.result.persons.length === 1
                  ? '1 person found'
                  : `${job.result.persons.length} persons found`}
              </p>
            </div>

            {job.result.notes && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                {job.result.notes}
              </p>
            )}

            {job.result.persons.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No biographical data could be extracted from this document.
              </p>
            )}

            {job.result.persons.map((person, i) => (
              <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">
                    {person.name ?? `Person ${i + 1}`}
                  </p>
                </div>

                <div className="p-4 space-y-3">
                  {/* Field checklist */}
                  <div className="space-y-1.5">
                    {(Object.keys(person) as (keyof ExtractedPerson)[])
                      .filter((f) => f !== 'name' && person[f])
                      .map((field) => (
                        <label key={field} className="flex items-start gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={getFields(i).has(field)}
                            onChange={() => toggleField(i, field)}
                            className="mt-0.5 accent-bark-600"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-gray-500">
                              {FIELD_LABELS[field]}:{' '}
                            </span>
                            <span className="text-sm text-gray-800">{person[field]}</span>
                          </div>
                        </label>
                      ))}
                  </div>

                  {/* Target person selector */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Apply to person
                    </label>
                    <select
                      value={targetPersonIds[i] ?? ''}
                      onChange={(e) =>
                        setTargetPersonIds((prev) => ({ ...prev, [i]: e.target.value }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm
                        focus:outline-none focus:ring-2 focus:ring-bark-400 transition"
                    >
                      <option value="">— Select a person —</option>
                      {allPersons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                          {p.birthDate ? ` (b. ${p.birthDate.slice(0, 4)})` : ''}
                        </option>
                      ))}
                      <option value="__new__">+ Create new person</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {job.result.persons.length > 0 && (
              <button
                onClick={() => applyMut.mutate()}
                disabled={
                  applyMut.isPending ||
                  job.result.persons.some((_, i) => !targetPersonIds[i])
                }
                className="w-full bg-bark-700 text-white rounded-xl py-2.5 text-sm font-medium
                  hover:bg-bark-800 transition disabled:opacity-50"
              >
                {applyMut.isPending ? 'Applying…' : 'Apply selected fields'}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
