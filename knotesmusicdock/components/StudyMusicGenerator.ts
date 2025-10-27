/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { PlaybackState, StudyMusicSettings } from '../types';
import './PlayPauseButton';

const GENRES = ['Lo-Fi', 'Piano', 'Ambient', 'Chillhop', 'Acoustic', 'Nature', 'Electronic'];
const VIBES = ['Calm', 'Focused', 'Uplifting', 'Deep', 'Dreamy', 'Motivational'];
const INSTRUMENTS = ['Piano', 'Guitar', 'Synth', 'Strings', 'Rain', 'Birds', 'Waves'];
const ENERGY_LEVELS: Array<'Low' | 'Medium' | 'High'> = ['Low', 'Medium', 'High'];

@customElement('study-music-generator')
export class StudyMusicGenerator extends LitElement {
  @property({ type: String }) playbackState: PlaybackState = 'stopped';
  @property({ type: String }) trackTitle = '';
  @property({ type: Boolean }) isGenerating = false;
  @property({ type: Object }) currentSettings: StudyMusicSettings | null = null;
  
  @state() private view: 'launcher' | 'settings' | 'player' = 'launcher';
  @state() private settings: StudyMusicSettings = {
    genre: GENRES[0],
    vibe: VIBES[0],
    tempo: 'Medium',
    energy: 'Medium',
    instruments: ['Piano'],
  };
  @state() private elapsedTime = 0;
  @state() private isDockMinimized = false;
  private timerInterval: number | null = null;


  @query('canvas') private canvas!: HTMLCanvasElement;
  private canvasCtx!: CanvasRenderingContext2D | null;

  private _audioData: { freqData: Uint8Array, level: number } = { freqData: new Uint8Array(), level: 0};
  
  @property({ type: Object })
  set audioData(data: { freqData: Uint8Array, level: number }) {
    this._audioData = data;
    if (this.playbackState === 'playing') {
      requestAnimationFrame(() => this.drawVisualizer());
    }
  }
  
  get audioData() { return this._audioData; }

  private startTimer() {
    this.stopTimer(); // Ensure no multiple timers running
    this.elapsedTime = 0;
    this.timerInterval = window.setInterval(() => {
        this.elapsedTime++;
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  
  private resetTimer() {
    this.stopTimer();
    this.elapsedTime = 0;
  }
  
  private formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const formatMinutes = minutes.toString().padStart(2, '0');
    const formatSeconds = seconds.toString().padStart(2, '0');
    return `${formatMinutes}:${formatSeconds}`;
  }


  firstUpdated() {
    this.canvasCtx = this.canvas?.getContext('2d');
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('view') && this.view === 'player' && !this.isDockMinimized && !this.canvasCtx) {
        this.updateComplete.then(() => {
            this.canvasCtx = this.canvas?.getContext('2d');
        });
    }
    if (changedProperties.has('playbackState')) {
        if (this.playbackState === 'playing') {
            this.startTimer();
        } else if (this.playbackState === 'paused') {
            this.stopTimer();
        } else if (this.playbackState === 'stopped') {
            this.resetTimer();
        }
    }
  }

  private handleSettingsChange(e: Event) {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const key = target.name as keyof StudyMusicSettings;
    let value: any = target.value;

    if (key === 'instruments') {
      const instrument = target.value;
      const currentInstruments = this.settings.instruments;
      if (currentInstruments.includes(instrument)) {
        value = currentInstruments.filter(i => i !== instrument);
      } else {
        value = [...currentInstruments, instrument];
      }
    }
    
    if (key === 'tempo') {
       const tempoValue = parseInt(value, 10);
       if (tempoValue < 33) value = 'Slow';
       else if (tempoValue > 66) value = 'Fast';
       else value = 'Medium';
    }

    this.settings = { ...this.settings, [key]: value };
  }

  private generate() {
    this.dispatchEvent(new CustomEvent('generate', { detail: this.settings }));
    this.view = 'player';
  }

  private stop() {
    this.dispatchEvent(new CustomEvent('stop'));
  }
  
  private playPause() {
    if (this.isGenerating) {
       this.stop();
       this.view = 'settings';
    } else {
       this.dispatchEvent(new CustomEvent('play-pause'));
    }
  }
  
  private handleVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const volume = parseFloat(target.value);
    this.dispatchEvent(new CustomEvent('volume-changed', { detail: volume }));
  }

  private tweakSettings() {
    this.stop();
    this.view = 'settings';
  }
  
  private regenerate() {
    this.stop();
    setTimeout(() => {
        if(this.currentSettings) {
            this.dispatchEvent(new CustomEvent('generate', { detail: this.currentSettings }));
        }
    }, 100);
  }

  private downloadTrack() {
    this.dispatchEvent(new CustomEvent('download-track', { detail: this.trackTitle }));
  }

  private toggleDock() {
    this.isDockMinimized = !this.isDockMinimized;
  }

  drawVisualizer() {
    if (!this.canvasCtx || !this.canvas) return;

    const ctx = this.canvasCtx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    ctx.clearRect(0, 0, width, height);
    if (!this.audioData.freqData.length) return;
    
    const dataArray = this.audioData.freqData;
    const bufferLength = dataArray.length / 4; // Use a subset for visual clarity
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#a855f7';
    
    const sliceWidth = width / bufferLength;
    let x = 0;

    ctx.beginPath();
    ctx.moveTo(0, height / 2);

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 255.0;
        const y = height - (v * height);
        ctx.lineTo(x, y);
        x += sliceWidth;
    }
    
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  renderLauncher() {
    return html`
        <button class="launch-button" @click=${() => this.view = 'settings'}>
            Generate background sound
        </button>
    `;
  }

  renderSettings() {
    const tempoValue = this.settings.tempo === 'Slow' ? 15 : this.settings.tempo === 'Fast' ? 85 : 50;

    return html`
      <div class="modal-overlay">
        <div class="modal-content">
            <button class="close-modal-button" @click=${() => this.view = 'launcher'} title="Close">
              ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`}
            </button>
            <h1 class="title">Study Music Generator</h1>
            <div class="controls">
            <div class="control-group">
                <label>Genre</label>
                <select name="genre" .value=${this.settings.genre} @change=${this.handleSettingsChange}>
                ${GENRES.map(g => html`<option value=${g}>${g}</option>`)}
                </select>
            </div>
            <div class="control-group">
                <label>Vibe / Mood</label>
                <select name="vibe" .value=${this.settings.vibe} @change=${this.handleSettingsChange}>
                ${VIBES.map(v => html`<option value=${v}>${v}</option>`)}
                </select>
            </div>
            <div class="control-group">
                    <label>Tempo: ${this.settings.tempo}</label>
                    <input type="range" name="tempo" min="0" max="100" .value=${String(tempoValue)} @input=${this.handleSettingsChange}>
            </div>
            <div class="control-group">
                <label>Energy Level</label>
                <div class="segmented-control">
                    ${ENERGY_LEVELS.map(level => html`
                        <button
                            name="energy"
                            value=${level}
                            class=${classMap({ active: this.settings.energy === level })}
                            @click=${this.handleSettingsChange}>
                            ${level}
                        </button>`)}
                </div>
            </div>
            <div class="control-group">
                <label>Instrument Mix</label>
                <div class="instrument-chips">
                ${INSTRUMENTS.map(i => html`
                    <button
                    value=${i}
                    name="instruments"
                    class=${classMap({ active: this.settings.instruments.includes(i) })}
                    @click=${this.handleSettingsChange}>
                    ${i}
                    </button>
                `)}
                </div>
            </div>
            </div>
            <button class="generate-button" @click=${this.generate} ?disabled=${this.isGenerating}>
            ${this.isGenerating ? 'Initializing...' : 'Generate Music'}
            </button>
        </div>
      </div>
    `;
  }

  renderPlayerDock() {
    const statusText = this.isGenerating ? 'Composing...' : this.trackTitle;
    const effectivePlaybackState = this.isGenerating ? 'loading' : this.playbackState;

    return html`
      <div class="player-dock">
        <canvas class="visualizer-bar" width="1000" height="40"></canvas>
        <div class="dock-content">
            <div class="track-info">
                <div class="track-icon">
                     ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`}
                </div>
                <div class="track-title-container">
                    <div class="track-title-dock">${statusText}</div>
                </div>
            </div>

            <div class="player-controls-center">
                 <button class="control-button" @click=${this.regenerate} title="Regenerate (Previous)">
                    ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M6 6h2v12H6zm3.5 6l8.5 6V6l-8.5 6z"/></svg>`}
                </button>
                <play-pause-button 
                    class="play-pause-dock"
                    .playbackState=${effectivePlaybackState}
                    @click=${this.playPause}>
                </play-pause-button>
                <button class="control-button" @click=${this.regenerate} title="Regenerate (Next)">
                    ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`}
                </button>
            </div>

            <div class="player-controls-right">
                <div class="time-display">${this.formatTime(this.elapsedTime)}</div>
                <div class="volume-control">
                    ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M3 9v6h4l5 5V4L7 9H3zm7 .17L12.17 7 10 9.17zM14 12c0-2.21-1.79-4-4-4v1.77c1.24.81 2 2.16 2 3.73s-.76 2.92-2 3.73V16c2.21 0 4-1.79 4-4z"/></svg>`}
                    <input type="range" class="volume-slider" min="0" max="1" step="0.01" value="1" @input=${this.handleVolumeChange}>
                </div>
                 <button class="control-button" @click=${this.tweakSettings} title="Tweak Settings">
                    ${svg`<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><g><path d="M0,0h24v24H0V0z" fill="none"/></g><g><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.44,0.17-0.48,0.41L9.2,5.7c-0.59,0.25-1.12,0.56-1.62,0.94l-2.39-0.96c-0.22-0.08-0.47,0-0.59,0.22L2.69,9.2 c-0.11,0.2-0.06,0.47,0.12,0.61l2.03,1.58C4.78,11.66,4.76,11.97,4.76,12.3c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.89 c0.04,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17-0.48-0.41l0.36-2.89c0.59-0.25,1.12-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.11-0.2,0.06-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></g></svg>`}
                </button>
                <button class="control-button" @click=${this.downloadTrack} title="Download Track">
                    ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`}
                </button>
                <button class="control-button" @click=${this.toggleDock} title="Hide Player">
                    ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`}
                </button>
            </div>
        </div>
      </div>
    `;
  }

  renderMinimizedDock() {
    return html`
      <button class="minimized-dock-button" @click=${this.toggleDock} title="Show Music Player">
        ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 0 24 24" width="28px" fill="#FFFFFF"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/></svg>`}
      </button>
    `;
  }

  render() {
    switch(this.view) {
        case 'launcher':
            return this.renderLauncher();
        case 'settings':
            return html`<div class="modal-overlay">${this.renderSettings()}</div>`;
        case 'player':
            if (this.isDockMinimized) {
                return this.renderMinimizedDock();
            }
            return this.renderPlayerDock();
        default:
            return html``;
    }
  }

  static styles = css`
    :host {
      display: contents;
    }

    .launch-button {
      padding: 1rem 2rem;
      font-size: 1.25rem;
      font-weight: 500;
      background: #a855f7;
      color: #fff;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 8px 32px 0 rgba(168, 85, 247, 0.37);
    }
    .launch-button:hover {
        background: #9333ea;
        transform: translateY(-2px);
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .modal-content {
      position: relative;
      width: clamp(320px, 90vw, 500px);
      max-height: 90vh;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 2rem;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .close-modal-button {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
      z-index: 10;
    }
    .close-modal-button:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .close-modal-button svg {
      fill: #ccc;
    }

    .title {
      font-size: 1.5rem;
      font-weight: 500;
      margin: 0 0 1rem 0;
      text-align: center;
    }
    .controls {
      width: 100%;
      overflow-y: auto;
      padding-right: 1rem;
      margin-right: -1rem;
      margin-bottom: 1rem;
    }
    .control-group {
      margin-bottom: 1.25rem;
    }
    .control-group label {
      display: block;
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: #ccc;
    }
    
    select, input[type="range"] {
      width: 100%;
      background: rgba(0,0,0,0.3);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 0.75rem;
      font-size: 1rem;
      outline: none;
      -webkit-appearance: none;
    }
    select:focus, input:focus {
        border-color: #a855f7;
    }
    
    input[type="range"] {
        padding: 0;
    }
    input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: 6px;
        cursor: pointer;
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
    }
    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 18px;
        width: 18px;
        border-radius: 50%;
        background: #a855f7;
        cursor: pointer;
        margin-top: -6px;
    }
    
    .segmented-control, .instrument-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    .segmented-control button, .instrument-chips button {
        background: rgba(0,0,0,0.3);
        color: #ccc;
        border: 1px solid rgba(255,255,255,0.2);
        padding: 0.5rem 1rem;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9rem;
    }
    .segmented-control button.active, .instrument-chips button.active {
        background: #a855f7;
        color: #fff;
        border-color: #a855f7;
    }
    .segmented-control button:hover, .instrument-chips button:hover {
        border-color: #a855f7;
    }

    .generate-button {
      width: 100%;
      padding: 1rem;
      font-size: 1.1rem;
      font-weight: 500;
      background: #a855f7;
      color: #fff;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s ease;
      margin-top: auto;
    }
    .generate-button:hover:not(:disabled) {
      background: #9333ea;
    }
    .generate-button:disabled {
      background: #555;
      cursor: not-allowed;
    }

    /* Player Dock */
    .player-dock {
        position: fixed;
        bottom: 1.5rem;
        left: 50%;
        transform: translateX(-50%);
        width: clamp(320px, 90vw, 800px);
        height: 80px;
        background: rgba(28, 28, 28, 0.75);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        z-index: 1001;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .visualizer-bar {
        width: 100%;
        height: 30px;
        position: absolute;
        top: -5px;
        left: 0;
        opacity: 0.5;
    }

    .dock-content {
        padding: 0 1rem;
        flex-grow: 1;
        display: grid;
        grid-template-columns: 1fr 1.5fr 1fr;
        align-items: center;
        gap: 1rem;
        width: 100%;
        box-sizing: border-box;
    }

    .track-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-width: 0;
    }
    .track-icon {
        width: 48px;
        height: 48px;
        background: rgba(255,255,255,0.1);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
    .track-title-container {
        display: flex;
        align-items: center;
        min-width: 0;
    }
    .track-title-dock {
        font-weight: 500;
        font-size: 1.05rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .player-controls-center {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
    }
    .play-pause-dock {
        width: 70px;
        height: 70px;
    }
    .control-button {
        background: none;
        border: none;
        color: #eee;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }
    .control-button:hover {
        background: rgba(255,255,255,0.1);
    }
    .control-button svg {
        fill: #eee;
    }
    
    .player-controls-right {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 1rem;
    }
    .time-display {
        font-family: monospace;
        font-size: 0.9rem;
        color: #ccc;
    }
    .volume-control {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 120px;
    }
    .volume-slider {
        flex-grow: 1;
        accent-color: #a855f7;
    }
    .volume-slider::-webkit-slider-thumb { background: #fff; }

    .minimized-dock-button {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        width: 60px;
        height: 60px;
        background: #a855f7;
        color: #fff;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 32px 0 rgba(168, 85, 247, 0.37);
        z-index: 1002;
        transition: all 0.3s ease;
    }
    .minimized-dock-button:hover {
        transform: scale(1.1);
        background: #9333ea;
    }
    .minimized-dock-button svg {
        fill: #fff;
    }

    @media (max-width: 768px) {
        .dock-content {
            grid-template-columns: 1fr auto;
            gap: 0.5rem;
        }
        .player-controls-right {
            display: none; /* Hide right controls on small screens */
        }
        .track-info > div:not(.track-icon) {
            display: none; /* Hide text on very small screens */
        }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'study-music-generator': StudyMusicGenerator;
  }
}
