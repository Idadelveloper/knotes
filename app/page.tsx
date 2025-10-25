import { FaMusic, FaWandMagicSparkles } from "react-icons/fa6";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-accent dark:bg-[--color-dark-bg]">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-10 px-6 py-24 text-center sm:text-left">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-primary/25 dark:text-[--color-accent]">
          <FaWandMagicSparkles className="text-primary" />
          Meet Knotes — Focus without leaving the tab
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-slate-900 dark:text-[--color-accent] sm:text-5xl">
          Read, understand, and even sing your notes.
        </h1>
        <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          AI explanations, summaries, translations, soothing background music, and
          catchy study songs — private, fast, and offline‑resilient.
        </p>

        <div className="mt-4 flex w-full flex-col items-center gap-4 sm:flex-row">
          <a
            href="#"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-slate-900 shadow-[0_6px_0_rgba(0,0,0,0.08)] transition hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px active:shadow-[0_5px_0_rgba(0,0,0,0.1)]"
          >
            <FaMusic /> Start with music
          </a>
          <a
            href="#"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-6 py-3 text-slate-900 shadow-[0_6px_0_rgba(0,0,0,0.08)] transition hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px active:shadow-[0_5px_0_rgba(0,0,0,0.1)]"
          >
            <FaWandMagicSparkles /> Explain my notes
          </a>
        </div>
      </main>
    </div>
  );
}
