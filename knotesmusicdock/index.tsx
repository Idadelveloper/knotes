/**
 * @fileoverview A study music generator application.
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlaybackState, StudyMusicSettings } from './types';
import { GoogleGenAI } from '@google/genai';
import { StudyMusicGenerator } from './components/StudyMusicGenerator';
import { ToastMessage } from './components/ToastMessage';
import { LiveMusicHelper } from './utils/LiveMusicHelper';
import { AudioAnalyser } from './utils/AudioAnalyser';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, apiVersion: 'v1alpha' });
const model = 'lyria-realtime-exp';

function main() {
  const generator = new StudyMusicGenerator();
  document.body.appendChild(generator);

  const toastMessage = new ToastMessage();
  document.body.appendChild(toastMessage);

  const liveMusicHelper = new LiveMusicHelper(ai, model);
  const audioAnalyser = new AudioAnalyser(liveMusicHelper.audioContext);
  liveMusicHelper.extraDestination = audioAnalyser.node;

  generator.addEventListener('generate', async (e: Event) => {
    const customEvent = e as CustomEvent<StudyMusicSettings>;
    const settings = customEvent.detail;
    
    const instruments = settings.instruments.length > 0 ? `featuring ${settings.instruments.join(' and ')}` : '';
    const prompt = `A ${settings.tempo.toLowerCase()} tempo, ${settings.energy.toLowerCase()} energy, ${settings.vibe.toLowerCase()} ${settings.genre.toLowerCase()} track, ${instruments}.`;
    
    generator.isGenerating = true;
    generator.currentSettings = settings;

    // Generate title
    try {
        const titlePrompt = `Generate a creative, short, instrumental track title for a piece of background music for studying. The music's description is: ${prompt}`;
        const result = await ai.models.generateContent({model: 'gemini-2.5-flash', contents: titlePrompt});
        generator.trackTitle = result.text.replace(/"/g, '');
    } catch (error) {
        console.error('Error generating title:', error);
        generator.trackTitle = `${settings.vibe} ${settings.genre}`; // Fallback title
    }
    
    liveMusicHelper.play(prompt);
  });

  generator.addEventListener('stop', () => {
    liveMusicHelper.stop();
  });

  generator.addEventListener('play-pause', () => {
    liveMusicHelper.playPause();
  });

  generator.addEventListener('volume-changed', (e: Event) => {
    const customEvent = e as CustomEvent<number>;
    liveMusicHelper.setVolume(customEvent.detail);
  });

  generator.addEventListener('download-track', (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const title = customEvent.detail;
    liveMusicHelper.download(title);
  });

  liveMusicHelper.addEventListener('playback-state-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<PlaybackState>;
    const playbackState = customEvent.detail;
    generator.playbackState = playbackState;
    if (playbackState === 'playing') {
      audioAnalyser.start();
      generator.isGenerating = false;
    } else {
      audioAnalyser.stop();
    }
  }));

  const errorToast = ((e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const error = customEvent.detail;
    toastMessage.show(error);
    generator.isGenerating = false;
    liveMusicHelper.stop();
  });

  liveMusicHelper.addEventListener('error', errorToast);

  audioAnalyser.addEventListener('audio-level-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<{ freqData: Uint8Array, level: number }>;
    generator.audioData = customEvent.detail;
  }));
}

main();