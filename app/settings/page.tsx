"use client";

import { useEffect, useMemo, useState } from "react";
import SettingsCard from "@/components/SettingsCard";
import { FaCloudUploadAlt, FaFileAlt, FaEllipsisH, FaUserCircle, FaFireAlt, FaSignOutAlt, FaTrashAlt, FaCrown } from "react-icons/fa";
import { signOut, deleteUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getStats, getRecentSessions, getRecentTracks, type DashboardStats } from "@/lib/stats";
import { listSessions } from "@/lib/storage/sessions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, AreaChart, Area, PieChart, Pie, Cell } from "recharts";

const PREF_AUTO_DOWNLOAD = "knotes_pref_auto_download";
const PREF_BACKUP_ENABLED = "knotes_pref_backup";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // UI State
  const [displayMode, setDisplayMode] = useState<'Light' | 'Focus'>("Light");
  const [textSize, setTextSize] = useState<number>(16);
  const [voiceTone, setVoiceTone] = useState<'Male' | 'Female' | 'Neutral'>("Female");
  const [language, setLanguage] = useState<string>("English");
  const [volume, setVolume] = useState<number>(75);
  const [tempo, setTempo] = useState<number>(50);
  const [autoSave, setAutoSave] = useState<boolean>(true);
  const [autoDownload, setAutoDownload] = useState<boolean>(false);
  const [backupEnabled, setBackupEnabled] = useState<boolean>(false);

  // Data State
  const [stats, setStats] = useState<DashboardStats>({ uploads: 0, studyMinutes: 0, musicGenerations: 0, quizzesTaken: 0 });
  const [sessionsCount, setSessionsCount] = useState<number>(0);

  // Load prefs and stats
  useEffect(() => {
    try {
      setAutoDownload(localStorage.getItem(PREF_AUTO_DOWNLOAD) === '1');
      setBackupEnabled(localStorage.getItem(PREF_BACKUP_ENABLED) === '1');
      setStats(getStats());
      setSessionsCount(listSessions().length);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREF_AUTO_DOWNLOAD, autoDownload ? '1' : '0'); } catch {}
  }, [autoDownload]);
  useEffect(() => {
    try { localStorage.setItem(PREF_BACKUP_ENABLED, backupEnabled ? '1' : '0'); } catch {}
  }, [backupEnabled]);

  const recentSessions = useMemo(() => getRecentSessions(), []);
  const recentTracks = useMemo(() => getRecentTracks(), []);

  // Derived metrics
  const hoursStudied = useMemo(() => (stats.studyMinutes || 0) / 60, [stats.studyMinutes]);
  const approxAudioMinutes = useMemo(() => Math.round((recentTracks.length || 0) * 3), [recentTracks.length]);
  const hoursAudio = useMemo(() => approxAudioMinutes / 60, [approxAudioMinutes]);

  // Streak calculation: consecutive days with at least one session opened
  const streak = useMemo(() => {
    const days = new Set<string>();
    recentSessions.forEach(s => {
      const d = new Date(s.openedAt);
      if (!isNaN(d.getTime())) days.add(d.toDateString());
    });
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      const key = dt.toDateString();
      if (days.has(key)) count++;
      else if (i === 0) continue; // allow today to be empty without breaking streak until tomorrow
      else break;
    }
    return count;
  }, [recentSessions]);

  // Charts data: last 14 days study vs music activity
  const activityData = useMemo(() => {
    const map: Record<string, { name: string; study: number; music: number }> = {};
    const days = 14;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      map[key] = { name: key, study: 0, music: 0 };
    }
    recentSessions.forEach(s => {
      const d = new Date(s.openedAt);
      const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (map[key]) map[key].study += 1;
    });
    recentTracks.forEach(t => {
      const d = new Date(t.playedAt);
      const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (map[key]) map[key].music += 1;
    });
    return Object.values(map);
  }, [recentSessions, recentTracks]);

  const breakdownData = useMemo(() => (
    [
      { name: 'Uploads', value: stats.uploads || sessionsCount },
      { name: 'Songs', value: stats.musicGenerations || recentTracks.length },
      { name: 'Quizzes', value: stats.quizzesTaken || 0 },
      { name: 'Study hrs', value: Number(hoursStudied.toFixed(1)) },
    ]
  ), [stats, sessionsCount, recentTracks.length, hoursStudied]);

  const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7"];

  const Segmented = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: any) => void }) => (
    <div className="inline-flex items-center bg-gray-100 p-1 rounded-lg">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${active ? 'bg-white shadow text-slate-900' : 'text-gray-700 hover:bg-gray-200'}`}
            onClick={() => onChange(opt)}
            type="button"
          >
            {opt}
          </button>
        );
      })}
    </div>
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (e) {
      alert("Failed to log out. Please try again.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return alert("No user authenticated.");
    const sure = confirm("Delete your account and local data? This cannot be undone.");
    if (!sure) return;
    try {
      await deleteUser(auth.currentUser);
      try { clearAppStorage(); } catch {}
      router.push("/");
    } catch (e: any) {
      alert("Failed to delete account. You may need to reauthenticate.");
    }
  };

  function clearAppStorage() {
    if (typeof window === 'undefined') return;
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) as string;
        if (key && key.startsWith('knotes_')) toRemove.push(key);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      alert(`Cleared ${toRemove.length} items from local storage.`);
    } catch (e) {
      alert('Failed to clear storage.');
    }
  }

  return (
    <main className="pb-10 space-y-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">Settings</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/pro')}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white/80 dark:bg-white/5 backdrop-blur ring-1 ring-amber-300/60 dark:ring-amber-400/40 text-amber-700 dark:text-amber-300 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            title="Unlock Knotes Pro"
          >
            <FaCrown /> Subscribe to Pro
          </button>
          <button
            onClick={() => alert('Chrome extension is coming soon!')}
            className="relative inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white/80 dark:bg-white/5 backdrop-blur ring-1 ring-blue-300/60 dark:ring-blue-400/40 text-blue-700 dark:text-blue-300 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            title="Chrome extension coming soon"
          >
            Get Chrome Extension
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100/80 text-blue-700 dark:bg-white/10 dark:text-blue-200 px-2 py-0.5 text-xs font-semibold">Coming soon</span>
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white/80 dark:bg-white/5 backdrop-blur ring-1 ring-red-300/60 dark:ring-red-400/40 text-red-700 dark:text-red-300 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
            title="Sign out of your account"
          >
            <FaSignOutAlt /> Log Out
          </button>
        </div>
      </header>

      {/* User Card */}
      <SettingsCard title="Your Account">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center">
              {user?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt={user.displayName || user.email || 'User'} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <FaUserCircle className="h-8 w-8" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">{user?.displayName || 'Anonymous User'}</div>
              <div className="text-sm text-slate-600 truncate">{user?.email || 'Not signed in'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/billing')} className="rounded-lg px-3 py-2 ring-1 ring-slate-300 hover:bg-slate-50">Manage Plan</button>
            <button onClick={handleDeleteAccount} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 ring-1 ring-red-200 text-red-600 hover:bg-red-50"><FaTrashAlt /> Delete Account</button>
          </div>
        </div>
      </SettingsCard>

      {/* Analytics */}
      <SettingsCard title="Your Activity & Analytics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatTile label="Uploads" value={String(stats.uploads || sessionsCount)} />
          <StatTile label="Songs" value={String(stats.musicGenerations || recentTracks.length)} />
          <StatTile label="Quizzes" value={String(stats.quizzesTaken || 0)} />
          <StatTile label="Hours studied" value={hoursStudied.toFixed(1)} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-2">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Study vs Music (last 14 days)</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <ComposedActivity data={activityData} />
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">Activity Breakdown</h4>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={breakdownData} dataKey="value" nameKey="name" outerRadius={80} label>
                    {breakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-50 text-orange-700 px-3 py-1">
          <FaFireAlt /> <span className="text-sm">Study streak: <strong>{streak}</strong> {streak === 1 ? 'day' : 'days'}</span>
        </div>
      </SettingsCard>

      {/* Preferences */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingsCard title="Preferences">
          <div className="space-y-4">
            <ToggleRow label="Auto-download generated music" checked={autoDownload} onChange={setAutoDownload} />
            <ToggleRow label="Enable backup (experimental)" checked={backupEnabled} onChange={setBackupEnabled} />
            <button onClick={clearAppStorage} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 ring-1 ring-slate-300 hover:bg-slate-50">
              Clear local storage
            </button>
          </div>
        </SettingsCard>

        {/* Music & Playback */}
        <SettingsCard title="Music & Playback">
          <div className="space-y-4">
            {/* Volume */}
            <div>
              <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                <span>Volume</span>
                <span>{Math.round(volume)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="mt-2 w-full h-2 bg-gray-200 rounded-full appearance-none accent-blue-500"
              />
            </div>

            {/* Tempo */}
            <div>
              <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                <span>Tempo</span>
                <span>{tempo < 40 ? 'Slow' : tempo > 60 ? 'Fast' : 'Normal'}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={tempo}
                onChange={(e) => setTempo(Number(e.target.value))}
                className="mt-2 w-full h-2 bg-gray-200 rounded-full appearance-none accent-blue-500"
              />
            </div>

            {/* Auto-save */}
            <ToggleRow label="Auto-save generated music" checked={autoSave} onChange={setAutoSave} />
          </div>
        </SettingsCard>
      </div>

      {/* Display & Notes management retained for completeness */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <SettingsCard title="Display">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Segmented options={["Light", "Focus"]} value={displayMode} onChange={setDisplayMode as any} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Text Size</label>
              <div className="flex items-center gap-3">
                <input type="range" min={12} max={22} value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-full appearance-none accent-blue-500" />
                <span className="text-sm text-gray-600 w-10 text-right">{textSize}px</span>
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title="Manage Notes">
          <div className="rounded-lg p-6 border-2 border-dashed border-blue-200 bg-blue-50/50 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-500">
              <FaCloudUploadAlt />
            </div>
            <p className="mt-3 font-medium text-slate-900">Click to upload or drag and drop</p>
            <p className="text-sm text-gray-500">PDF, DOCX, TXT (MAX. 10MB)</p>
          </div>
          <ul className="space-y-3 mt-4">
            {MOCK_FILES.map((f, i) => (
              <li key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <FaFileAlt className="text-gray-600" />
                  <span className="text-sm text-slate-800 truncate">{f.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {f.status === 'summarized' ? (
                    <span className="rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-700">Summarized</span>
                  ) : (
                    <span className="rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700">Processing...</span>
                  )}
                  <button className="p-2 rounded-md hover:bg-gray-100" title="More">
                    <FaEllipsisH />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </SettingsCard>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end mt-6 gap-3">
        <button className="rounded-lg px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm" onClick={() => alert('Settings saved!')}>Save Changes</button>
        <button className="inline-flex items-center gap-2 rounded-lg px-6 py-2 ring-1 ring-red-200 bg-white hover:bg-red-50 text-red-600 font-medium" onClick={handleLogout}><FaSignOutAlt /> Log Out</button>
      </div>
    </main>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-500 transition-colors" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </label>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-black/5 p-4 text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ComposedActivity({ data }: { data: { name: string; study: number; music: number }[] }) {
  return (
    <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="colorStudy" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
        </linearGradient>
        <linearGradient id="colorMusic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name" />
      <YAxis width={30} allowDecimals={false} />
      <Tooltip />
      <Legend />
      <Area type="monotone" dataKey="study" stroke="#3b82f6" fill="url(#colorStudy)" name="Study sessions" />
      <Area type="monotone" dataKey="music" stroke="#10b981" fill="url(#colorMusic)" name="Songs played" />
    </AreaChart>
  );
}

const MOCK_FILES = [
  { name: "Psychology_Chapter_3.pdf", status: "summarized" as const },
  { name: "Biology_Mitochondria_Notes.txt", status: "processing" as const },
];
