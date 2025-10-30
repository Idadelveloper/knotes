"use client";

import { useEffect, useMemo, useState } from "react";
import { Collection, createCollection, getCollection, saveCollection } from "@/lib/storage/collections";
import { listSessions } from "@/lib/storage/sessions";
import { HiOutlineX } from "react-icons/hi";
import SelectDialog from "@/components/music/SelectDialog";

export type CollectionEditorProps = {
  open: boolean;
  onClose: () => void;
  collectionId?: string; // if provided, edit; else create new
  onSaved?: (c: Collection) => void;
};

export default function CollectionEditor({ open, onClose, collectionId, onSaved }: CollectionEditorProps) {
  const [name, setName] = useState("");
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [openSelect, setOpenSelect] = useState(false);

  // Load when opening
  useEffect(() => {
    if (!open) return;
    if (collectionId) {
      const c = getCollection(collectionId);
      if (c) {
        setName(c.name);
        setSessionIds(c.sessionIds || []);
      }
    } else {
      setName("");
      setSessionIds([]);
    }
  }, [open, collectionId]);

  const sessionsIndex = useMemo(() => {
    try { return listSessions(); } catch { return []; }
  }, [open]);

  const resolveSessionTitle = (id: string) => sessionsIndex.find(s => s.id === id)?.title || "Untitled";

  const addSession = (sid: string) => {
    setSessionIds((prev) => (prev.includes(sid) ? prev : [sid, ...prev]));
  };

  const removeSession = (sid: string) => {
    setSessionIds((prev) => prev.filter(id => id !== sid));
  };

  const handleSave = () => {
    const n = name.trim();
    if (!n) {
      alert("Please enter a collection name.");
      return;
    }
    setSaving(true);
    try {
      if (collectionId) {
        const existing = getCollection(collectionId);
        const c: Collection = existing ? { ...existing, name: n, sessionIds: [...sessionIds] } : { id: collectionId, name: n, createdAt: new Date().toISOString(), sessionIds: [...sessionIds] } as any;
        saveCollection(c);
        onSaved?.(c);
      } else {
        const c = createCollection(n);
        c.sessionIds = [...sessionIds];
        saveCollection(c);
        onSaved?.(c);
      }
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[92vw] max-w-xl rounded-3xl bg-white/80 dark:bg-white/5 backdrop-blur shadow-[0_20px_50px_rgba(0,0,0,0.25)] ring-1 ring-black/10 dark:ring-white/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">{collectionId ? 'Edit Collection' : 'New Collection'}</h3>
          <button aria-label="Close" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/5 text-slate-700 dark:text-[--color-accent] hover:bg-white/80">
            <HiOutlineX />
          </button>
        </div>
        <div className="px-5 pt-4 pb-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Collection name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Biology — Cell Structure"
              className="w-full rounded-xl px-3 py-2 bg-white/70 dark:bg-white/5 backdrop-blur ring-1 ring-black/10 dark:ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 text-slate-900 dark:text-[--color-accent] placeholder:text-slate-400"
            />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-800">Sessions in this collection</div>
            <button
              onClick={() => setOpenSelect(true)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm bg-white/80 dark:bg-white/5 backdrop-blur ring-1 ring-black/10 dark:ring-white/10 text-slate-900 dark:text-[--color-accent] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              title="Add session"
            >
              Add Session
            </button>
          </div>

          {sessionIds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/10 p-6 text-center text-slate-600">
              No sessions yet. Click "Add Session" to include your uploads.
            </div>
          ) : (
            <ul className="divide-y divide-black/5 rounded-xl border border-black/5 max-h-72 overflow-y-auto">
              {sessionIds.map((sid) => (
                <li key={sid} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{resolveSessionTitle(sid)}</div>
                  </div>
                  <button
                    onClick={() => removeSession(sid)}
                    className="text-sm text-red-700 hover:underline"
                    title="Remove"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-full bg-white/80 dark:bg-white/5 backdrop-blur ring-1 ring-black/10 dark:ring-white/10 text-slate-700 dark:text-[--color-accent] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 shadow-sm">
              Save
            </button>
          </div>
        </div>
      </div>

      <SelectDialog
        open={openSelect}
        onClose={() => setOpenSelect(false)}
        mode="study"
        onSelectSession={(sid) => {
          addSession(sid);
          setOpenSelect(false);
        }}
      />
    </div>
  );
}
