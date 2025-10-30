'use client'

import { useState } from 'react';
import { StudyMusicSettings } from '@/lib/types/music';
import { BsXLg } from 'react-icons/bs';

const GENRES = ['Lo-Fi', 'Piano', 'Ambient', 'Chillhop', 'Acoustic', 'Nature', 'Electronic'];
const VIBES = ['Calm', 'Focused', 'Uplifting', 'Deep', 'Dreamy', 'Motivational'];
const INSTRUMENTS = ['Piano', 'Guitar', 'Synth', 'Strings', 'Rain', 'Birds', 'Waves'];
const ENERGY_LEVELS: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];

interface MusicSettingsDialogProps {
  initialSettings: StudyMusicSettings;
  onGenerate: (settings: StudyMusicSettings) => void;
  onClose: () => void;
  isGenerating: boolean;
}

const MusicSettingsDialog = ({
  initialSettings,
  onGenerate,
  onClose,
  isGenerating,
}: MusicSettingsDialogProps) => {
  const [settings, setSettings] = useState<StudyMusicSettings>(initialSettings);

  const handleSettingsChange = (
    key: keyof StudyMusicSettings,
    value: any
  ) => {
    if (key === 'instruments') {
      const currentInstruments = settings.instruments;
      if (currentInstruments.includes(value)) {
        setSettings({ ...settings, instruments: currentInstruments.filter(i => i !== value) });
      } else {
        setSettings({ ...settings, instruments: [...currentInstruments, value] });
      }
    } else {
      setSettings({ ...settings, [key]: value });
    }
  };
  
  const tempoValue = settings.tempo === 'Slow' ? 15 : settings.tempo === 'Fast' ? 85 : 50;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e)=>{ if (e.target === e.currentTarget) onClose(); }}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
        {/* Panel */}
        <div className="relative z-10 w-[clamp(320px,92vw,560px)] max-h-[88vh] rounded-3xl bg-accent/95 dark:bg-[--color-dark-bg]/95 ring-1 ring-black/10 dark:ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col p-6">
            <button onClick={onClose} className="absolute top-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/5 text-slate-700 dark:text-[--color-accent] hover:bg-white/80" title="Close" aria-label="Close settings">
                <BsXLg />
            </button>
            <h1 className="text-xl sm:text-2xl font-semibold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">Background Study Music</h1>

            <div className="flex-grow overflow-y-auto pr-4 -mr-4 mb-6">
                 <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                    <select
                        name="genre"
                        value={settings.genre}
                        onChange={(e) => handleSettingsChange('genre', e.target.value)}
                        className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
                    >
                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)
                        }
                    </select>
                </div>
                
                <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vibe / Mood</label>
                    <select
                        name="vibe"
                        value={settings.vibe}
                        onChange={(e) => handleSettingsChange('vibe', e.target.value)}
                        className="w-full bg-white text-gray-900 border border-gray-200 rounded-lg px-4 py-3 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
                    >
                        {VIBES.map(v => <option key={v} value={v}>{v}</option>)
                        }
                    </select>
                </div>

                <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tempo: {settings.tempo}</label>
                    <input
                        type="range"
                        name="tempo"
                        min="0"
                        max="100"
                        value={tempoValue}
                        onInput={(e) => {
                            const val = parseInt((e.target as HTMLInputElement).value, 10);
                            const newTempo = val < 33 ? 'Slow' : val > 66 ? 'Fast' : 'Medium';
                            handleSettingsChange('tempo', newTempo)
                        }}
                        className="w-full accent-emerald-600"
                    />
                </div>

                 <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Energy Level</label>
                    <div className="flex gap-2">
                        {ENERGY_LEVELS.map(level => (
                            <button
                                key={level}
                                onClick={() => handleSettingsChange('energy', level)}
                                className={`px-4 py-2 rounded-full text-sm transition-colors ${settings.energy === level ? 'bg-emerald-500 text-white' : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50'}`}>
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Instrument Mix</label>
                    <div className="flex flex-wrap gap-2">
                        {INSTRUMENTS.map(i => (
                             <button
                                key={i}
                                onClick={() => handleSettingsChange('instruments', i)}
                                className={`px-4 py-2 rounded-full text-sm transition-colors ${settings.instruments.includes(i) ? 'bg-emerald-500 text-white' : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50'}`}>
                                {i}
                            </button>
                        ))}
                    </div>
                </div>

            </div>

             <button
                onClick={() => onGenerate(settings)}
                disabled={isGenerating}
                className="w-full py-4 text-lg font-medium text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-lg hover:shadow-xl disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {isGenerating ? 'Initializing...' : 'Generate Music'}
            </button>
        </div>
    </div>
  );
};

export default MusicSettingsDialog;
