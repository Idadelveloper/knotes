"use client";

import { useState } from "react";
import SettingsCard from "@/components/SettingsCard";
import { FaCloudUploadAlt, FaFileAlt, FaEllipsisH } from "react-icons/fa";

export default function SettingsPage() {
  // State Management
  const [displayMode, setDisplayMode] = useState<'Light' | 'Dark' | 'Focus'>("Light");
  const [textSize, setTextSize] = useState<number>(16);

  const [voiceTone, setVoiceTone] = useState<'Male' | 'Female' | 'Neutral'>("Female");
  const [language, setLanguage] = useState<string>("English");
  const [volume, setVolume] = useState<number>(75);
  const [tempo, setTempo] = useState<number>(50);
  const [autoSave, setAutoSave] = useState<boolean>(true);

  // Mock uploaded files list
  const [files] = useState<Array<{ name: string; status: 'summarized' | 'processing' }>>([
    { name: "Psychology_Chapter_3.pdf", status: "summarized" },
    { name: "Biology_Mitochondria_Notes.txt", status: "processing" },
  ]);

  const Segmented = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: any) => void }) => (
    <div className="inline-flex items-center bg-gray-100 p-1 rounded-lg">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${active ? 'bg-white shadow text-slate-900' : 'text-gray-700 hover:bg-gray-200'}`}
            onClick={() => onChange(opt)}
            type="button"
          >
            {opt}
          </button>
        );
      })}
    </div>
  );

  return (
    <main className="pb-10">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
      </header>

      {/* Cards stack */}
      <div className="space-y-6">
        {/* Display Mode */}
        <SettingsCard title="Display Mode">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Segmented options={["Light", "Dark", "Focus"]} value={displayMode} onChange={setDisplayMode as any} />
            </div>

            {/* Text size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Text Size</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={12}
                  max={22}
                  value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none accent-blue-500"
                />
                <span className="text-sm text-gray-600 w-10 text-right">{textSize}px</span>
              </div>
            </div>
          </div>
        </SettingsCard>

        {/* Manage Notes */}
        <SettingsCard title="Manage Notes">
          {/* Uploader */}
          <div className="rounded-lg p-6 border-2 border-dashed border-blue-200 bg-blue-50/50 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-500">
              <FaCloudUploadAlt />
            </div>
            <p className="mt-3 font-medium text-slate-900">Click to upload or drag and drop</p>
            <p className="text-sm text-gray-500">PDF, DOCX, TXT (MAX. 10MB)</p>
          </div>

          {/* Files list */}
          <ul className="space-y-3 mt-4">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <FaFileAlt className="text-gray-600" />
                  <span className="text-sm text-slate-800 truncate">{f.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {f.status === 'summarized' ? (
                    <span className="rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-700">Summarized</span>
                  ) : (
                    <span className="rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700">Processing...</span>
                  )}
                  <button className="p-2 rounded-md hover:bg-gray-100" title="More">
                    <FaEllipsisH />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </SettingsCard>

        {/* Grid: AI Voice & Language | Music & Playback */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingsCard title="AI Voice & Language">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Voice Tone</label>
              <Segmented options={["Male", "Female", "Neutral"]} value={voiceTone} onChange={setVoiceTone as any} />

              <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">Language for Translations & Summaries</label>
              <select
                className="w-full border border-gray-300 rounded-lg shadow-sm p-2 text-slate-900"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {["English","Spanish","French","German","Chinese"].map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
          </SettingsCard>

          <SettingsCard title="Music & Playback">
            <div className="space-y-4">
              {/* Volume */}
              <div>
                <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                  <span>Volume</span>
                  <span>{Math.round(volume)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="mt-2 w-full h-2 bg-gray-200 rounded-full appearance-none accent-blue-500"
                />
              </div>

              {/* Tempo */}
              <div>
                <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                  <span>Tempo</span>
                  <span>{tempo < 40 ? 'Slow' : tempo > 60 ? 'Fast' : 'Normal'}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={tempo}
                  onChange={(e) => setTempo(Number(e.target.value))}
                  className="mt-2 w-full h-2 bg-gray-200 rounded-full appearance-none accent-blue-500"
                />
              </div>

              {/* Auto-save */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">Auto-save generated music</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-500 transition-colors" />
                  <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-end mt-6">
        <button
          className="rounded-lg px-6 py-2 bg-blue-500 text-white font-medium shadow hover:brightness-105"
          onClick={() => alert('Settings saved!')}
        >
          Save Changes
        </button>
      </div>
    </main>
  );
}
