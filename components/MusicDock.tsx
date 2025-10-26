"use client";

import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaChartBar } from "react-icons/fa";

export type MusicDockProps = {
  isPlaying: boolean;
  volume: number;
  genre: string;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVolume: (v: number) => void;
  onGenre: (g: string) => void;
  onRegen?: () => void; // kept for future extensibility
  onDownload?: () => void; // kept for future extensibility
  onConvert: () => void;
};

export default function MusicDock({
  isPlaying,
  volume,
  genre,
  onPlayPause,
  onPrev,
  onNext,
  onVolume,
  onGenre,
  onConvert,
}: MusicDockProps) {
  return (
    <div className="fixed bottom-4 inset-x-4 z-40">
      <div className="mx-auto w-full max-w-7xl">
        <div className="backdrop-blur-md bg-white/70 border border-gray-200/50 rounded-lg shadow-md p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Album + Info */}
            <div className="flex items-center gap-3 min-w-[220px]">
              <img src="/images/logo.png" alt="Album art" className="h-12 w-12 rounded-md object-cover ring-1 ring-black/10" />
              <div>
                <div className="font-medium text-slate-900">Lo-fi Focus Beats</div>
                <div className="text-sm text-gray-600">AI Generated</div>
              </div>
            </div>

            {/* Center: Controls + Visualizer */}
            <div className="flex-1 flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                <button className="h-10 w-10 inline-flex items-center justify-center rounded-full ring-1 ring-black/10 hover:bg-black/5" onClick={onPrev} aria-label="Replay">
                  <FaStepBackward />
                </button>
                <button className="h-12 w-12 inline-flex items-center justify-center rounded-full bg-primary text-slate-900 shadow" onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <FaPause /> : <FaPlay />}
                </button>
                <button className="h-10 w-10 inline-flex items-center justify-center rounded-full ring-1 ring-black/10 hover:bg-black/5" onClick={onNext} aria-label="Skip">
                  <FaStepForward />
                </button>
                {/* Volume */}
                <div className="ml-2 hidden sm:flex items-center gap-2 text-slate-700">
                  <FaVolumeUp />
                  <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolume(parseFloat((e.target as HTMLInputElement).value))} className="accent-primary" />
                </div>
              </div>
              <div className="relative h-10 w-full max-w-xl">
                <div className="absolute inset-0 flex items-end gap-1 overflow-hidden">
                  {new Array(40).fill(0).map((_, i) => (
                    <span
                      key={i}
                      className="w-1 rounded-t bg-primary/70 animate-[wave_1.6s_ease-in-out_infinite]"
                      style={{ height: `${Math.max(2, (i % 7) * 4 + 6)}px`, animationDelay: `${(i % 10) * 0.08}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Genre + Actions */}
            <div className="flex flex-col items-stretch md:items-end gap-2 min-w-[280px]">
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <FaChartBar className="text-slate-700" />
                <select
                  id="genre"
                  className="rounded-lg px-3 py-2 text-sm bg-white/70 ring-1 ring-black/10 text-slate-800"
                  value={genre}
                  onChange={(e) => onGenre((e.target as HTMLSelectElement).value)}
                >
                  {['Lo-fi','Classical','Jazz','Nature','Chill Piano','Ambient'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <button className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm bg-blue-500 text-white" onClick={onConvert} title="Convert your notes into music">
                  Convert...
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* keyframes for visualizer */}
      <style>{`@keyframes wave { 0%, 100% { transform: scaleY(0.6); } 50% { transform: scaleY(1.4); } }`}</style>
    </div>
  );
}
