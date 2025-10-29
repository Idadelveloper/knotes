"use client";

import { useEffect, useMemo, useState } from "react";
import { Collection, createCollection, getCollection, saveCollection, removeSessionFromCollection } from "@/lib/storage/collections";
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-[92vw] max-w-xl rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="text-lg font-semibold text-slate-900">{collectionId ? 'Edit Collection' : 'New Collection'}</h3>
          <button aria-label="Close" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5">
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
              className="w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-800">Sessions in this collection</div>
            <button
              onClick={() => setOpenSelect(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
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
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 text-slate-700">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60">
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
