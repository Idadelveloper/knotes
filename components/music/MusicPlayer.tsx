'use client'

import { useCallback, useEffect, useRef, useState } from 'react';
import { PlaybackState } from '@/lib/types/music';
import { BsFillPlayFill, BsFillPauseFill, BsFillRewindFill, BsFillFastForwardFill, BsMusicNoteBeamed, BsDownload, BsGear, BsChevronDown } from 'react-icons/bs';

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
  const progressRef = useRef<HTMLInputElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [duration, setDuration] = useState(0);
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

  // Duration when metadata is loaded
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => {
      const sec = audio.duration || 0;
      setDuration(Math.floor(sec));
      if (progressRef.current) {
        progressRef.current.max = Math.floor(sec).toString();
      }
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => audio.removeEventListener('loadedmetadata', onLoaded);
  }, [audioUrl]);

  // Update elapsed time from audio element (event-based)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setElapsedTime(Math.floor(audio.currentTime));
    const onEnded = () => {
      setElapsedTime(0);
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
      if (progressRef.current) {
        progressRef.current.value = '0';
        progressRef.current.style.setProperty('--range-progress', '0%');
      }
    }
  }, [playbackState]);

  const formatTime = (time: number) => {
    if (!Number.isFinite(time)) return '00:00';
    const minutes = Math.floor(time / 60).toString().padStart(2, '0');
    const seconds = Math.floor(time % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !duration) return;
    const ct = audio.currentTime;
    setElapsedTime(Math.floor(ct));
    bar.value = Math.floor(ct).toString();
    bar.style.setProperty('--range-progress', `${(ct / duration) * 100}%`);
  }, [duration]);

  const startRaf = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      updateProgress();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [updateProgress]);

  useEffect(() => {
    if (playbackState === 'playing') {
      startRaf();
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      updateProgress();
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playbackState, startRaf, updateProgress]);

  const handleSeek = (value?: number) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar) return;
    const newTime = value ?? Number(bar.value);
    audio.currentTime = newTime;
    setElapsedTime(Math.floor(newTime));
    if (duration)
      bar.style.setProperty('--range-progress', `${(newTime / duration) * 100}%`);
  };

  const skipBy = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min((duration || 0), audio.currentTime + delta));
    updateProgress();
  };

  const statusText = isGenerating ? 'Composing...' : trackTitle || 'Ready';

  if (isMinimized) {
    return (
      <>
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center transform hover:scale-110 transition-all"
          title="Show Music Player"
          aria-label="Show Music Player"
        >
          <BsMusicNoteBeamed size={24} />
        </button>
        {/* Floating Settings Button (hidden while playing) */}
        {playbackState !== 'playing' && (
          <button
            onClick={onTweakSettings}
            className="fixed bottom-6 left-6 z-50 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-purple-700 transition-colors"
            title="Adjust music settings"
            aria-label="Adjust music settings"
          >
            <BsGear />
          </button>
        )}
      </>
    );
  }

  const volumePct = Math.round(volume * 100);

  return (
    <>
      {/* Hidden/inline audio element that actually plays the track */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="auto" />
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[clamp(320px,90vw,900px)] bg-gray-900/50 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <canvas ref={canvasRef} className="absolute top-[-5px] left-0 w-full h-[30px] opacity-50" width="1000" height="40"></canvas>

        {/* Top row: track + controls + right tools */}
        <div className="px-4 py-3 grid grid-cols-[1fr,1.2fr,1fr] items-center gap-4 w-full">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 bg-white/10 rounded-md flex items-center justify-center shrink-0 text-white/80">
              <BsMusicNoteBeamed />
            </div>
            <div className="truncate">
              <div className="font-medium text-base truncate">{statusText}</div>
            </div>
          </div>

          <div className="flex justify-center items-center gap-4">
            <button onClick={() => skipBy(-15)} title="Rewind 15s" aria-label="Rewind 15 seconds" className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <BsFillRewindFill size={20} />
            </button>
            <button onClick={onPlayPause} className="w-12 h-12 rounded-full bg-white text-gray-900 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50" disabled={!audioUrl || isGenerating} aria-label={playbackState === 'playing' ? 'Pause' : 'Play'}>
              {playbackState === 'playing' ? <BsFillPauseFill size={24} /> : <BsFillPlayFill size={24} />}
            </button>
            <button onClick={() => skipBy(15)} title="Forward 15s" aria-label="Forward 15 seconds" className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <BsFillFastForwardFill size={20} />
            </button>
            <button onClick={onRegenerate} title="Regenerate" aria-label="Regenerate" className="p-2 rounded-full hover:bg-white/10 transition-colors">
              {/* reuse regenerate as extra action */}
              <BsChevronDown style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>

          <div className="flex justify-end items-center gap-4">
            <div className="font-mono text-sm text-gray-300" aria-live="polite">{formatTime(elapsedTime)} / {formatTime(duration)}</div>
            <div className="flex items-center gap-2 w-36">
              {/* simple volume */}
              <input
                type="range"
                className="w-full h-2 rounded-full appearance-none bg-transparent"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Volume"
                style={{
                  background: `linear-gradient(to right, #a855f7 ${volumePct}%, #4b5563 ${volumePct}%)`,
                  height: '6px',
                  borderRadius: '9999px'
                }}
              />
            </div>
            <button onClick={onTweakSettings} title="Tweak Settings" aria-label="Tweak Settings" className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <BsGear />
            </button>
            <button
              onClick={() => {
                if (!audioUrl) return;
                try { onDownload(); } catch {}
                const a = document.createElement('a');
                a.href = audioUrl;
                a.download = (trackTitle || 'study-music') + '.mp3';
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
              title="Download Track"
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
              disabled={!audioUrl}
              aria-label="Download"
            >
              <BsDownload />
            </button>
            <button onClick={() => setIsMinimized(true)} title="Hide Player" aria-label="Hide Player" className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <BsChevronDown />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-3 w-full">
            <span className="text-xs font-mono text-gray-400 w-12 text-right">{formatTime(elapsedTime)}</span>
            <input
              ref={progressRef}
              type="range"
              defaultValue="0"
              onChange={() => handleSeek()}
              className="w-full h-2 rounded-full appearance-none bg-transparent"
              aria-label="Seek"
              style={{
                // use the same custom property approach as tutorial
                background: 'linear-gradient(to right, #a855f7 var(--range-progress), #4b5563 var(--range-progress))',
                height: '6px',
                borderRadius: '9999px'
              }}
            />
            <span className="text-xs font-mono text-gray-400 w-12">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Floating Settings Button (hidden while playing) */}
      {playbackState !== 'playing' && (
        <button
          onClick={onTweakSettings}
          className="fixed bottom-6 left-6 z-50 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-purple-700 transition-colors"
          title="Adjust music settings"
          aria-label="Adjust music settings"
        >
          <BsGear />
        </button>
      )}
    </>
  );
};

export default MusicPlayer;
