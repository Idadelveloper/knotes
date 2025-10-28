"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import MusicPlayer from "@/components/music/MusicPlayer";
import {
  listTracks,
  getTrack,
  listPlaylists,
  createPlaylist,
  type Track,
} from "@/lib/storage/music";
import { PlaybackState } from "@/lib/types/music";
import { FaPlay, FaDownload, FaPlus, FaMusic, FaListUl } from "react-icons/fa";

export default function MusicPage() {
  const router = useRouter();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; name: string; createdAt: string }[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("stopped");

  const handleGenerateClick = () => {
    try {
      const sid = typeof window !== 'undefined' ? sessionStorage.getItem('knotes_current_session_id') : null;
      if (sid) {
        router.push(`/music/${sid}`);
      } else {
        router.push(`/library?intent=music`);
      }
    } catch {
      router.push(`/library?intent=music`);
    }
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
      createPlaylist(name.trim());
      setPlaylists(listPlaylists());
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

  const handlePlayTrack = (t: Track) => {
    if (!t.audioUrl) {
      alert("Audio not available for this track.");
      return;
    }
    setSelectedTrack(t);
    setPlaybackState("playing");
  };

  // Player controls
  const onPlayPause = () => setPlaybackState((s) => (s === "playing" ? "paused" : "playing"));
  const onStop = () => setPlaybackState("stopped");

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
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Music Hub</h1>
        <div className="mb-5">
          <button
            onClick={handleGenerateClick}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-white shadow-[0_4px_0_rgba(0,0,0,0.08)] hover:bg-purple-700 hover:shadow-[0_6px_0_rgba(0,0,0,0.12)] active:translate-y-px active:shadow-[0_3px_0_rgba(0,0,0,0.12)]"
            title="Generate a new track"
          >
            Generate Track
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Tracks list */}
          <section className="rounded-xl border border-black/5 p-4 shadow-sm bg-white">
            <div className="flex items-center gap-2 mb-3">
              <FaMusic className="text-purple-500" />
              <h2 className="text-lg font-semibold text-slate-900">Generated Songs (Lyrics)</h2>
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
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Right: Playlists */}
          <section className="rounded-xl border border-black/5 p-4 shadow-sm bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FaListUl className="text-emerald-500" />
                <h2 className="text-lg font-semibold text-slate-900">Playlists</h2>
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
                  <li key={p.id} className="py-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleString()}</div>
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
            />
          </div>
        )}
      </main>
    </div>
  );
}
