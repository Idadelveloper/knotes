"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listSessions } from "@/lib/storage/sessions";
import { listCollections, createCollection } from "@/lib/storage/collections";
import CollectionCard from "@/components/study/CollectionCard";
import CollectionEditor from "@/components/study/CollectionEditor";
import { FaPlus, FaFolderOpen, FaBookOpen } from "react-icons/fa";

export default function StudyAreaPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<{ id: string; title: string; createdAt: string }[]>([]);
  const [collections, setCollections] = useState<{ id: string; name: string; createdAt: string }[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  const refresh = () => {
    try { setSessions(listSessions()); } catch {}
    try { setCollections(listCollections()); } catch {}
  };

  useEffect(() => { refresh(); }, []);

  const handleOpen = (id: string) => {
    try { sessionStorage.setItem("knotes_current_session_id", id); } catch {}
    router.push(`/study/${id}`);
  };

  const handleAddCollection = () => {
    setEditingId(undefined);
    setEditorOpen(true);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pt-20 pb-12">
      <h1 className="text-3xl font-semibold text-slate-900 mb-6">Study Area</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left: Uploads / Sessions */}
        <section className="rounded-xl border border-black/5 bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <FaBookOpen className="text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900">Uploads / Sessions</h2>
          </div>
          {sessions.length === 0 ? (
            <div className="text-sm text-slate-600">No uploads yet. Go to Home to add one.</div>
          ) : (
            <ul className="divide-y divide-black/5">
              {sessions.map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{s.title}</div>
                    <div className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200"
                    onClick={() => handleOpen(s.id)}
                    title="Open"
                  >
                    <FaFolderOpen /> Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Right: Collections */}
        <section className="rounded-xl border border-black/5 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Collections</h2>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              onClick={handleAddCollection}
            >
              <FaPlus /> Add Collection
            </button>
          </div>
          {collections.length === 0 ? (
            <div className="text-sm text-slate-600">No collections yet. Click "Add Collection" to create one.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {collections.map((c) => (
                <CollectionCard key={c.id} collection={c} onChanged={refresh} />
              ))}
            </div>
          )}
        </section>
      </div>

      <CollectionEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        collectionId={editingId}
        onSaved={() => { setEditorOpen(false); refresh(); }}
      />
    </main>
  );
}
