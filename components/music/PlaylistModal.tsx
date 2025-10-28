"use client";

import { useEffect, useMemo, useState } from "react";
import { listPlaylists, createPlaylist, addTrackToPlaylist } from "@/lib/storage/music";

interface PlaylistModalProps {
  open: boolean;
  onClose: () => void;
  trackId: string | null;
}

export default function PlaylistModal({ open, onClose, trackId }: PlaylistModalProps) {
  const [playlists, setPlaylists] = useState(() => listPlaylists());
  const [creatingName, setCreatingName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const canSubmit = !!trackId && (selectedId || creatingName.trim().length > 0);

  useEffect(() => {
    if (!open) return;
    try { setPlaylists(listPlaylists()); } catch {}
    setSelectedId(null);
    setCreatingName("");
  }, [open]);

  if (!open) return null;

  async function handleAdd() {
    if (!trackId) return;
    setWorking(true);
    try {
      let pid = selectedId;
      if (!pid) {
        const name = creatingName.trim();
        if (!name) return;
        const p = createPlaylist(name);
        pid = p.id;
      }
      if (pid) addTrackToPlaylist(pid, trackId);
      onClose();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[min(92vw,520px)] rounded-2xl bg-white dark:bg-gray-900 shadow-xl ring-1 ring-black/10 dark:ring-white/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Add to Playlist</h3>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">Close</button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-slate-800 dark:text-gray-200 mb-2">Existing Playlists</div>
            {playlists.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-gray-400">No playlists yet.</div>
            ) : (
              <ul className="max-h-40 overflow-auto divide-y divide-gray-100/60 dark:divide-white/10 rounded-md ring-1 ring-black/5 dark:ring-white/10">
                {playlists.map(p => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 bg-white/70 dark:bg-white/5">
                    <div className="truncate">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</div>
                    </div>
                    <button
                      className={`text-xs rounded-md px-3 py-1 ring-1 transition ${selectedId===p.id ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white dark:bg-transparent text-slate-800 dark:text-gray-200 ring-black/10 dark:ring-white/10'}`}
                      onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                    >{selectedId===p.id ? 'Selected' : 'Select'}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-slate-800 dark:text-gray-200 mb-1">Or create a new playlist</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={creatingName}
                onChange={(e) => setCreatingName(e.target.value)}
                placeholder="Playlist name"
                className="flex-1 rounded-lg bg-white/80 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 px-3 py-2 text-sm"
              />
              <button
                className="rounded-lg px-3 py-2 bg-secondary text-slate-900 font-medium disabled:opacity-60"
                onClick={handleAdd}
                disabled={!canSubmit || working}
              >Add</button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">We’ll add this song to the selected or newly created playlist.</p>
          </div>

          <div className="flex justify-end">
            <button
              className="rounded-lg px-4 py-2 bg-primary text-slate-900 font-medium disabled:opacity-60"
              onClick={handleAdd}
              disabled={!canSubmit || working}
            >Add to Playlist</button>
          </div>
        </div>
      </div>
    </div>
  );
}
