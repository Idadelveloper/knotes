
"use client";
import { useState } from "react";
import MusicSettingsDialog from "./MusicSettingsDialog.js";
import MusicPlayer from "./MusicPlayer.js";
import { StudyMusicSettings, PlaybackState } from "@/lib/types/music";

const MusicGenerator = () => {
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

  const handleGenerate = (newSettings: StudyMusicSettings) => {
    setSettings(newSettings);
    setCurrentSettings(newSettings);
    setIsGenerating(true);
    // Simulate music generation
    setTimeout(() => {
      setTrackTitle(`Generated Track - ${newSettings.genre}`);
      setIsGenerating(false);
      setPlaybackState("playing");
      setView("player");
    }, 2000);
  };

  const handleStop = () => {
    setPlaybackState("stopped");
  };

  const handlePlayPause = () => {
    setPlaybackState((prev) => (prev === "playing" ? "paused" : "playing"));
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
        onPlayPause={handlePlayPause}
        onStop={handleStop}
        onTweakSettings={handleTweakSettings}
        onRegenerate={handleRegenerate}
        onDownload={() => {}}
      />
    );
  }

  return null;
};

export default MusicGenerator;
