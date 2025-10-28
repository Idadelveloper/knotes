"use client";

import { FaBrain, FaVolumeUp, FaSearch } from "react-icons/fa";

export type HighlightToolbarProps = {
  visible: boolean;
  x: number;
  y: number;
  onExplain: () => void;
  onRead: () => void;
  onSearch: () => void;
};

export default function HighlightToolbar({ visible, x, y, onExplain, onRead, onSearch }: HighlightToolbarProps) {
  if (!visible) return null;
  return (
    <div
      role="toolbar"
      aria-label="AI popup actions"
      className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl backdrop-blur-md bg-white/80  border border-black/10  shadow-lg px-2 py-1 flex items-center gap-1"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <button
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-800  hover:bg-black/5  text-xs"
        title="Explain"
        onClick={onExplain}
      >
        <FaBrain /> <span className="hidden sm:inline">Explain</span>
      </button>
      <button
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-800  hover:bg-black/5  text-xs"
        title="Read"
        onClick={onRead}
      >
        <FaVolumeUp /> <span className="hidden sm:inline">Read</span>
      </button>
      <button
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-800  hover:bg-black/5  text-xs"
        title="Search More Info"
        onClick={onSearch}
      >
        <FaSearch /> <span className="hidden sm:inline">Search</span>
      </button>
    </div>
  );
}
