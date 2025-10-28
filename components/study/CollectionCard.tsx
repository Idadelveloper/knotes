"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Collection, addSessionToCollection, deleteCollection, getCollection } from "@/lib/storage/collections";
import { listSessions } from "@/lib/storage/sessions";
import SelectDialog from "@/components/music/SelectDialog";
import { FaFolder, FaPlus, FaTrash, FaEye } from "react-icons/fa";

export type CollectionCardProps = {
  collection: Collection | { id: string; name: string; createdAt: string; sessionIds?: string[] };
  onChanged?: () => void;
};

export default function CollectionCard({ collection, onChanged }: CollectionCardProps) {
  const router = useRouter();
  const [openSelect, setOpenSelect] = useState(false);
  const [working, setWorking] = useState(false);

  const sessionCount = (() => {
    if ((collection as any).sessionIds) return (collection as any).sessionIds.length;
    const full = getCollection(collection.id);
    return full?.sessionIds?.length || 0;
  })();

  const handleAddSession = (sid: string) => {
    try {
      setWorking(true);
      addSessionToCollection(collection.id, sid);
      onChanged?.();
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = () => {
    const ok = typeof window !== 'undefined' ? window.confirm(`Delete collection "${collection.name}"?`) : true;
    if (!ok) return;
    deleteCollection(collection.id);
    onChanged?.();
  };

  // Optional: preview first session title
  let previewTitle: string | undefined;
  try {
    const full = getCollection(collection.id);
    const sid = full?.sessionIds?.[0];
    if (sid) {
      const lst = listSessions();
      const found = lst.find(s => s.id === sid);
      previewTitle = found?.title;
    }
  } catch {}

  return (
    <div className="rounded-xl border border-black/5 p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FaFolder className="text-amber-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate">{collection.name}</div>
            <div className="text-xs text-slate-500 truncate">{sessionCount} session{sessionCount === 1 ? '' : 's'}{previewTitle ? ` • ${previewTitle}` : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200"
            onClick={() => {
              try { router.push(`/study/collection/${collection.id}`); }
              catch { if (typeof window !== 'undefined') window.location.href = `/study/collection/${collection.id}`; }
            }}
            disabled={working}
            title="View collection"
          >
            <FaEye /> View
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
            onClick={() => setOpenSelect(true)}
            disabled={working}
            title="Add session to this collection"
          >
            <FaPlus /> Add
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-red-100 text-red-800 hover:bg-red-200"
            onClick={handleDelete}
            disabled={working}
            title="Delete collection"
          >
            <FaTrash /> Delete
          </button>
        </div>
      </div>

      <SelectDialog
        open={openSelect}
        onClose={() => setOpenSelect(false)}
        mode="study"
        onSelectSession={(sid) => {
          handleAddSession(sid);
          setOpenSelect(false);
        }}
      />
    </div>
  );
}
