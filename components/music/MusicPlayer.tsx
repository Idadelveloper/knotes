'use client'

import { useEffect, useRef, useState } from 'react';
import { PlaybackState } from '@/lib/types/music';

interface MusicPlayerProps {
  trackTitle: string;
  playbackState: PlaybackState;
  isGenerating: boolean;
  audioUrl?: string;
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
  audioUrl,
  onPlayPause,
  onStop,
  onTweakSettings,
  onRegenerate,
  onDownload,
}: MusicPlayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [volume, setVolume] = useState(1);

  // Sync audio element playback with playbackState
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioUrl) return;

    if (isGenerating) {
      // pause while generating
      audio.pause();
      return;
    }

    if (playbackState === 'playing') {
      audio.play().catch(() => {/* ignore autoplay errors */});
    } else if (playbackState === 'paused' || playbackState === 'stopped') {
      audio.pause();
      if (playbackState === 'stopped') {
        audio.currentTime = 0;
      }
    }
  }, [playbackState, isGenerating, audioUrl]);

  // Update elapsed time from audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setElapsedTime(Math.floor(audio.currentTime));
    const onEnded = () => {
      setElapsedTime(0);
      // Notify parent that playback stopped
      // Parent will set playbackState to 'stopped'
      try { onStop(); } catch {}
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, [onStop, audioUrl]);

  // Apply volume
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

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

  const statusText = isGenerating ? 'Composing...' : trackTitle || 'Ready';

  if (isMinimized) {
    return (
      <>
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center transform hover:scale-110 transition-all"
          title="Show Music Player"
        >
          {/* Show Icon */}
        </button>
        {/* Floating Settings Button */}
        <button
          onClick={onTweakSettings}
          className="fixed bottom-6 left-6 z-50 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-purple-700 transition-colors"
          title="Adjust music settings"
          aria-label="Adjust music settings"
        >
          {/* Settings Icon */}
        </button>
      </>
    );
  }

  return (
    <>
      {/* Hidden/inline audio element that actually plays the track */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="auto" />
      )}

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
              <button onClick={onPlayPause} className="w-16 h-16 flex items-center justify-center" disabled={!audioUrl || isGenerating}>
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
                  <input
                    type="range"
                    className="w-full accent-purple-600"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    aria-label="Volume"
                  />
              </div>
              <button onClick={onTweakSettings} title="Tweak Settings" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                  {/* Settings Icon */}
              </button>
              <button
                onClick={() => {
                  if (!audioUrl) return;
                  try {
                    onDownload();
                  } catch {}
                  const a = document.createElement('a');
                  a.href = audioUrl;
                  a.download = (trackTitle || 'study-music') + '.mp3';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
                title="Download Track"
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                disabled={!audioUrl}
              >
                  {/* Download Icon */}
              </button>
              <button onClick={() => setIsMinimized(true)} title="Hide Player" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                  {/* Hide Icon */}
              </button>
          </div>
        </div>
      </div>

      {/* Floating Settings Button */}
      <button
        onClick={onTweakSettings}
        className="fixed bottom-6 left-6 z-50 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-purple-700 transition-colors"
        title="Adjust music settings"
        aria-label="Adjust music settings"
      >
        {/* Settings Icon */}
      </button>
    </>
  );
};

export default MusicPlayer;
