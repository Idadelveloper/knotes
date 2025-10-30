"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listSessions } from "@/lib/storage/sessions";
import { listCollections, createCollection } from "@/lib/storage/collections";
import CollectionCard from "@/components/study/CollectionCard";
import CollectionEditor from "@/components/study/CollectionEditor";
import { FaPlus, FaFolderOpen, FaMusic } from "react-icons/fa";
import { FaBookOpen, FaPenNib } from "react-icons/fa6";

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
    <main className="relative w-full min-h-screen overflow-hidden">
      {/* Decorative background gradients and icons (match landing) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 50% at 0% 0%, rgba(139,198,236,0.35) 0%, rgba(139,198,236,0.08) 55%, rgba(139,198,236,0.03) 100%), " +
              "radial-gradient(55% 55% at 100% 100%, rgba(179,255,171,0.35) 0%, rgba(179,255,171,0.08) 55%, rgba(179,255,171,0.02) 100%)",
          }}
        />
        {/* Scattered study/music icons */}
        <div className="absolute inset-0">
          <span className="absolute left-[8%] top-[18%] text-primary/25"><FaMusic size={28} /></span>
          <span className="absolute left-[22%] top-[40%] text-primary/20"><FaBookOpen size={32} /></span>
          <span className="absolute left-[12%] bottom-[22%] text-primary/15"><FaPenNib size={26} /></span>

          <span className="absolute right-[10%] top-[22%] text-primary/20"><FaBookOpen size={30} /></span>
          <span className="absolute right-[20%] top-[38%] text-primary/25"><FaMusic size={34} /></span>
          <span className="absolute right-[14%] bottom-[18%] text-primary/15"><FaPenNib size={28} /></span>

          <span className="absolute left-1/2 top-[12%] -translate-x-1/2 text-primary/15"><FaMusic size={40} /></span>
          <span className="absolute left-1/2 bottom-[12%] -translate-x-1/2 text-primary/15"><FaBookOpen size={36} /></span>
        </div>
      </div>

      {/* Page container */}
      <div className="mx-auto w-full max-w-6xl px-5 pt-20 pb-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">Study Area</h1>
          <button
            onClick={handleAddCollection}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white/80 dark:bg-white/5 backdrop-blur px-4 py-2 ring-1 ring-black/10 dark:ring-white/10 text-slate-900 dark:text-[--color-accent] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            title="Create a new collection"
          >
            <FaPlus />
            <span className="hidden sm:inline">New Collection</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: Uploads / Sessions */}
          <section className="rounded-2xl bg-white/85 dark:bg-white/5 backdrop-blur p-4 shadow-sm ring-1 ring-black/10 dark:ring-white/10">
            <div className="flex items-center gap-2 mb-3">
              <FaBookOpen className="text-primary" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">Uploads / Sessions</h2>
            </div>
            {sessions.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-400">No uploads yet. Go to Home to add one.</div>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {sessions.map((s) => (
                  <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900 dark:text-[--color-accent]">{s.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(s.createdAt).toLocaleString()}</div>
                    </div>
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur px-3 py-1.5 ring-1 ring-black/10 dark:ring-white/10 text-slate-800 dark:text-[--color-accent] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
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
          <section className="rounded-2xl bg-white/85 dark:bg-white/5 backdrop-blur p-4 shadow-sm ring-1 ring-black/10 dark:ring-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">Collections</h2>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-slate-900 font-medium shadow-[0_4px_0_rgba(0,0,0,0.08)] hover:shadow-[0_6px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px"
                onClick={handleAddCollection}
              >
                <FaPlus /> Add Collection
              </button>
            </div>
            {collections.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-400">No collections yet. Click "Add Collection" to create one.</div>
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
      </div>
    </main>
  );
}
