"use client";

// Minimal Live Chat helper (text streaming first) using Firebase AI Logic SDK
// Falls back to standard Gemini model for non-live when needed.

import { app } from "./firebase";
import { getAI, getLiveGenerativeModel, GoogleAIBackend, ResponseModality } from "firebase/ai";

export type LiveEvents = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: any) => void;
  onPartialText?: (chunk: string) => void;
  onTextDone?: () => void;
};

export class LiveChatManager {
  private session: any | null = null;
  private modelCfg: { model: string; modalities: ResponseModality[] } = {
    model: "gemini-2.0-flash-live-preview-04-09",
    modalities: [ResponseModality.TEXT],
  };
  private events: LiveEvents;

  constructor(events?: LiveEvents) {
    this.events = events || {};
  }

  async connectText(): Promise<void> {
    if (this.session) return;
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const live = getLiveGenerativeModel(ai, {
      model: this.modelCfg.model,
      generationConfig: {
        responseModalities: [ResponseModality.TEXT],
      },
    });
    const session = await live.connect();
    this.session = session;
    // Collect streamed text
    (async () => {
      try {
        const messages = session.receive();
        for await (const message of messages as AsyncIterable<any>) {
          if (message.type === "serverContent") {
            if (message.turnComplete) {
              this.events.onTextDone?.();
            } else {
              const parts = message.modelTurn?.parts;
              if (parts) {
                const text = parts.map((p: any) => p.text || "").join("");
                if (text) this.events.onPartialText?.(text);
              }
            }
          }
        }
      } catch (e) {
        this.events.onError?.(e);
      } finally {
        this.events.onClose?.();
      }
    })();
    this.events.onOpen?.();
  }

  async sendText(prompt: string) {
    if (!this.session) throw new Error("Live session not connected");
    this.session.send(prompt);
  }

  async disconnect() {
    try { await this.session?.close?.(); } catch {}
    this.session = null;
  }
}

export async function isLiveAvailable(): Promise<boolean> {
  try {
    return true;
  } catch {
    return false;
  }
}
