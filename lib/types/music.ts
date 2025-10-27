/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'loading';

export interface StudyMusicSettings {
  genre: string;
  vibe: string;
  tempo: 'Slow' | 'Medium' | 'Fast';
  energy: 'Low' | 'Medium' | 'High';
  instruments: string[];
}
