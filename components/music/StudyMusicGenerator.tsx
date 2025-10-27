
"use client";
import { useState, useEffect, useRef } from "react";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";

const GENRES = [
  "Lo-Fi",
  "Piano",
  "Ambient",
  "Chillhop",
  "Acoustic",
  "Nature",
  "Electronic",
];
const VIBES = ["Calm", "Focused", "Uplifting", "Deep", "Dreamy", "Motivational"];
const INSTRUMENTS = [
  "Piano",
  "Guitar",
  "Synth",
  "Strings",
  "Rain",
  "Birds",
  "Waves",
];
const ENERGY_LEVELS = ["Low", "Medium", "High"];

const StudyMusicGenerator = () => {
  const [view, setView] = useState("launcher");
  const [settings, setSettings] = useState({
    genre: GENRES[0],
    vibe: VIBES[0],
    tempo: "Medium",
    energy: "Medium",
    instruments: ["Piano"],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [trackTitle, setTrackTitle] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [isDockMinimized, setIsDockMinimized] = useState(false);

  const handleSettingsChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "instruments") {
      const currentInstruments = settings.instruments;
      if (currentInstruments.includes(value)) {
        setSettings({
          ...settings,
          instruments: currentInstruments.filter((i) => i !== value),
        });
      } else {
        setSettings({
          ...settings,
          instruments: [...currentInstruments, value],
        });
      }
    } else {
      setSettings({ ...settings, [name]: value });
    }
  };

  const generateMusic = async () => {
    setIsGenerating(true);
    // Simulate music generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setTrackTitle(
      `${settings.genre} - ${settings.vibe} - ${settings.energy}`
    );
    setAudioUrl(
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    );
    setIsGenerating(false);
    setView("player");
  };

  const renderLauncher = () => (
    <button className="launch-button" onClick={() => setView("settings")}>
      Generate background sound
    </button>
  );

  const renderSettings = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <button
          className="close-modal-button"
          onClick={() => setView("launcher")}
        >
          &times;
        </button>
        <h1 className="title">Study Music Generator</h1>
        <div className="controls">
          <div className="control-group">
            <label>Genre</label>
            <select
              name="genre"
              value={settings.genre}
              onChange={handleSettingsChange}
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Vibe / Mood</label>
            <select
              name="vibe"
              value={settings.vibe}
              onChange={handleSettingsChange}
            >
              {VIBES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {/* Add other controls here */}
        </div>
        <button
          className="generate-button"
          onClick={generateMusic}
          disabled={isGenerating}
        >
          {isGenerating ? "Initializing..." : "Generate Music"}
        </button>
      </div>
    </div>
  );

  const renderPlayerDock = () =>
    !isDockMinimized ? (
      <div className="player-dock">
        <div className="dock-content">
          <div className="track-info">
            <div className="track-title-dock">{trackTitle}</div>
          </div>
          <AudioPlayer src={audioUrl} />
        </div>
        <button
          className="control-button"
          onClick={() => setIsDockMinimized(true)}
        >
          &darr;
        </button>
      </div>
    ) : (
      <button
        className="minimized-dock-button"
        onClick={() => setIsDockMinimized(false)}
      >
        &uarr;
      </button>
    );

  return (
    <div>
      {view === "launcher" && renderLauncher()}
      {view === "settings" && renderSettings()}
      {view === "player" && renderPlayerDock()}
    </div>
  );
};

export default StudyMusicGenerator;
