/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { PlaybackState } from '../types';
import type { AudioChunk, GoogleGenAI, LiveMusicServerMessage, LiveMusicSession } from '@google/genai';
import { decode, decodeAudioData } from './audio';

export class LiveMusicHelper extends EventTarget {

  private ai: GoogleGenAI;
  private model: string;

  private session: LiveMusicSession | null = null;
  private sessionPromise: Promise<LiveMusicSession> | null = null;

  private nextStartTime = 0;
  private bufferTime = 2;

  public readonly audioContext: AudioContext;
  public extraDestination: AudioNode | null = null;

  private outputNode: GainNode;
  private playbackState: PlaybackState = 'stopped';
  private currentPrompt = '';

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private streamDestination: MediaStreamAudioDestinationNode;


  constructor(ai: GoogleGenAI, model: string) {
    super();
    this.ai = ai;
    this.model = model;
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    this.outputNode = this.audioContext.createGain();
    this.streamDestination = this.audioContext.createMediaStreamDestination();
  }

  private getSession(): Promise<LiveMusicSession> {
    if (!this.sessionPromise) this.sessionPromise = this.connect();
    return this.sessionPromise;
  }

  private async connect(): Promise<LiveMusicSession> {
    this.sessionPromise = this.ai.live.music.connect({
      model: this.model,
      callbacks: {
        onmessage: async (e: LiveMusicServerMessage) => {
          if (e.serverContent?.audioChunks) {
            await this.processAudioChunks(e.serverContent.audioChunks);
          }
        },
        onerror: (e) => {
          console.error(e);
          this.stop();
          this.dispatchEvent(new CustomEvent('error', { detail: 'Connection error, please try again.' }));
        },
        onclose: () => {
          if (this.playbackState !== 'stopped') {
            this.stop();
            this.dispatchEvent(new CustomEvent('error', { detail: 'Connection closed, please try again.' }));
          }
        },
      },
    });
    return this.sessionPromise;
  }

  private setPlaybackState(state: PlaybackState) {
    this.playbackState = state;
    this.dispatchEvent(new CustomEvent('playback-state-changed', { detail: state }));
  }

  private async processAudioChunks(audioChunks: AudioChunk[]) {
    if (this.playbackState === 'paused' || this.playbackState === 'stopped') return;
    const audioBuffer = await decodeAudioData(
      decode(audioChunks[0].data!),
      this.audioContext,
      48000,
      2,
    );
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputNode);
    if (this.nextStartTime === 0) {
      this.nextStartTime = this.audioContext.currentTime + this.bufferTime;
      setTimeout(() => {
        // If we are still in loading state, switch to playing
        if (this.playbackState === 'loading') {
          this.setPlaybackState('playing');
        }
      }, this.bufferTime * 1000);
    }
    if (this.nextStartTime < this.audioContext.currentTime) {
      this.setPlaybackState('loading');
      this.nextStartTime = 0;
      return;
    }
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  private async setPrompt(prompt: string) {
    if (!this.session) return;
    try {
      await this.session.setWeightedPrompts({
        weightedPrompts: [{ text: prompt, weight: 1 }],
      });
    } catch (e: any) {
      this.dispatchEvent(new CustomEvent('error', { detail: e.message }));
      this.stop();
    }
  }

  public async play(prompt?: string) {
    if (prompt) {
      this.currentPrompt = prompt;
    }
    
    if (this.playbackState === 'paused') {
       this.audioContext.resume();
       this.setPlaybackState('playing');
       return;
    }
    
    if (this.activePrompts.length === 0) {
      this.dispatchEvent(new CustomEvent('error', { detail: 'Cannot play without a prompt.' }));
      return;
    }
    
    this.setPlaybackState('loading');
    this.session = await this.getSession();
    await this.setPrompt(this.currentPrompt);
    this.audioContext.resume();
    this.session.play();
    this.outputNode.connect(this.audioContext.destination);
    if (this.extraDestination) this.outputNode.connect(this.extraDestination);
    this.outputNode.connect(this.streamDestination);
    
    // Start recording
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        this.mediaRecorder = new MediaRecorder(this.streamDestination.stream, {
            mimeType: 'audio/webm;codecs=opus',
        });
    } else {
         this.mediaRecorder = new MediaRecorder(this.streamDestination.stream);
    }

    this.recordedChunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
        }
    };
    this.mediaRecorder.start();

    this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.outputNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.1);
  }

  public pause() {
    if (this.playbackState === 'playing') {
      this.audioContext.suspend();
      this.setPlaybackState('paused');
    }
  }

  public stop() {
    if (this.session) {
      this.session.stop();
      this.session.close();
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
    }
    this.recordedChunks = [];

    this.setPlaybackState('stopped');
    this.outputNode.gain.setValueAtTime(this.outputNode.gain.value, this.audioContext.currentTime);
    this.outputNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);
    this.nextStartTime = 0;
    this.session = null;
    this.sessionPromise = null;
    this.outputNode.disconnect();
    this.outputNode = this.audioContext.createGain();
  }

  public async playPause() {
    switch (this.playbackState) {
      case 'playing':
        return this.pause();
      case 'paused':
        return this.play();
      case 'stopped':
        return this.play(this.currentPrompt);
      case 'loading':
        return this.stop();
    }
  }
  
  public get activePrompts() {
    return this.currentPrompt ? [this.currentPrompt] : [];
  }

  public setVolume(level: number) {
    if (this.outputNode) {
      this.outputNode.gain.setValueAtTime(level, this.audioContext.currentTime);
    }
  }

  public download(trackTitle: string) {
    if (this.recordedChunks.length === 0) {
        this.dispatchEvent(new CustomEvent('error', { detail: 'No audio recorded yet. Please wait a moment.' }));
        return;
    }

    const blob = new Blob(this.recordedChunks, {
        type: this.mediaRecorder?.mimeType || 'audio/webm',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    const safeTitle = trackTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${safeTitle || 'study-music'}.webm`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }
}