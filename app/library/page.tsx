"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { listSessions } from "@/lib/storage/sessions";

export default function LibraryPage() {
  const params = useSearchParams();
  const router = useRouter();
  const intent = (params?.get("intent") || "").toLowerCase(); // study | music | ''
  const [sessions, setSessions] = useState<{ id: string; title: string; createdAt: string }[]>([]);

  useEffect(() => {
    try {
      setSessions(listSessions());
    } catch {}
  }, []);

  const empty = sessions.length === 0;

  const handleSelect = (id: string) => {
    try { sessionStorage.setItem("knotes_current_session_id", id); } catch {}
    if (intent === "music") {
      router.push(`/music/${id}`);
    } else if (intent === "study") {
      router.push(`/study/${id}`);
    } else {
      // default: go to study if intent not specified
      router.push(`/study/${id}`);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-24 pb-16">
      <h1 className="text-3xl font-semibold text-slate-900  mb-6">Library</h1>
      <p className="text-slate-700  mb-8">
        {intent === "music"
          ? "Select a study upload to generate music for."
          : intent === "study"
          ? "Select a study upload to open in the workspace."
          : "Select one of your uploads to continue."}
      </p>

      {empty ? (
        <div className="rounded-2xl border border-black/5  bg-white/70  p-8 text-center">
          <p className="text-slate-700 ">No uploads yet.</p>
          <div className="mt-4">
            <Link href="/home" className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-slate-900 font-medium shadow-[0_4px_0_rgba(0,0,0,0.08)] hover:shadow-[0_6px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px">
              Upload or Paste Notes
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-xl ring-1 ring-black/5 bg-white/70  p-4 hover:ring-primary/60 transition flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900  line-clamp-1">{s.title}</div>
                <div className="text-xs text-slate-500 ">{new Date(s.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleSelect(s.id)} className="inline-flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-slate-900">Select</button>
                <Link href={`/study/${s.id}`} className="text-sm text-primary hover:underline">Open</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
