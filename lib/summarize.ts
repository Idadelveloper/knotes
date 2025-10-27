'use client';

// Chrome Summarizer API integration with graceful fallback to Firebase AI Logic (Gemini)
// Client-side only utilities

import { getGeminiModel } from './ai';

export type SummarizeType = 'key-points' | 'tldr' | 'teaser' | 'headline';
export type SummarizeFormat = 'markdown' | 'plain-text';
export type SummarizeLength = 'short' | 'medium' | 'long';

export type SummarizeOptions = {
  // Summarizer.create() options
  sharedContext?: string;
  type?: SummarizeType; // default: 'key-points'
  format?: SummarizeFormat; // default: 'markdown'
  length?: SummarizeLength; // default: 'medium'
  expectedInputLanguages?: string[]; // e.g., ['en','ja']
  expectedContextLanguages?: string[]; // e.g., ['en']
  outputLanguage?: string; // e.g., 'es'

  // Per-request options
  context?: string; // request-specific background

  // Monitoring callbacks for on-device model download
  onDownloadStart?: () => void;
  onDownloadProgress?: (loaded: number, total?: number) => void;
};

export type SummarizeResult = {
  text: string;
  used: 'summarizer' | 'gemini';
};

/** Checks if built‑in Summarizer API is available. */
export async function isSummarizerAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const g: any = window as any;
  if (!('Summarizer' in g)) return false;
  try {
    const availability = await g.Summarizer.availability();
    return availability === 'available' || availability === 'downloadable';
  } catch {
    return false;
  }
}

/**
 * Summarizes text using Chrome's built‑in Summarizer API when available; falls back to Gemini.
 */
export async function summarizeText(input: string, opts: SummarizeOptions = {}): Promise<SummarizeResult> {
  const g: any = typeof window !== 'undefined' ? (window as any) : undefined;

  // Attempt built-in Summarizer
  if (g && 'Summarizer' in g) {
    try {
      // Optional availability check (also triggers downloadable state resolution)
      await g.Summarizer.availability().catch(() => undefined);

      const summarizer = await g.Summarizer.create({
        sharedContext: opts.sharedContext,
        type: opts.type || 'key-points',
        format: opts.format || 'markdown',
        length: opts.length || 'medium',
        expectedInputLanguages: opts.expectedInputLanguages,
        expectedContextLanguages: opts.expectedContextLanguages,
        outputLanguage: opts.outputLanguage,
        monitor(m: any) {
          try {
            opts.onDownloadStart?.();
            m.addEventListener('downloadprogress', (e: any) => {
              try { opts.onDownloadProgress?.(e.loaded, e.total); } catch {}
            });
          } catch {}
        },
      });

      const output: string = await summarizer.summarize(input, {
        context: opts.context,
      });

      return {
        text: (output || '').trim(),
        used: 'summarizer',
      };
    } catch (e) {
      console.warn('[summarize] Summarizer API failed, falling back to Gemini:', e);
    }
  }

  // Fallback: Gemini model
  const model = getGeminiModel();
  // Build a prompt based on provided options to mimic types/length/format
  const type = opts.type || 'key-points';
  const length = opts.length || 'medium';
  const format = opts.format || 'markdown';

  let instruction = '';
  switch (type) {
    case 'tldr':
      instruction = 'Provide a concise TL;DR summary';
      break;
    case 'teaser':
      instruction = 'Provide an intriguing teaser that highlights the most interesting parts';
      break;
    case 'headline':
      instruction = 'Provide a single-sentence headline capturing the main point';
      break;
    default:
      instruction = 'Extract the key points as bullet points';
  }

  const lengthSpec: Record<SummarizeLength, string> = {
    short: 'short',
    medium: 'medium length',
    long: 'longer',
  };

  const fmtSpec = format === 'markdown' ? 'Use Markdown formatting.' : 'Return plain text without Markdown.';

  const prompt = `${instruction} of the provided text at ${lengthSpec[length]}.
${fmtSpec}
${opts.sharedContext ? `Shared context: ${opts.sharedContext}\n` : ''}${opts.context ? `Request context: ${opts.context}\n` : ''}
Return only the summary.
\nText to summarize:\n"""\n${input}\n"""`;

  const res = await model.generateContent(prompt);
  const txt = res?.response?.text?.() ?? '';
  return {
    text: (txt || '').trim() || input,
    used: 'gemini',
  };
}
