import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full bg-transparent">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 border-t border-slate-200">
        {/* Links row */}
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-700">
          <Link href="#" className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1">
            Privacy
          </Link>
          <span className="text-slate-400 select-none">|</span>
          <Link href="#" className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1">
            Terms
          </Link>
          <span className="text-slate-400 select-none">|</span>
          <Link href="#" className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1">
            About Knotes
          </Link>
          <span className="text-slate-400 select-none">|</span>
          <a href="mailto:hello@knotes.app" className="hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded px-1">
            Feedback
          </a>
        </nav>

        {/* Copyright line */}
        <p className="mt-3 text-center text-xs text-slate-500">
          © {year || 2025} Knotes — Built with Chrome Built-in AI
        </p>
      </div>
    </footer>
  );
}
