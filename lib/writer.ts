// Chrome Writer API integration for generating creative track names
// Client-side only utilities, SSR-safe

'use client';

import { getGeminiModel } from './ai';

export type WriterTone = 'formal' | 'neutral' | 'casual';
export type WriterFormat = 'markdown' | 'plain-text';
export type WriterLength = 'short' | 'medium' | 'long';

export type WriterAvailability = 'available' | 'downloadable' | 'unavailable';

export interface WriterOptions {
  tone?: WriterTone;
  format?: WriterFormat;
  length?: WriterLength;
  sharedContext?: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
}

export interface GenerateTrackNameParams {
  description: string; // short description of the music (feel/prompt)
  context?: string; // optional additional context
  options?: WriterOptions; // writer options override
  onDownloadStart?: () => void;
  onDownloadProgress?: (loadedFraction: number) => void; // 0..1
}

function getWindow(): any | null {
  if (typeof window === 'undefined') return null;
  return window as any;
}

export async function getWriterAvailability(): Promise<WriterAvailability> {
  const g = getWindow();
  if (!g || !('Writer' in g)) return 'unavailable';
  try {
    const availability: WriterAvailability = await g.Writer.availability();
    return availability;
  } catch {
    return 'unavailable';
  }
}

export async function isWriterUsable(): Promise<boolean> {
  const a = await getWriterAvailability();
  return a === 'available' || a === 'downloadable';
}

async function createWriter(opts?: WriterOptions, hooks?: { onDownloadStart?: () => void; onDownloadProgress?: (loadedFraction: number) => void; }): Promise<any | null> {
  const g = getWindow();
  if (!g || !('Writer' in g)) return null;
  const base: any = {
    tone: opts?.tone ?? 'neutral',
    format: opts?.format ?? 'plain-text',
    length: opts?.length ?? 'short',
    sharedContext: opts?.sharedContext ?? 'Generate a short, creative title for a piece of instrumental background music used for studying. No quotes, 2–6 words.',
    expectedInputLanguages: opts?.expectedInputLanguages ?? ['en'],
    expectedContextLanguages: opts?.expectedContextLanguages ?? ['en'],
    outputLanguage: opts?.outputLanguage ?? 'en',
  };

  const availability = await getWriterAvailability();
  if (availability === 'unavailable') return null;

  const withMonitor = (extra?: any) => ({
    ...base,
    ...(extra || {}),
    monitor(m: any) {
      try { hooks?.onDownloadStart?.(); } catch {}
      m.addEventListener('downloadprogress', (e: any) => {
        try { hooks?.onDownloadProgress?.(Number(e.loaded) || 0); } catch {}
      });
    },
  });

  if (availability === 'available') {
    return g.Writer.create(base);
  }
  // downloadable
  return g.Writer.create(withMonitor());
}

export async function generateTrackName(params: GenerateTrackNameParams): Promise<{ title: string; used: 'writer' | 'gemini' | 'fallback'; }> {
  const { description, context, options, onDownloadProgress, onDownloadStart } = params;
  const input = description?.trim();
  const ctx = context ?? 'Return only the title text, without quotes, emojis, or trailing punctuation.';

  // Try Writer API first
  try {
    if (await isWriterUsable()) {
      const writer = await createWriter(options, { onDownloadProgress, onDownloadStart });
      if (writer) {
        const out: string = await writer.write(
          `Create a creative, evocative title for an instrumental background study track based on this description: ${input}`,
          { context: ctx },
        );
        writer.destroy?.();
        const cleaned = (out || '').split('\n')[0].trim().replace(/^"|"$/g, '');
        if (cleaned) return { title: cleaned, used: 'writer' };
      }
    }
  } catch (e) {
    console.warn('[Writer] generateTrackName failed, falling back to Gemini:', e);
  }

  // Fallback to Gemini (if configured) – keep identical behavior to prior flow
  try {
    const model = getGeminiModel();
    const prompt = `Generate a short, creative music track title (2–6 words) for instrumental background study music. No quotes or punctuation at the end.\nDescription: ${input}`;
    const res = await model.generateContent(prompt);
    const txt = (res?.response?.text?.() as string) || '';
    const cleaned = (txt || '').split('\n')[0].trim().replace(/^"|"$/g, '');
    if (cleaned) return { title: cleaned, used: 'gemini' };
  } catch {}

  // Final fallback
  const simple = input.split(/[.,]/)[0].trim();
  return { title: simple || 'Generated Track', used: 'fallback' };
}
