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
  const wavePhaseRef = useRef<number>(0);

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

  const drawWaves = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cssWidth = canvas.clientWidth || 0;
    const cssHeight = canvas.clientHeight || 0;
    if (canvas.width !== Math.floor(cssWidth * dpr) || canvas.height !== Math.floor(cssHeight * dpr)) {
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // fade previous frame for a soft trail
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, w, h);

    const baseAlpha = 0.5; // overall subtlety
    const colors = [
      `rgba(168, 85, 247, ${0.25 * baseAlpha})`, // purple 500 @ 25%
      `rgba(99, 102, 241, ${0.18 * baseAlpha})`, // indigo 500 @ 18%
      `rgba(0, 0, 0, ${0.06 * baseAlpha})`, // subtle dark for contrast on white
    ];

    const time = wavePhaseRef.current;

    const ampScale = 0.6 + 0.4 * volume; // react to volume a bit
    const lines = 3;
    for (let i = 0; i < lines; i++) {
      const amp = (h * 0.25) * (1 - i * 0.2) * ampScale; // decreasing amplitudes
      // Use fewer cycles across the width for a longer wavelength and purer sinusoid
      const cycles = 1 + i * 0.2;
      const speed = 0.015 + i * 0.004;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 1) {
        const t = (x / w) * (Math.PI * 2) * cycles + time * speed * 60;
        const y = h / 2 + Math.sin(t) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
    }
  }, [volume]);

  const clearWaves = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startRaf = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      updateProgress();
      // advance phase proportional to playback to keep smooth
      wavePhaseRef.current += 0.02;
      if (playbackState === 'playing') {
        drawWaves();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [updateProgress, drawWaves, playbackState]);

  useEffect(() => {
    if (playbackState === 'playing') {
      startRaf();
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      updateProgress();
      // Show a visible but static waveform when not playing
      drawWaves();
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playbackState, startRaf, updateProgress, drawWaves]);

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
        {/* Keep the audio element mounted so playback continues in background */}
        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} preload="auto" />
        )}
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

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[clamp(320px,90vw,900px)] bg-white/50 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <canvas ref={canvasRef} className="absolute top-[-5px] left-0 w-full h-[30px] opacity-50 pointer-events-none" width="1000" height="40"></canvas>

        {/* Top row: track info + controls on the same line, with right-side tools */}
        <div className="px-4 py-2 flex items-center justify-between gap-4 w-full">
          {/* Left cluster: logo + text + controls all on one row */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-white/10 rounded-md flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/images/logo.png" alt="App logo" className="w-full h-full object-contain p-1" />
              </div>
              <div className="truncate">
                <div className="font-medium text-base truncate">{statusText}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => skipBy(-15)} title="Rewind 15s" aria-label="Rewind 15 seconds" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <BsFillRewindFill size={20} />
              </button>
              <button onClick={onPlayPause} className="w-10 h-10 rounded-full bg-white text-gray-900 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50" disabled={!audioUrl || isGenerating} aria-label={playbackState === 'playing' ? 'Pause' : 'Play'}>
                {playbackState === 'playing' ? <BsFillPauseFill size={20} /> : <BsFillPlayFill size={20} />}
              </button>
              <button onClick={() => skipBy(15)} title="Forward 15s" aria-label="Forward 15 seconds" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <BsFillFastForwardFill size={20} />
              </button>
              <button onClick={onRegenerate} title="Regenerate" aria-label="Regenerate" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                {/* reuse regenerate as extra action */}
                <BsChevronDown style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>
          </div>

          {/* Right cluster: time, volume, settings, download, hide */}
          <div className="flex justify-end items-center gap-4">
            <div className="font-mono text-sm text-gray-300" aria-live="polite">{formatTime(elapsedTime)} / {formatTime(duration)}</div>
            <div className="flex items-center gap-2 w-28">
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
                  height: '4px',
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
        <div className="px-4 pb-2">
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
