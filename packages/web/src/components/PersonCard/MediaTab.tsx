import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadMedia, deleteMedia, updateCaption, mediaUrl, thumbnailUrl } from '../../api/client';
import type { PersonWithRelations, MediaRecord } from '../../types';

interface Props {
  person: PersonWithRelations;
}

function MediaCard({ media, personId }: { media: MediaRecord; personId: string }) {
  const [editCaption, setEditCaption] = useState(false);
  const [caption, setCaption] = useState(media.caption ?? '');
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: () => deleteMedia(media.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['person', personId] }),
  });

  const captionMut = useMutation({
    mutationFn: () => updateCaption(media.id, caption),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['person', personId] });
      setEditCaption(false);
    },
  });

  const isPhoto = media.type === 'photo' && /image/.test(media.mimeType);

  return (
    <div className="group relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
      {isPhoto ? (
        <a href={mediaUrl(media.id)} target="_blank" rel="noreferrer">
          <img
            src={thumbnailUrl(media.id)}
            alt={media.caption ?? media.originalName}
            className="w-full h-40 object-cover"
          />
        </a>
      ) : (
        <a
          href={mediaUrl(media.id)}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center h-40 text-gray-400 hover:text-bark-600 transition"
        >
          <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-xs font-medium truncate max-w-[120px]">{media.originalName}</span>
        </a>
      )}

      {/* Overlay actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
        <button
          onClick={() => setEditCaption(true)}
          className="bg-white/90 rounded-lg p-1.5 text-gray-600 hover:text-bark-600 shadow text-xs"
        >
          ✎
        </button>
        <button
          onClick={() => {
            if (confirm('Delete this file?')) deleteMut.mutate();
          }}
          className="bg-white/90 rounded-lg p-1.5 text-red-400 hover:text-red-600 shadow text-xs"
        >
          ✕
        </button>
      </div>

      <div className="p-2">
        {editCaption ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-bark-400"
              placeholder="Caption…"
            />
            <button
              onClick={() => captionMut.mutate()}
              className="text-xs bg-bark-600 text-white rounded px-2"
            >
              ✓
            </button>
            <button
              onClick={() => setEditCaption(false)}
              className="text-xs text-gray-400"
            >
              ✕
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500 truncate">
            {media.caption || media.originalName}
          </p>
        )}
        {media.date && (
          <p className="text-xs text-gray-400 mt-0.5">{media.date}</p>
        )}
      </div>
    </div>
  );
}

export default function MediaTab({ person }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'photo' | 'document'>('photo');
  const qc = useQueryClient();

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadMedia(person.id, file, uploadType),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['person', person.id] }),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => uploadMut.mutate(f));
  };

  const photos = person.media.filter((m) => m.type === 'photo');
  const documents = person.media.filter((m) => m.type === 'document');

  return (
    <div className="p-6 space-y-6">
      {/* Upload area */}
      <div
        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center
          hover:border-bark-300 transition cursor-pointer group"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <svg
          className="w-8 h-8 mx-auto text-gray-300 group-hover:text-bark-400 transition mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm text-gray-500 group-hover:text-gray-700">
          {uploadMut.isPending ? 'Uploading…' : 'Drop files here or click to upload'}
        </p>
        <div className="flex justify-center gap-3 mt-3">
          {(['photo', 'document'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUploadType(t);
              }}
              className={`text-xs px-3 py-1 rounded-full border transition
                ${uploadType === t
                  ? 'bg-bark-600 border-bark-600 text-white'
                  : 'border-gray-200 text-gray-500 hover:border-bark-300'
                }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Photos */}
      {photos.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Photos</h3>
          <div className="grid grid-cols-2 gap-3">
            {photos.map((m) => (
              <MediaCard key={m.id} media={m} personId={person.id} />
            ))}
          </div>
        </section>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents</h3>
          <div className="grid grid-cols-2 gap-3">
            {documents.map((m) => (
              <MediaCard key={m.id} media={m} personId={person.id} />
            ))}
          </div>
        </section>
      )}

      {person.media.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No files attached yet</p>
      )}
    </div>
  );
}
