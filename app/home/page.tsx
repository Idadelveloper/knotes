"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaCloudUploadAlt, FaInfoCircle, FaClock, FaMusic } from "react-icons/fa";
import { FaBookOpen, FaPenNib } from "react-icons/fa6";
import { HiOutlineX } from "react-icons/hi";
import { extractTextFromFile } from "@/lib/ai";
import { rewriteText, generateTitle } from "@/lib/rewriter";
import { useRequireAuth } from "@/components/useRequireAuth";
import { getStats, getRecentSessions, getRecentTracks, incStat, addRecentSession, type DashboardStats, type RecentSession, type RecentTrack } from "@/lib/stats";
import { createSession } from "@/lib/storage/sessions";
import { stripWrappingCodeFence } from "@/lib/utils/markdown";

export default function HomePage() {
  // Require authentication; redirect to landing if signed out
  const { user: authUser, loading } = useRequireAuth();
  // Auth + Dashboard state
  const [stats, setStatsState] = useState<DashboardStats>({ uploads: 0, studyMinutes: 0, musicGenerations: 0, quizzesTaken: 0 });
  const [recents, setRecents] = useState<RecentSession[]>([]);
  const [tracks, setTracks] = useState<RecentTrack[]>([]);

  // UI state
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const progressIntervalRef = useRef<any>(null);
  const progressCapRef = useRef<number>(0);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Progress helpers
  function startProgressLoop() {
    if (progressIntervalRef.current) return;
    progressIntervalRef.current = setInterval(() => {
      setProgress((p) => {
        const cap = progressCapRef.current || 0;
        if (p >= cap) return p;
        const next = Math.min(p + Math.max(1, Math.round((cap - p) * 0.08)), cap);
        return next;
      });
    }, 200);
  }
  function beginPhase(cap: number, message: string) {
    progressCapRef.current = cap;
    setProgressMessage(message);
    startProgressLoop();
  }
  function resetProgress() {
    try { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); } catch {}
    progressIntervalRef.current = null;
    progressCapRef.current = 0;
    setProgress(0);
    setProgressMessage("");
  }

  // Drag & drop handlers (modal dropzone)
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);
    const files = e.dataTransfer.files;
    if (files && files.length) {
      try {
        setUploading(true);
        setProgress(5);
        beginPhase(60, "Extracting text from document…");
        const text = await extractTextFromFile(files[0]);
        if (text && text.trim().length > 0) {
          beginPhase(90, "Structuring notes…");
          const { text: structured, used } = await rewriteText(text.trim());
          beginPhase(98, "Generating a title…");
          const { title } = await generateTitle(text.trim());
          beginPhase(100, "Finalizing…");
          const sess = createSession(title || "Study Notes", text.trim(), (structured || text).trim());
          addRecentSession({ id: sess.id, title: sess.title, openedAt: new Date().toISOString(), href: `/study/${sess.id}` });
          try { sessionStorage.setItem("knotes_current_session_id", sess.id); } catch {}
          console.log(`[Home] Structured notes via ${used}. Redirecting to /study/${sess.id}.`);
          try { incStat('uploads', 1); setStatsState(getStats()); } catch {}
          setIsModalOpen(false);
          window.location.href = `/study/${sess.id}`;
        } else {
          throw new Error("No text could be extracted from the document.");
        }
      } catch (err: any) {
        console.error(err);
        setUploadError(err?.message || "Failed to analyze the document.");
        resetProgress();
      } finally {
        setUploading(false);
      }
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const triggerFile = () => fileInputRef.current?.click();

  // Hydrate dashboard data
  useEffect(() => {
    try {
      setStatsState(getStats());
      setRecents(getRecentSessions());
      setTracks(getRecentTracks());
    } catch {}
  }, []);

  // Cleanup progress timer on unmount
  useEffect(() => {
    return () => {
      try { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); } catch {}
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModalOpen]);

  // Reset progress when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      resetProgress();
      setUploading(false);
    }
  }, [isModalOpen]);

  const displayName = (authUser?.displayName || authUser?.email || "there") as string;

  const StatCard = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-2xl ring-1 ring-black/5 dark:ring-white/10 bg-white/70 dark:bg-white/5 p-4 flex flex-col gap-1">
      <div className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 dark:text-[--color-accent]">{value}</div>
    </div>
  );

  function minutesToHrs(min: number) {
    const hours = Math.floor(min / 60);
    const rem = min % 60;
    if (hours <= 0) return `${rem}m`;
    if (rem === 0) return `${hours}h`;
    return `${hours}h ${rem}m`;
  }

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
      <div className="mx-auto w-full max-w-6xl px-5 pt-20 pb-24">
        {/* Header: Greeting + Primary Action */}
        <section className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl sm:text-5xl font-semibold leading-tight tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">
                Hello, {displayName.split("@")[0]}
              </h1>
              <p className="mt-2 max-w-2xl text-slate-800 dark:text-slate-600">
                Your AI study hub — organize notes, generate focus music, and quiz yourself, all in one place.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-slate-900 font-medium shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px"
                title="Upload a file or paste your notes to begin."
                aria-describedby="upload-help"
              >
                <FaCloudUploadAlt aria-hidden />
                <span>Start with Notes</span>
              </button>
              <Link
                href="/music"
                className="inline-flex items-center justify-center rounded-full bg-secondary px-6 py-3 font-medium text-slate-900 shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px"
              >
                Explore Music
              </Link>
            </div>
          </div>
          <p id="upload-help" className="mt-3 max-w-2xl text-sm sm:text-base text-slate-700 dark:text-slate-500">
            Drag & drop a .txt, .pdf file — or paste your notes. We’ll generate a personalized, focus-friendly soundtrack for your study session.
          </p>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Uploads" value={stats.uploads} />
          <StatCard label="Study Time" value={minutesToHrs(Math.round(stats.studyMinutes))} />
          <StatCard label="Music Generated" value={stats.musicGenerations} />
          <StatCard label="Quizzes Taken" value={stats.quizzesTaken} />
        </section>

        {/* Recent + Recently Played */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left: Recent Study Sessions */}
          <div>
            <h2 className="text-left text-2xl md:text-3xl font-semibold text-slate-900 dark:text-[--color-accent] mb-4">
              Recent Study Sessions
            </h2>
            {recents.length === 0 ? (
              <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm p-8 text-center text-slate-700 dark:text-slate-500">
                <p className="flex items-center justify-center gap-2 text-base md:text-lg">
                  <FaClock className="text-primary" />
                  No study sessions yet. Start by uploading your first notes!
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {recents.slice(0, 7).map((s) => (
                  <li key={s.id} className="rounded-xl ring-1 ring-black/5 dark:ring-white/10 bg-white/70 dark:bg-white/5 p-4 hover:ring-primary/60 transition">
                    {s.href ? (
                      <Link href={s.href} className="block">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary ring-1 ring-primary/30">
                            <FaClock size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-[--color-accent] line-clamp-1">{s.title}</div>
                            <div className="mt-1 inline-block text-xs px-2 py-1 rounded-full bg-[--color-accent]/80 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10 text-slate-700 dark:text-slate-500">{new Date(s.openedAt).toLocaleString()}</div>
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div className="block">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary ring-1 ring-primary/30">
                            <FaClock size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-[--color-accent] line-clamp-1">{s.title}</div>
                            <div className="mt-1 inline-block text-xs px-2 py-1 rounded-full bg-[--color-accent]/80 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10 text-slate-700 dark:text-slate-500">{new Date(s.openedAt).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right: Recently Played */}
          <div>
            <h2 className="text-left text-2xl md:text-3xl font-semibold text-slate-900 dark:text-[--color-accent] mb-4">
              Recently Played
            </h2>
            {tracks.length === 0 ? (
              <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm p-8 text-center text-slate-700 dark:text-slate-500">
                <p className="flex items-center justify-center gap-2 text-base md:text-lg">
                  <FaMusic className="text-primary" />
                  No music played yet. Generate background sound from your study space!
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {tracks.slice(0, 7).map((t) => (
                  <li key={t.id} className="rounded-xl ring-1 ring-black/5 dark:ring-white/10 bg-white/70 dark:bg-white/5 p-4 hover:ring-primary/60 transition">
                    {t.href ? (
                      <Link href={t.href} className="block">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary/30 text-slate-900 ring-1 ring-secondary/50">
                            <FaMusic size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-[--color-accent] line-clamp-1">{t.title}</div>
                            <div className="mt-1 inline-block text-xs px-2 py-1 rounded-full bg-[--color-accent]/80 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10 text-slate-700 dark:text-slate-500">{new Date(t.playedAt).toLocaleString()}</div>
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div className="block">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary/30 text-slate-900 ring-1 ring-secondary/50">
                            <FaMusic size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-[--color-accent] line-clamp-1">{t.title}</div>
                            <div className="mt-1 inline-block text-xs px-2 py-1 rounded-full bg-[--color-accent]/80 dark:bg-white/10 ring-1 ring-black/5 dark:ring-white/10 text-slate-700 dark:text-slate-500">{new Date(t.playedAt).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Modal: Upload/Paste Notes */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          onClick={(e) => {
            // close on backdrop click
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-accent/95 dark:bg-[--color-dark-bg]/95 ring-1 ring-black/10 dark:ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">Upload or Paste Notes</h3>
              <button
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/5 text-slate-700 dark:text-[--color-accent] hover:bg-white/80"
                onClick={() => setIsModalOpen(false)}
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            {/* Body: two clearly separated sections */}
            <div className="px-6 py-5">
              {uploadError && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{uploadError}</div>
              )}
              {/* Progress display */}
              {uploading && (
                <div className="mb-4 rounded-xl bg-white/80 dark:bg-white/5 p-4 ring-1 ring-black/10 dark:ring-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-slate-700 dark:text-slate-300" aria-live="polite">{progressMessage || "Working…"}</div>
                    <div className="text-sm font-medium text-slate-900 dark:text-[--color-accent]" aria-atomic>{progress}%</div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                    <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File Upload */}
                <section
                  className={`group relative rounded-2xl bg-white/85 dark:bg-white/5 p-5 ring-1 ring-black/10 dark:ring-white/10 transition ${
                    isDragging ? "ring-2 ring-primary shadow-[0_0_0_4px_rgba(139,198,236,0.25)]" : ""
                  }`}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  role="region"
                  aria-label="File upload section"
                  title="Drag & drop a file here or browse files"
                >
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-[--color-accent] mb-2">File upload</h4>
                  <div className="text-center">
                    <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary ring-1 ring-primary/30">
                      <FaCloudUploadAlt size={22} />
                    </div>
                    <p className="mt-3 font-medium text-slate-900">Drag & drop your file</p>
                    <p className="text-xs text-slate-600">PDF or TXT • Max 20MB</p>
                    <div className="mt-4">
                      <button
                        onClick={triggerFile}
                        className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-slate-900 font-medium shadow-[0_4px_0_rgba(0,0,0,0.08)] hover:shadow-[0_6px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px"
                      >
                        Browse Files
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.pdf,application/pdf,text/plain"
                        className="hidden"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (files && files.length) {
                            setUploadError(null);
                            try {
                              setUploading(true);
                              setProgress(5);
                              beginPhase(60, "Extracting text from document…");
                              const text = await extractTextFromFile(files[0]);
                              if (text && text.trim().length > 0) {
                                beginPhase(90, "Structuring notes…");
                                const { text: structured, used } = await rewriteText(text.trim());
                                beginPhase(98, "Generating a title…");
                                const { title } = await generateTitle(text.trim());
                                beginPhase(100, "Finalizing…");
                                const sess = createSession(title || "Study Notes", text.trim(), (structured || text).trim());
                                addRecentSession({ id: sess.id, title: sess.title, openedAt: new Date().toISOString(), href: `/study/${sess.id}` });
                                try { sessionStorage.setItem("knotes_current_session_id", sess.id); } catch {}
                                try { incStat('uploads', 1); setStatsState(getStats()); } catch {}
                                setIsModalOpen(false);
                                window.location.href = `/study/${sess.id}`;
                              } else {
                                throw new Error("No text could be extracted from the document.");
                              }
                            } catch (err: any) {
                              console.error(err);
                              setUploadError(err?.message || "Failed to analyze the document.");
                              resetProgress();
                            } finally {
                              setUploading(false);
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="mt-2 inline-flex items-center gap-2 justify-center text-xs text-slate-500 dark:text-slate-400">
                      <FaInfoCircle aria-hidden />
                      <span>We process locally when possible for privacy.</span>
                    </div>
                  </div>
                </section>

                {/* Paste Notes */}
                <section className="rounded-2xl bg-white/85 dark:bg-white/5 p-5 ring-1 ring-black/10 dark:ring-white/10">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-[--color-accent] mb-2">Paste notes</h4>
                  <label htmlFor="notes" className="sr-only">Paste your notes</label>
                  <textarea
                    id="notes"
                    rows={10}
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className="w-full resize-y rounded-xl bg-white/80 dark:bg-white/5 text-slate-900 dark:text-[--color-accent] placeholder:text-slate-500 dark:placeholder:text-slate-400 p-3 ring-1 ring-black/10 dark:ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Paste your notes or write here…"
                    aria-label="Paste notes textarea"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      disabled={uploading}
                      className="inline-flex items-center justify-center rounded-full bg-secondary px-5 py-2 text-slate-900 font-medium shadow-[0_4px_0_rgba(0,0,0,0.08)] hover:shadow-[0_6px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px disabled:opacity-60"
                      onClick={async () => {
                        setUploadError(null);
                        const text = notesText.trim();
                        if (text.length === 0) {
                          setUploadError("Please paste some notes or upload a file.");
                          return;
                        }
                        try {
                          setUploading(true);
                          setProgress(10);
                          beginPhase(85, "Structuring notes…");
                          const { text: structured, used } = await rewriteText(text);
                          beginPhase(98, "Generating a title…");
                          const { title } = await generateTitle(text);
                          beginPhase(100, "Finalizing…");
                          const sess = createSession(title || "Study Notes", text, (structured || text).trim());
                          addRecentSession({ id: sess.id, title: sess.title, openedAt: new Date().toISOString(), href: `/study/${sess.id}` });
                          try { sessionStorage.setItem("knotes_current_session_id", sess.id); } catch {}
                          console.log(`[Home] Structured pasted notes via ${used}. Redirecting to /study/${sess.id}.`);
                          setIsModalOpen(false);
                          window.location.href = `/study/${sess.id}`;
                        } catch (err: any) {
                          console.error(err);
                          setUploadError(err?.message || "Failed to process notes.");
                          resetProgress();
                        } finally {
                          setUploading(false);
                        }
                      }}
                    >
                      {uploading ? "Processing…" : "Start Studying"}
                    </button>
                  </div>
                </section>
              </div>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}
