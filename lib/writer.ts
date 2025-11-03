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
    sharedContext: opts?.sharedContext ?? 'Generate exactly one short, creative title for a study song with vocals. Strictly output only the title text on a single line. Do not include quotes, lists, numbering, or extra commentary. 2–6 words.',
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

export async function generateTrackName(params: GenerateTrackNameParams): Promise<{ title: string; used: 'writer' | 'firebase' | 'fallback'; }> {
  const { description, context, options, onDownloadProgress, onDownloadStart } = params;
  const input = description?.trim();
  const strictCtx = 'Output exactly one track title on a single line. No lists, no numbering, no quotes, no emojis, no commentary.';
  const ctx = context ? `${strictCtx}\n${context}` : strictCtx;

  function cleanTitle(raw: string): string {
    const text = String(raw || '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^here are.*$/i, '')
      .replace(/^title options?:.*$/i, '')
      .trim();
    const firstLine = text.split(/\r?\n/).map(s => s.replace(/^[-*•\d).\s]+/, '').trim()).filter(Boolean)[0] || '';
    let t = firstLine.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    t = t.replace(/[\s]+/g, ' ').trim();
    t = t.replace(/[\.:;,!]+$/g, '');
    // keep it reasonably short
    if (t.length > 80) t = t.slice(0, 80).trim();
    return t;
  }

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
        const cleaned = cleanTitle(out);
        if (cleaned) return { title: cleaned, used: 'writer' };
      }
    }
  } catch (e) {
    console.warn('[Writer] generateTrackName failed, Writer unavailable or error:', e);
  }

  // Firebase AI Logic fallback via getGeminiModel
  try {
    const model = getGeminiModel('gemini-2.0-flash-lite');
    const prompt = `Generate exactly one short, creative music track title (2–6 words). Return only the title text on a single line. No lists, no numbering, no quotes, no emojis, no commentary.\nDescription: ${input}`;
    const res = await model.generateContent(prompt as any);
    const txt = (res?.response?.text?.() as string) || '';
    const cleaned = cleanTitle(txt);
    if (cleaned) return { title: cleaned, used: 'firebase' };
  } catch {}

  // Final fallback if both Writer and Firebase AI fail
  const simple = (input || '').split(/[\n\r\.]/)[0].trim();
  return { title: simple || 'Generated Track', used: 'fallback' };
}
