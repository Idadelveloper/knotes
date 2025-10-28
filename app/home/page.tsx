"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FaCloudUploadAlt, FaInfoCircle, FaClock, FaMusic } from "react-icons/fa";
import { HiOutlineX } from "react-icons/hi";
import { extractTextFromFile } from "@/lib/ai";
import { rewriteText, generateTitle } from "@/lib/rewriter";
import { useAuth } from "@/components/AuthProvider";
import { getStats, getRecentSessions, getRecentTracks, incStat, addRecentSession, type DashboardStats, type RecentSession, type RecentTrack } from "@/lib/stats";
import { createSession } from "@/lib/storage/sessions";

export default function HomePage() {
  // Auth + Dashboard state
  const { user } = useAuth();
  const [stats, setStatsState] = useState<DashboardStats>({ uploads: 0, studyMinutes: 0, musicGenerations: 0, quizzesTaken: 0 });
  const [recents, setRecents] = useState<RecentSession[]>([]);
  const [tracks, setTracks] = useState<RecentTrack[]>([]);

  // UI state
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag & drop handlers (modal dropzone)
  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);
    const files = e.dataTransfer.files;
    if (files && files.length) {
      try {
        setUploading(true);
        const text = await extractTextFromFile(files[0]);
        if (text && text.trim().length > 0) {
          // Post-process with Chrome Rewriter (or Gemini fallback) to structure notes
          const { text: structured, used } = await rewriteText(text.trim());
          const { title } = await generateTitle(text.trim());
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

  // Close on Escape
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModalOpen]);

  const displayName = (user?.displayName || user?.email || "there") as string;

  const StatCard = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-2xl ring-1 ring-black/5  bg-white/70  p-4 flex flex-col gap-1">
      <div className="text-xs uppercase tracking-wide text-slate-500 ">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 ">{value}</div>
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
    <main className="relative w-full min-h-screen">
      {/* Page container */}
      <div className="mx-auto w-full max-w-6xl px-5 pt-20 pb-24">
        {/* Header: Greeting + Primary Action */}
        <section className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 ">
                Hello, {displayName.split("@")[0]}
              </h1>
              <p className="mt-2 text-slate-700">
                Welcome back. Here’s a quick look at your study activity.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-slate-900 font-medium shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px"
                title="Upload a file or paste your notes to begin."
                aria-describedby="upload-help"
              >
                📄 Upload/Paste Notes
              </button>
            </div>
          </div>
          <p id="upload-help" className="mt-3 max-w-2xl text-sm sm:text-base text-slate-600 ">
            Drag & drop a .txt, .pdf, or .docx file — or paste your notes. We’ll generate a personalized, focus-friendly soundtrack for your study session.
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
            <h2 className="text-left text-2xl md:text-3xl font-semibold text-slate-900  mb-4">
              Recent Study Sessions
            </h2>
            {recents.length === 0 ? (
              <div className="rounded-2xl border border-black/5 bg-white/60  backdrop-blur-sm p-8 text-center text-slate-700 ">
                <p className="flex items-center justify-center gap-2 text-base md:text-lg">
                  <FaClock className="text-primary" />
                  No study sessions yet. Start by uploading your first notes!
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {recents.slice(0, 7).map((s) => (
                  <li key={s.id} className="rounded-xl ring-1 ring-black/5  bg-white/70 p-4 hover:ring-primary/60 transition">
                    {s.href ? (
                      <Link href={s.href} className="block">
                        <div className="font-medium text-slate-900  line-clamp-1">{s.title}</div>
                        <div className="text-xs text-slate-500 ">{new Date(s.openedAt).toLocaleString()}</div>
                      </Link>
                    ) : (
                      <div className="block">
                        <div className="font-medium text-slate-900  line-clamp-1">{s.title}</div>
                        <div className="text-xs text-slate-500 ">{new Date(s.openedAt).toLocaleString()}</div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right: Recently Played */}
          <div>
            <h2 className="text-left text-2xl md:text-3xl font-semibold text-slate-900  mb-4">
              Recently Played
            </h2>
            {tracks.length === 0 ? (
              <div className="rounded-2xl border border-black/5  bg-white/60  backdrop-blur-sm p-8 text-center text-slate-700 ">
                <p className="flex items-center justify-center gap-2 text-base md:text-lg">
                  <FaMusic className="text-primary" />
                  No music played yet. Generate background sound from your study space!
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {tracks.slice(0, 7).map((t) => (
                  <li key={t.id} className="rounded-xl ring-1 ring-black/5  bg-white/70 p-4 hover:ring-primary/60 transition">
                    {t.href ? (
                      <Link href={t.href} className="block">
                        <div className="font-medium text-slate-900  line-clamp-1">{t.title}</div>
                        <div className="text-xs text-slate-500 ">{new Date(t.playedAt).toLocaleString()}</div>
                      </Link>
                    ) : (
                      <div className="block">
                        <div className="font-medium text-slate-900  line-clamp-1">{t.title}</div>
                        <div className="text-xs text-slate-500 ">{new Date(t.playedAt).toLocaleString()}</div>
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
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-accent/95  ring-1 ring-black/10  shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 ">
              <h3 className="text-lg font-semibold text-slate-900 ">Upload or Paste Notes</h3>
              <button
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-black/10  bg-white/70 text-slate-700  hover:bg-white/80"
                onClick={() => setIsModalOpen(false)}
              >
                <HiOutlineX size={18} />
              </button>
            </div>

            {/* Body: two vertical sections */}
            <div className="px-6 py-5 space-y-4">
              {uploadError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{uploadError}</div>
              )}
              {/* Drag & drop upload */}
              <div
                className={`group relative rounded-2xl bg-white/80  p-5 ring-1 ring-black/10 dtext-center transition ${
                  isDragging ? "ring-2 ring-primary shadow-[0_0_0_4px_rgba(139,198,236,0.25)]" : ""
                }`}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                role="region"
                aria-label="Upload notes dropzone"
                title="Drag & drop notes here or browse files"
              >
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary ring-1 ring-primary/30">
                  <FaCloudUploadAlt size={22} />
                </div>
                <p className="mt-3 font-medium text-slate-900 ">Drag & drop your file here</p>
                <p className="text-sm text-slate-600 ">.txt, .pdf, .docx</p>
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
                    accept=".txt,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (files && files.length) {
                        setUploadError(null);
                        try {
                          setUploading(true);
                          const text = await extractTextFromFile(files[0]);
                          if (text && text.trim().length > 0) {
                            const { text: structured, used } = await rewriteText(text.trim());
                            const { title } = await generateTitle(text.trim());
                            // Create persistent session with original+structured notes
                            const sess = createSession(title || "Study Notes", text.trim(), (structured || text).trim());
                            // Update recents with direct link
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
                        } finally {
                          setUploading(false);
                        }
                      }
                    }}
                  />
                </div>
                <div className="mt-2 inline-flex items-center gap-2 justify-center text-xs text-slate-500 ">
                  <FaInfoCircle aria-hidden />
                  <span>We process locally when possible for privacy.</span>
                </div>
              </div>

              {/* Paste textarea */}
              <div>
                <label htmlFor="notes" className="sr-only">Paste your notes</label>
                <textarea
                  id="notes"
                  rows={8}
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  className="w-full resize-y rounded-2xl bg-white/80  text-slate-900  placeholder:text-slate-500  p-4 ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Paste your notes or write here…"
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6">
              <button
                disabled={uploading}
                className="w-full inline-flex items-center justify-center rounded-full bg-secondary px-6 py-3 text-slate-900 font-medium shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px disabled:opacity-60"
                onClick={async () => {
                  setUploadError(null);
                  const text = notesText.trim();
                  if (text.length === 0) {
                    setUploadError("Please paste some notes or upload a file.");
                    return;
                  }
                  try {
                    setUploading(true);
                    const { text: structured, used } = await rewriteText(text);
                    const { title } = await generateTitle(text);
                    const sess = createSession(title || "Study Notes", text, (structured || text).trim());
                    addRecentSession({ id: sess.id, title: sess.title, openedAt: new Date().toISOString(), href: `/study/${sess.id}` });
                    try { sessionStorage.setItem("knotes_current_session_id", sess.id); } catch {}
                    console.log(`[Home] Structured pasted notes via ${used}. Redirecting to /study/${sess.id}.`);
                    setIsModalOpen(false);
                    window.location.href = `/study/${sess.id}`;
                  } catch (err: any) {
                    console.error(err);
                    setUploadError(err?.message || "Failed to process notes.");
                  } finally {
                    setUploading(false);
                  }
                }}
              >
                {uploading ? "Processing…" : "Start Studying"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
