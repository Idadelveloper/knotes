/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type PlaybackState = 'stopped' | 'playing' | 'loading' | 'paused';

export interface StudyMusicSettings {
  genre: string;
  vibe: string;
  tempo: 'Slow' | 'Medium' | 'Fast';
  energy: 'Low' | 'Medium' | 'High';
  instruments: string[];
}

// FIX: Added Prompt type definition.
export interface Prompt {
  promptId: string;
  text: string;
  weight: number;
  cc: number;
  color: string;
}

// FIX: Added ControlChange type definition.
export interface ControlChange {
  cc: number;
  value: number;
  channel: number;
}
