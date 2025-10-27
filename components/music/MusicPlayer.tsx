'use client'

import { useEffect, useRef, useState } from 'react';
import { PlaybackState } from '@/lib/types/music';

interface MusicPlayerProps {
  trackTitle: string;
  playbackState: PlaybackState;
  isGenerating: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onTweakSettings: () => void;
  onRegenerate: () => void;
  onDownload: () => void;
}

const MusicPlayer = ({
  trackTitle,
  playbackState,
  isGenerating,
  onPlayPause,
  onTweakSettings,
  onRegenerate,
  onDownload,
}: MusicPlayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (playbackState === 'playing') {
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [playbackState]);

  useEffect(() => {
    if (playbackState === 'stopped') {
      setElapsedTime(0);
    }
  }, [playbackState]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = (time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const statusText = isGenerating ? 'Composing...' : trackTitle;
  const effectivePlaybackState = isGenerating ? 'loading' : playbackState;

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center transform hover:scale-110 transition-all"
        title="Show Music Player"
      >
        {/* Show Icon */}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[clamp(320px,90vw,800px)] h-20 bg-gray-800/70 backdrop-blur-xl rounded-lg border border-white/10 shadow-2xl flex flex-col overflow-hidden">
      <canvas ref={canvasRef} className="absolute top-[-5px] left-0 w-full h-[30px] opacity-50" width="1000" height="40"></canvas>
      <div className="flex-grow px-4 grid grid-cols-[1fr,1.5fr,1fr] items-center gap-4 w-full">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 bg-white/10 rounded-md flex items-center justify-center shrink-0">
            {/* Music Icon */}
          </div>
          <div className="truncate">
            <div className="font-medium text-base truncate">{statusText}</div>
          </div>
        </div>

        <div className="flex justify-center items-center gap-4">
            <button onClick={onRegenerate} title="Regenerate (Previous)" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                {/* Previous Icon */}
            </button>
            <button onClick={onPlayPause} className="w-16 h-16 flex items-center justify-center">
                {/* Play/Pause Icon */}
            </button>
            <button onClick={onRegenerate} title="Regenerate (Next)" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                {/* Next Icon */}
            </button>
        </div>

        <div className="flex justify-end items-center gap-4">
            <div className="font-mono text-sm text-gray-400">{formatTime(elapsedTime)}</div>
            <div className="flex items-center gap-2 w-32">
                {/* Volume Icon */}
                <input type="range" className="w-full accent-purple-600" min="0" max="1" step="0.01" defaultValue="1" />
            </div>
            <button onClick={onTweakSettings} title="Tweak Settings" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                {/* Settings Icon */}
            </button>
            <button onClick={onDownload} title="Download Track" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                {/* Download Icon */}
            </button>
            <button onClick={() => setIsMinimized(true)} title="Hide Player" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                {/* Hide Icon */}
            </button>
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
