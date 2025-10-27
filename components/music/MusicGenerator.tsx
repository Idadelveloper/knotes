
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import MusicSettingsDialog from "./MusicSettingsDialog";
import MusicPlayer from "./MusicPlayer";
import { StudyMusicSettings, PlaybackState } from "@/lib/types/music";
import { GoogleGenAI } from "@google/genai";
import { LiveMusicHelper } from "@/lib/utils/LiveMusicHelper";

interface MusicGeneratorProps {
  showLauncher?: boolean;
  openSettingsSignal?: number;
}

const MusicGenerator = ({ showLauncher = true, openSettingsSignal }: MusicGeneratorProps) => {
  const [view, setView] = useState<"launcher" | "settings" | "player">(
    "launcher"
  );
  const [settings, setSettings] = useState<StudyMusicSettings>({
    genre: "Lo-Fi",
    vibe: "Calm",
    tempo: "Medium",
    energy: "Medium",
    instruments: ["Piano"],
  });
  const [playbackState, setPlaybackState] = useState<PlaybackState>("stopped");
  const [trackTitle, setTrackTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSettings, setCurrentSettings] =
    useState<StudyMusicSettings | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);

  // AI + Lyria live helper (persist across renders)
  const aiRef = useRef<GoogleGenAI | null>(null);
  const liveRef = useRef<LiveMusicHelper | null>(null);

  useEffect(() => {
    if (!aiRef.current) {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      if (apiKey && apiKey.trim().length > 0) {
        aiRef.current = new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' });
      } else {
        console.warn('[MusicGenerator] No API key found. Set NEXT_PUBLIC_API_KEY or NEXT_PUBLIC_GEMINI_API_KEY to enable AI generation.');
      }
    }
    if (!liveRef.current && aiRef.current) {
      // Use Lyria experimental realtime model
      liveRef.current = new LiveMusicHelper(aiRef.current, 'lyria-realtime-exp');
      // Wire events to React state
      const helper = liveRef.current;
      const onState = (e: Event) => {
        const detail = (e as CustomEvent<PlaybackState>).detail;
        setPlaybackState(detail);
        if (detail === 'playing') setIsGenerating(false);
      };
      const onError = (e: Event) => {
        const msg = (e as CustomEvent<string>).detail;
        console.error('Lyria error:', msg);
        setIsGenerating(false);
        setPlaybackState('stopped');
      };
      helper.addEventListener('playback-state-changed', onState);
      helper.addEventListener('error', onError);

      return () => {
        helper.removeEventListener('playback-state-changed', onState);
        helper.removeEventListener('error', onError);
      };
    }
  }, []);

  // Open settings programmatically when signal changes
  useEffect(() => {
    if (typeof openSettingsSignal === 'number') {
      setView('settings');
    }
  }, [openSettingsSignal]);

  const buildPrompt = (s: StudyMusicSettings) => {
    const instruments = s.instruments.length > 0 ? `featuring ${s.instruments.join(' and ')}` : '';
    return `A ${s.tempo.toLowerCase()} tempo, ${s.energy.toLowerCase()} energy, ${s.vibe.toLowerCase()} ${s.genre.toLowerCase()} track, ${instruments}.`;
  };

  const handleGenerate = async (newSettings: StudyMusicSettings) => {
    setSettings(newSettings);
    setCurrentSettings(newSettings);
    setIsGenerating(true);
    setView('player');

    const helper = liveRef.current;
    const ai = aiRef.current;
    const prompt = buildPrompt(newSettings);

    // Generate a dynamic title using Writer API first, fall back to Gemini, then heuristic
    try {
        const { generateTrackName } = await import('@/lib/writer');
        const { title } = await generateTrackName({ description: prompt });
        setTrackTitle(title);
      } catch (err) {
        console.warn('[MusicGenerator] Writer title failed, falling back:', err);
        try {
          if (ai) {
            const titlePrompt = `Generate a creative, short, instrumental track title for background study music. Description: ${prompt}`;
            // @ts-ignore
            const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: titlePrompt });
            // @ts-ignore
            const text = typeof res.text === 'function' ? res.text() : (res.text || res.candidates?.[0]?.content?.parts?.[0]?.text || 'Generated Track');
            setTrackTitle(String(text).replace(/"/g, ''));
          } else {
            setTrackTitle(`${newSettings.vibe} ${newSettings.genre}`);
          }
        } catch (e2) {
          console.error('Title generation failed (fallback)', e2);
          setTrackTitle(`${newSettings.vibe} ${newSettings.genre}`);
        }
      }

    // Start live AI generation via Lyria
    try {
      if (!helper) throw new Error('LiveMusicHelper not initialized');
      await helper.play(prompt);
      // audioUrl remains undefined because we stream via WebAudio; MusicPlayer supports background waves/UI
      setAudioUrl(undefined);
    } catch (err) {
      console.error('Play failed', err);
      setIsGenerating(false);
      setPlaybackState('stopped');
    }
  };

  const handleStop = () => {
    setPlaybackState('stopped');
    liveRef.current?.stop();
  };

  const handlePlayPause = () => {
    liveRef.current?.playPause();
  };

  const handleTweakSettings = () => {
    handleStop();
    setView("settings");
  };

  const handleRegenerate = () => {
    if (currentSettings) {
      handleGenerate(currentSettings);
    }
  };

  if (view === "launcher") {
    if (!showLauncher) return null;
    return (
      <button
        onClick={() => setView("settings")}
        className="px-8 py-4 text-lg font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
      >
        Generate Background Sound
      </button>
    );
  }

  if (view === "settings") {
    return (
      <MusicSettingsDialog
        initialSettings={settings}
        onGenerate={handleGenerate}
        onClose={() => setView("launcher")}
        isGenerating={isGenerating}
      />
    );
  }

  if (view === "player") {
    return (
      <MusicPlayer
        trackTitle={trackTitle}
        playbackState={playbackState}
        isGenerating={isGenerating}
        audioUrl={audioUrl}
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onTweakSettings={handleTweakSettings}
        onRegenerate={handleRegenerate}
        onDownload={() => liveRef.current?.download(trackTitle)}
      />
    );
  }

  return null;
};

export default MusicGenerator;
