import { useRef, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFaceSuggestions, confirmFace, rejectFace, thumbnailUrl } from '../../api/client';
import type { FaceSuggestion, BoundingBox } from '../../types';

interface Props {
  personId: string;
}

function BoundingBoxOverlay({
  box,
  containerRef,
}: {
  box: BoundingBox;
  containerRef: React.RefObject<HTMLImageElement | null>;
}) {
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const img = containerRef.current;
    if (!img) return;

    const update = () => {
      const r = img.getBoundingClientRect();
      const parent = img.parentElement?.getBoundingClientRect();
      if (!parent) return;
      setRect({
        left: (r.left - parent.left) + box.x * r.width,
        top: (r.top - parent.top) + box.y * r.height,
        width: box.width * r.width,
        height: box.height * r.height,
      });
    };

    update();
    img.addEventListener('load', update);
    window.addEventListener('resize', update);
    return () => {
      img.removeEventListener('load', update);
      window.removeEventListener('resize', update);
    };
  }, [box, containerRef]);

  if (!rect) return null;

  return (
    <div
      className="absolute border-2 border-yellow-400 rounded pointer-events-none"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      <div className="absolute -top-5 left-0 bg-yellow-400 text-yellow-900 text-xs px-1 rounded-t font-medium whitespace-nowrap">
        face detected
      </div>
    </div>
  );
}

function SuggestionCard({
  s,
  personId,
}: {
  s: FaceSuggestion;
  personId: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['face-suggestions', personId] });
    qc.invalidateQueries({ queryKey: ['person', personId] });
  };

  const confirmMut = useMutation({
    mutationFn: () => confirmFace(s.id, personId),
    onSuccess: invalidate,
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectFace(s.id),
    onSuccess: invalidate,
  });

  const pct = Math.round(s.confidence * 100);
  const confidenceColor =
    pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
      <div className="relative inline-block">
        <img
          ref={imgRef}
          src={thumbnailUrl(s.mediaId)}
          alt="Detected face"
          className="w-24 h-24 object-cover rounded-lg"
        />
        <BoundingBoxOverlay box={s.boundingBox} containerRef={imgRef} />
      </div>

      <div>
        <p className="text-sm font-medium text-gray-800">
          Suggested:{' '}
          <span className="text-bark-700">{s.suggestedPersonName}</span>
        </p>
        <p className={`text-xs font-mono ${confidenceColor}`}>{pct}% confidence</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => confirmMut.mutate()}
          disabled={confirmMut.isPending}
          className="flex-1 text-xs bg-green-600 text-white rounded-lg py-1.5 px-2
            hover:bg-green-700 transition disabled:opacity-50"
        >
          {confirmMut.isPending ? '…' : 'Confirm'}
        </button>
        <button
          onClick={() => rejectMut.mutate()}
          disabled={rejectMut.isPending}
          className="flex-1 text-xs border border-gray-200 text-gray-600 rounded-lg py-1.5 px-2
            hover:bg-gray-50 transition disabled:opacity-50"
        >
          {rejectMut.isPending ? '…' : 'Not them'}
        </button>
      </div>
    </div>
  );
}

export default function FaceSuggestionPanel({ personId }: Props) {
  const { data: suggestions = [] } = useQuery({
    queryKey: ['face-suggestions', personId],
    queryFn: () => getFaceSuggestions(personId, 'pending'),
    refetchInterval: 8000,
  });

  if (suggestions.length === 0) return null;

  return (
    <div className="border-t border-amber-100 bg-amber-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-amber-800">
          Face matches found
        </span>
        <span className="bg-amber-200 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
          {suggestions.length}
        </span>
        <span className="text-xs text-amber-600">
          — is this person in these photos?
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} s={s} personId={personId} />
        ))}
      </div>
    </div>
  );
}
