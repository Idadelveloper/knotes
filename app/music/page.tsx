"use client";

import { useEffect, useState } from "react";
import MusicPlayer from "@/components/music/MusicPlayer";
import SelectDialog from "@/components/music/SelectDialog";
import PlaylistModal from "@/components/music/PlaylistModal";
import {
  listTracks,
  getTrack,
  listPlaylists,
  createPlaylist,
  listTracksInPlaylist,
  addTrackToPlaylist,
  type Track,
} from "@/lib/storage/music";
import { PlaybackState } from "@/lib/types/music";
import { FaPlay, FaDownload, FaPlus, FaMusic, FaListUl } from "react-icons/fa";
import { FaBookOpen, FaPenNib } from "react-icons/fa6";

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; name: string; createdAt: string }[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("stopped");
  const [openSelect, setOpenSelect] = useState(false);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [playlistModalTrackId, setPlaylistModalTrackId] = useState<string | null>(null);
  const [addTracksOpen, setAddTracksOpen] = useState(false);
  const [addTracksPlaylistId, setAddTracksPlaylistId] = useState<string | null>(null);
  const [trackSelection, setTrackSelection] = useState<Record<string, boolean>>({});
  const [viewPlaylistId, setViewPlaylistId] = useState<string | null>(null);
  const [viewPlaylistTracks, setViewPlaylistTracks] = useState<Track[]>([]);
  // play queue for Next/Prev within a viewed playlist
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);

  const handleGenerateClick = () => {
    setOpenSelect(true);
  };

  // Load tracks (full objects) and playlists from localStorage
  useEffect(() => {
    try {
      const idx = listTracks();
      const full: Track[] = idx
        .map((m) => getTrack(m.id))
        .filter(Boolean) as Track[];
      // Only lyrics songs as requested
      const lyricsOnly = full.filter((t) => t.kind === "lyrics");
      // sort by createdAt desc
      lyricsOnly.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTracks(lyricsOnly);
    } catch {}
    try {
      setPlaylists(listPlaylists());
    } catch {}
  }, []);

  const handleAddPlaylist = () => {
    const name = typeof window !== "undefined" ? window.prompt("New playlist name") : null;
    if (!name || !name.trim()) return;
    try {
      const p = createPlaylist(name.trim());
      setPlaylists(listPlaylists());
      // Let user pick songs to add now
      setAddTracksPlaylistId(p.id);
      setTrackSelection({});
      setAddTracksOpen(true);
    } catch {}
  };

  const handleDownloadLyrics = (t: Track) => {
    const content = (t.lyrics || "").trim();
    if (!content) {
      alert("No lyrics saved for this track.");
      return;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safeTitle = (t.title || "lyrics").replace(/[^a-z0-9-_ ]/gi, "_");
    a.download = `${safeTitle}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const handlePlayTrack = (t: Track, fromQueue?: { list: Track[]; index: number }) => {
    if (!t.audioUrl) {
      alert("Audio not available for this track.");
      return;
    }
    if (fromQueue) {
      setQueue(fromQueue.list);
      setQueueIndex(fromQueue.index);
    } else {
      setQueue([]);
      setQueueIndex(-1);
    }
    setSelectedTrack(t);
    setPlaybackState("playing");
  };

  // Player controls
  const onPlayPause = () => setPlaybackState((s) => (s === "playing" ? "paused" : "playing"));
  const onStop = () => setPlaybackState("stopped");

  // Queue navigation
  const canNavigate = queue.length > 0 && queueIndex >= 0;
  const handleNext = () => {
    if (!canNavigate) return;
    let idx = queueIndex + 1;
    while (idx < queue.length && !queue[idx]?.audioUrl) idx++;
    if (idx < queue.length) {
      setQueueIndex(idx);
      setSelectedTrack(queue[idx]);
      setPlaybackState("playing");
    }
  };
  const handlePrev = () => {
    if (!canNavigate) return;
    let idx = queueIndex - 1;
    while (idx >= 0 && !queue[idx]?.audioUrl) idx--;
    if (idx >= 0) {
      setQueueIndex(idx);
      setSelectedTrack(queue[idx]);
      setPlaybackState("playing");
    }
  };

  const downloadAudio = () => {
    if (!selectedTrack?.audioUrl) return;
    const a = document.createElement("a");
    a.href = selectedTrack.audioUrl;
    a.download = `${(selectedTrack.title || "track").replace(/[^a-z0-9-_ ]/gi, "_")}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const emptyTracks = tracks.length === 0;
  const emptyPlaylists = playlists.length === 0;

  return (
    <div className="relative w-full min-h-screen overflow-hidden">
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

      <main className="mx-auto max-w-5xl px-4 sm:px-6 pt-16 pb-10">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">Music Hub</h1>
          <button
            onClick={handleGenerateClick}
            className="hidden sm:inline-flex items-center justify-center gap-2 rounded-full bg-white/80 dark:bg-white/5 backdrop-blur px-5 py-2 ring-1 ring-black/10 dark:ring-white/10 text-slate-900 dark:text-[--color-accent] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            title="Generate a new track"
            aria-label="Generate a new track"
          >
            <FaMusic aria-hidden />
            <span>Generate Track</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Tracks list */}
          <section className="rounded-2xl bg-white/85 dark:bg-white/5 backdrop-blur p-4 shadow-sm ring-1 ring-black/10 dark:ring-white/10">
            <div className="flex items-center gap-2 mb-3">
              <FaMusic className="text-purple-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">Generated Songs (Lyrics)</h2>
            </div>
            {emptyTracks ? (
              <div className="text-sm text-slate-600">
                No songs with lyrics yet. Generate one from your study session to see it here.
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {tracks.map((t) => (
                  <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{t.title || "Untitled"}</div>
                      <div className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm bg-purple-100 text-purple-800 hover:bg-purple-200"
                        onClick={() => handlePlayTrack(t)}
                        title="Play"
                      >
                        <FaPlay />
                        Play
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200"
                        onClick={() => handleDownloadLyrics(t)}
                        title="Download lyrics"
                      >
                        <FaDownload />
                        Lyrics
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        onClick={() => { setPlaylistModalTrackId(t.id); setPlaylistModalOpen(true); }}
                        title="Add to playlist"
                      >
                        + Playlist
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Right: Playlists */}
          <section className="rounded-2xl bg-white/85 dark:bg-white/5 backdrop-blur p-4 shadow-sm ring-1 ring-black/10 dark:ring-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FaListUl className="text-emerald-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">Playlists</h2>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                onClick={handleAddPlaylist}
                title="Add playlist"
              >
                <FaPlus />
                Add
              </button>
            </div>
            {emptyPlaylists ? (
              <div className="text-sm text-slate-600">No playlists yet. Click "Add" to create one.</div>
            ) : (
              <ul className="divide-y divide-black/5">
                {playlists.map((p) => (
                  <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        onClick={() => { setAddTracksPlaylistId(p.id); setTrackSelection({}); setAddTracksOpen(true); }}
                        title="Add songs"
                      >Add Songs</button>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm bg-blue-100 text-blue-800 hover:bg-blue-200"
                        onClick={() => { setViewPlaylistId(p.id); const ts = listTracksInPlaylist(p.id); setViewPlaylistTracks(ts); }}
                        title="View playlist"
                      >View</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Player */}
        {selectedTrack && selectedTrack.audioUrl && (
          <div className="mt-6">
            <MusicPlayer
              trackTitle={selectedTrack.title || "Track"}
              playbackState={playbackState}
              isGenerating={false}
              audioUrl={selectedTrack.audioUrl}
              onPlayPause={onPlayPause}
              onStop={onStop}
              onTweakSettings={() => {}}
              onRegenerate={() => {}}
              onDownload={downloadAudio}
              onNext={canNavigate ? handleNext : undefined}
              onPrev={canNavigate ? handlePrev : undefined}
            />
          </div>
        )}
      </main>

      {/* Mobile FAB for Generate Track */}
      <button
        onClick={handleGenerateClick}
        className="sm:hidden fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-secondary text-slate-900 shadow-lg ring-1 ring-black/10 hover:brightness-105 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
        title="Generate a new track"
        aria-label="Generate a new track"
      >
        <FaMusic className="mx-auto" />
        <span className="sr-only">Generate Track</span>
      </button>

      <SelectDialog open={openSelect} onClose={() => setOpenSelect(false)} />

      {/* Add to Playlist (single track) */}
      <PlaylistModal
        open={playlistModalOpen}
        onClose={() => { setPlaylistModalOpen(false); setPlaylistModalTrackId(null); setPlaylists(listPlaylists()); }}
        trackId={playlistModalTrackId}
      />

      {/* Add multiple tracks to a playlist */}
      {addTracksOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddTracksOpen(false)} />
          <div className="relative z-10 w-[92vw] max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
              <h3 className="text-lg font-semibold text-slate-900">Add Songs to Playlist</h3>
              <button onClick={() => setAddTracksOpen(false)} className="text-sm px-2 py-1 rounded-md bg-gray-100">Close</button>
            </div>
            <div className="px-5 pt-4 pb-5">
              {emptyTracks ? (
                <div className="text-sm text-slate-600">No generated songs to add yet.</div>
              ) : (
                <ul className="max-h-80 overflow-y-auto divide-y divide-black/5 rounded-xl border border-black/5">
                  {tracks.map((t) => (
                    <li key={t.id} className="p-3 flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!trackSelection[t.id]}
                        onChange={(e) => setTrackSelection((s) => ({ ...s, [t.id]: e.target.checked }))}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{t.title || "Untitled"}</div>
                        <div className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleString()}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button className="px-4 py-2 rounded-lg bg-gray-100" onClick={() => setAddTracksOpen(false)}>Cancel</button>
                <button
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-white disabled:opacity-60"
                  disabled={!addTracksPlaylistId || Object.values(trackSelection).every(v => !v)}
                  onClick={() => {
                    if (!addTracksPlaylistId) return;
                    Object.entries(trackSelection).forEach(([id, sel]) => {
                      if (sel) addTrackToPlaylist(addTracksPlaylistId, id);
                    });
                    setAddTracksOpen(false);
                    setViewPlaylistId(addTracksPlaylistId);
                    setViewPlaylistTracks(listTracksInPlaylist(addTracksPlaylistId));
                    setPlaylists(listPlaylists());
                  }}
                >Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View playlist drawer */}
      {viewPlaylistId && (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-5xl rounded-t-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/95 dark:bg-[--color-dark-bg]/95 backdrop-blur shadow-2xl">
            <div className="sticky top-0 bg-white/95 dark:bg-[--color-dark-bg]/95 backdrop-blur flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/10">
              <div className="font-semibold">{playlists.find(p => p.id === viewPlaylistId)?.name || 'Playlist'}</div>
              <div className="flex items-center gap-2">
                <button
                  className="text-sm px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800"
                  onClick={() => { setAddTracksPlaylistId(viewPlaylistId); setTrackSelection({}); setAddTracksOpen(true); }}
                >Add Songs</button>
                <button className="text-sm px-3 py-1.5 rounded-lg bg-gray-100" onClick={() => setViewPlaylistId(null)}>Close</button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-3">
              {viewPlaylistTracks.length === 0 ? (
                <div className="text-sm text-slate-600 p-3">No songs in this playlist yet.</div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {viewPlaylistTracks.map((t, idx) => (
                    <li key={t.id} className="py-3 flex items-center justify-between gap-3 hover:bg-purple-50 rounded-lg px-2">
                      <div className="min-w-0 flex items-center gap-3">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-xs font-medium">{idx+1}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{t.title || "Untitled"}</div>
                          <div className="text-[11px] inline-flex items-center gap-1 text-slate-500"><span className="px-1.5 py-0.5 rounded-full bg-slate-100">{new Date(t.createdAt).toLocaleString()}</span></div>
                        </div>
                      </div>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm bg-purple-100 text-purple-800 hover:bg-purple-200"
                        onClick={() => handlePlayTrack(t, { list: viewPlaylistTracks, index: idx })}
                        title="Play"
                      >
                        <span className="inline-block"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
                        Play
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
