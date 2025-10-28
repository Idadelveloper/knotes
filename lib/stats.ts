export type DashboardStats = {
  uploads: number;
  studyMinutes: number;
  musicGenerations: number;
  quizzesTaken: number;
};

export type RecentSession = {
  id: string;
  title: string;
  openedAt: string; // ISO string
  href?: string;
};

export type RecentTrack = {
  id: string;
  title: string;
  playedAt: string; // ISO string
  href?: string;
};

const STATS_KEY = "knotes_stats";
const RECENTS_KEY = "knotes_recent_sessions";
const RECENT_TRACKS_KEY = "knotes_recent_tracks";

function safeParse<T>(val: string | null, fallback: T): T {
  try {
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getStats(): DashboardStats {
  if (typeof window === "undefined") {
    return { uploads: 0, studyMinutes: 0, musicGenerations: 0, quizzesTaken: 0 };
  }
  return safeParse<DashboardStats>(
    localStorage.getItem(STATS_KEY),
    { uploads: 0, studyMinutes: 0, musicGenerations: 0, quizzesTaken: 0 }
  );
}

export function setStats(next: DashboardStats) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_KEY, JSON.stringify(next));
}

export function incStat<K extends keyof DashboardStats>(key: K, by: number = 1) {
  if (typeof window === "undefined") return;
  const cur = getStats();
  const val = Number(cur[key] || 0) + by;
  (cur as any)[key] = val < 0 ? 0 : val;
  setStats(cur);
}

export function addStudyMinutes(minutes: number) {
  if (!minutes || minutes <= 0) return;
  incStat("studyMinutes", minutes);
}

export function getRecentSessions(): RecentSession[] {
  if (typeof window === "undefined") return [];
  const arr = safeParse<RecentSession[]>(localStorage.getItem(RECENTS_KEY), []);
  // sort desc by openedAt
  return arr
    .filter(s => !!s && !!s.id && !!s.title)
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
}

export function addRecentSession(s: RecentSession, maxItems = 10) {
  if (typeof window === "undefined") return;
  const cur = getRecentSessions();
  // de-dupe by id (or by title if id missing)
  const filtered = cur.filter(x => x.id !== s.id && x.title !== s.title);
  const next = [s, ...filtered].slice(0, maxItems);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

export function getRecentTracks(): RecentTrack[] {
  if (typeof window === "undefined") return [];
  const arr = safeParse<RecentTrack[]>(localStorage.getItem(RECENT_TRACKS_KEY), []);
  return arr
    .filter(t => !!t && !!t.id && !!t.title)
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
}

export function addRecentTrack(t: RecentTrack, maxItems = 10) {
  if (typeof window === "undefined") return;
  const cur = getRecentTracks();
  const filtered = cur.filter(x => x.id !== t.id && x.title !== t.title);
  const next = [t, ...filtered].slice(0, maxItems);
  localStorage.setItem(RECENT_TRACKS_KEY, JSON.stringify(next));
}
