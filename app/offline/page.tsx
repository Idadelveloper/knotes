"use client";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">You are offline</h1>
      <p className="text-slate-600 dark:text-slate-300 max-w-prose">
        Knotes works as a Progressive Web App. Some features may be unavailable without internet. You can still open previously visited pages and your saved sessions.
      </p>
      <div className="flex gap-3">
        <Link className="px-4 py-2 rounded-lg ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10" href="/">Go to Home</Link>
        <Link className="px-4 py-2 rounded-lg ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10" href="/study">Open Study</Link>
      </div>
    </main>
  );
}
