'use client'

import { useState } from 'react';
import { StudyMusicSettings } from '@/lib/types/music';

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="relative w-[clamp(320px,90vw,500px)] max-h-[90vh] bg-gray-800/70 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl flex flex-col p-8">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors" title="Close">
                {/* Close Icon */}
            </button>
            <h1 className="text-2xl font-medium text-center mb-6">Study Music Generator</h1>

            <div className="flex-grow overflow-y-auto pr-4 -mr-4 mb-6">
                 <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Genre</label>
                    <select
                        name="genre"
                        value={settings.genre}
                        onChange={(e) => handleSettingsChange('genre', e.target.value)}
                        className="w-full bg-black/30 text-white border border-white/20 rounded-lg px-4 py-3 text-base outline-none focus:border-purple-600"
                    >
                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)
                        }
                    </select>
                </div>
                
                <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Vibe / Mood</label>
                    <select
                        name="vibe"
                        value={settings.vibe}
                        onChange={(e) => handleSettingsChange('vibe', e.target.value)}
                        className="w-full bg-black/30 text-white border border-white/20 rounded-lg px-4 py-3 text-base outline-none focus:border-purple-600"
                    >
                        {VIBES.map(v => <option key={v} value={v}>{v}</option>)
                        }
                    </select>
                </div>

                <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Tempo: {settings.tempo}</label>
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
                        className="w-full accent-purple-600"
                    />
                </div>

                 <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Energy Level</label>
                    <div className="flex gap-2">
                        {ENERGY_LEVELS.map(level => (
                            <button
                                key={level}
                                onClick={() => handleSettingsChange('energy', level)}
                                className={`px-4 py-2 rounded-full text-sm transition-colors ${settings.energy === level ? 'bg-purple-600 text-white' : 'bg-black/30 hover:bg-white/20'}`}>
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Instrument Mix</label>
                    <div className="flex flex-wrap gap-2">
                        {INSTRUMENTS.map(i => (
                             <button
                                key={i}
                                onClick={() => handleSettingsChange('instruments', i)}
                                className={`px-4 py-2 rounded-full text-sm transition-colors ${settings.instruments.includes(i) ? 'bg-purple-600 text-white' : 'bg-black/30 hover:bg-white/20'}`}>
                                {i}
                            </button>
                        ))}
                    </div>
                </div>

            </div>

             <button
                onClick={() => onGenerate(settings)}
                disabled={isGenerating}
                className="w-full py-4 text-lg font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
                {isGenerating ? 'Initializing...' : 'Generate Music'}
            </button>
        </div>
    </div>
  );
};

export default MusicSettingsDialog;
