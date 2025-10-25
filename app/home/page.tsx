"use client";

import { useEffect, useRef, useState } from "react";
import { FaCloudUploadAlt, FaInfoCircle, FaClock } from "react-icons/fa";
import { HiOutlineX } from "react-icons/hi";

export default function HomePage() {
  // UI state
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notesText, setNotesText] = useState("");

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Placeholder for sessions (empty for now)
  const [sessions] = useState<Array<{ id: string; title: string; date: string }>>([]);

  // Drag & drop handlers (modal dropzone)
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length) {
      console.log("Dropped files", files);
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

  // Close on Escape
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isModalOpen]);

  return (
    <main className="relative w-full min-h-screen">
      {/* Page container */}
      <div className="mx-auto w-full max-w-6xl px-5 pt-20 pb-24">
        {/* Header */}
        <section className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-slate-900 dark:text-[--color-accent]">
            Study smarter, not harder — with rhythm.
          </h1>
          <p className="mt-4 text-base sm:text-lg max-w-3xl mx-auto text-slate-700 dark:text-slate-300">
            Combine AI study tools with curated music to enhance your focus and learning.
          </p>
        </section>

        {/* Primary action */}
        <section className="flex flex-col items-center justify-center text-center">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-4 text-slate-900 font-medium shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px"
            title="Upload a file or paste your notes to begin."
            aria-describedby="upload-help"
          >
            📄 Upload/Paste Notes
          </button>
          <p id="upload-help" className="mt-3 max-w-2xl text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Drag & drop a .txt, .pdf, or .docx file — or paste your notes. We’ll generate a personalized, focus-friendly soundtrack for your study session.
          </p>
        </section>

        {/* Recent Sessions */}
        <section className="mt-20">
          <h2 className="text-center text-2xl md:text-3xl font-semibold text-slate-900 dark:text-[--color-accent] mb-4">
            Recent Study Sessions
          </h2>

          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm p-8 text-center text-slate-700 dark:text-slate-300">
              <p className="flex items-center justify-center gap-2 text-base md:text-lg">
                <FaClock className="text-primary" />
                No sessions yet. Start by uploading your first notes!
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-xl ring-1 ring-black/5 dark:ring-white/10 bg-white/70 dark:bg-white/5 p-4 hover:ring-primary/60">
                  <button className="text-left w-full">
                    <div className="font-medium text-slate-900 dark:text-[--color-accent]">{s.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{s.date}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
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

            {/* Body: two vertical sections */}
            <div className="px-6 py-5 space-y-4">
              {/* Drag & drop upload */}
              <div
                className={`group relative rounded-2xl bg-white/80 dark:bg-white/5 p-5 ring-1 ring-black/10 dark:ring-white/10 text-center transition ${
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
                <p className="mt-3 font-medium text-slate-900 dark:text-[--color-accent]">Drag & drop your file here</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">.txt, .pdf, .docx</p>
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
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length) {
                        console.log("Selected files", files);
                      }
                    }}
                  />
                </div>
                <div className="mt-2 inline-flex items-center gap-2 justify-center text-xs text-slate-500 dark:text-slate-400">
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
                  className="w-full resize-y rounded-2xl bg-white/80 dark:bg-white/5 text-slate-900 dark:text-[--color-accent] placeholder:text-slate-500 dark:placeholder:text-slate-400 p-4 ring-1 ring-black/10 dark:ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Paste your notes or write here…"
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6">
              <button
                className="w-full inline-flex items-center justify-center rounded-full bg-secondary px-6 py-3 text-slate-900 font-medium shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px"
                onClick={() => {
                  console.log("Start Studying clicked", { notesText });
                  setIsModalOpen(false);
                  window.location.href = "/study";
                }}
              >
                Start Studying
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
