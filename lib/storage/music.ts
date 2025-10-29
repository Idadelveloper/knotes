// Local storage for generated music tracks and playlists.
// Keeps metadata, favorites, and playlist membership.

export type TrackSettings = {
  genre?: string;
  mood?: string; // aka vibe
  tempoBpm?: number;
  energy?: string;
  instruments?: string[];
  singer?: string;
  lyricStyle?: string; // 'summary' | 'educational' | 'mix' or custom
  durationSec?: number;
  manualTopics?: string;
  notes?: string; // original study notes context used for generation
};

export type Track = {
  id: string; // unique
  title: string;
  createdAt: string; // ISO
  sessionId?: string; // study session association
  kind: 'background' | 'lyrics';
  audioUrl?: string; // optional if streamed
  lyrics?: string; // for lyrics songs
  settings?: TrackSettings; // generation settings/metadata
  favorite?: boolean;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: string;
  trackIds: string[];
};

const TRACKS_KEY = 'knotes_tracks_index';
const TRACK_PREFIX = 'knotes_track_';
const PLAYLISTS_KEY = 'knotes_playlists_index';
const PLAYLIST_PREFIX = 'knotes_playlist_';

function safeParse<T>(val: string | null, fallback: T): T {
  try { return val ? (JSON.parse(val) as T) : fallback; } catch { return fallback; }
}

function saveIndex(key: string, arr: any[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    try { console.warn('[storage] Failed to save index', key, e); } catch {}
    // Best-effort: drop oldest half and retry once
    try {
      if (Array.isArray(arr) && arr.length > 1) {
        const trimmed = arr.slice(0, Math.ceil(arr.length / 2));
        localStorage.setItem(key, JSON.stringify(trimmed));
      }
    } catch {}
  }
}

export function listTracks(): Pick<Track, 'id' | 'title' | 'createdAt' | 'favorite' | 'kind'>[] {
  if (typeof window === 'undefined') return [];
  return safeParse(localStorage.getItem(TRACKS_KEY), [] as any[]);
}

export function findTrackBySession(sessionId: string, kind?: Track['kind']): Track | null {
  if (typeof window === 'undefined') return null;
  const idx = listTracks();
  for (const m of idx) {
    const full = getTrack(m.id);
    if (full && full.sessionId === sessionId && (!kind || full.kind === kind)) return full;
  }
  return null;
}

export function getTrack(id: string): Track | null {
  if (typeof window === 'undefined') return null;
  return safeParse(localStorage.getItem(TRACK_PREFIX + id), null as any);
}

export function saveTrack(t: Track) {
  if (typeof window === 'undefined') return;
  // Try to persist full track; if quota exceeded (large data URLs), drop audioUrl and retry
  try {
    localStorage.setItem(TRACK_PREFIX + t.id, JSON.stringify(t));
  } catch (e) {
    try {
      const { audioUrl, ...rest } = t as any;
      localStorage.setItem(TRACK_PREFIX + t.id, JSON.stringify(rest));
      try { console.warn('[storage] Track audio too large to persist; saved metadata without audio', t.id); } catch {}
    } catch (e2) {
      try { console.warn('[storage] Failed to save track payload', t.id, e2); } catch {}
    }
  }
  const idx = listTracks();
  const filtered = idx.filter((x) => x.id !== t.id);
  const minimal = { id: t.id, title: t.title, createdAt: t.createdAt, favorite: !!t.favorite, kind: t.kind };
  saveIndex(TRACKS_KEY, [minimal, ...filtered]);
}

export function addTrack(input: Omit<Track, 'id' | 'createdAt'> & { id?: string }): Track {
  const id = input.id || generateId();
  const createdAt = new Date().toISOString();
  const t: Track = { id, createdAt, ...input } as Track;
  saveTrack(t);
  return t;
}

export function toggleFavorite(id: string, value?: boolean) {
  const t = getTrack(id);
  if (!t) return;
  t.favorite = typeof value === 'boolean' ? value : !t.favorite;
  saveTrack(t);
}

export function listFavorites() {
  return listTracks().filter((t) => t.favorite);
}

export function listPlaylists(): Pick<Playlist, 'id' | 'name' | 'createdAt'>[] {
  if (typeof window === 'undefined') return [];
  return safeParse(localStorage.getItem(PLAYLISTS_KEY), [] as any[]);
}

export function getPlaylist(id: string): Playlist | null {
  if (typeof window === 'undefined') return null;
  return safeParse(localStorage.getItem(PLAYLIST_PREFIX + id), null as any);
}

export function savePlaylist(p: Playlist) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PLAYLIST_PREFIX + p.id, JSON.stringify(p));
  const idx = listPlaylists();
  const filtered = idx.filter((x) => x.id !== p.id);
  const minimal = { id: p.id, name: p.name, createdAt: p.createdAt };
  saveIndex(PLAYLISTS_KEY, [minimal, ...filtered]);
}

export function createPlaylist(name: string): Playlist {
  const p: Playlist = { id: generateId(), name, createdAt: new Date().toISOString(), trackIds: [] };
  savePlaylist(p);
  return p;
}

export function addTrackToPlaylist(playlistId: string, trackId: string) {
  const p = getPlaylist(playlistId);
  if (!p) return;
  if (!p.trackIds.includes(trackId)) p.trackIds.unshift(trackId);
  savePlaylist(p);
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string) {
  const p = getPlaylist(playlistId);
  if (!p) return;
  p.trackIds = p.trackIds.filter((id) => id !== trackId);
  savePlaylist(p);
}

export function listTracksInPlaylist(playlistId: string): Track[] {
  const p = getPlaylist(playlistId);
  if (!p) return [];
  return p.trackIds.map((id) => getTrack(id)).filter(Boolean) as Track[];
}

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 't_' + Math.random().toString(36).slice(2, 10);
}
