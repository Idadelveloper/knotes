'use client';

// Chrome Translator API integration with graceful fallback to Firebase AI Logic (Gemini)
// Client-side only utilities

import { getGeminiModel } from './ai';

export type TranslateOptions = {
  sourceLanguage?: string; // BCP‑47 (e.g., 'en') — if omitted, we try LanguageDetector
  onDownloadStart?: () => void;
  onDownloadProgress?: (loaded: number, total?: number) => void;
};

export type TranslateResult = {
  text: string;
  used: 'translator' | 'gemini';
  sourceLanguage: string;
  targetLanguage: string;
};

/** Checks if built‑in Translator API is available (optionally for a language pair). */
export async function isTranslatorAvailable(sourceLanguage?: string, targetLanguage?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const g: any = window as any;
  if (!('Translator' in g)) return false;
  try {
    if (sourceLanguage && targetLanguage) {
      const availability = await g.Translator.availability({ sourceLanguage, targetLanguage });
      return availability === 'available' || availability === 'downloadable';
    }
    // No pair specified — check general availability signal
    const availability = await g.Translator.availability();
    return availability === 'available' || availability === 'downloadable';
  } catch {
    return false;
  }
}

/**
 * Translates text using Chrome's built‑in Translator API when available; falls back to Gemini.
 */
export async function translateText(input: string, targetLanguage: string, opts: TranslateOptions = {}): Promise<TranslateResult> {
  const g: any = typeof window !== 'undefined' ? (window as any) : undefined;
  let sourceLanguage = opts.sourceLanguage || 'en';

  // Try LanguageDetector to get a better source language
  if (g && 'LanguageDetector' in g && !opts.sourceLanguage) {
    try {
      const detector = await g.LanguageDetector.create();
      const detected = await detector.detect(input.slice(0, 4000));
      if (Array.isArray(detected) && detected[0]?.detectedLanguage) {
        sourceLanguage = detected[0].detectedLanguage;
      }
    } catch {
      // ignore detection errors; default stays
    }
  }

  // Attempt built-in Translator
  if (g && 'Translator' in g) {
    try {
      // Optionally report availability; not strictly needed before create()
      await g.Translator.availability({ sourceLanguage, targetLanguage }).catch(() => undefined);

      const translator = await g.Translator.create({
        sourceLanguage,
        targetLanguage,
        monitor(m: any) {
          try {
            opts.onDownloadStart?.();
            m.addEventListener('downloadprogress', (e: any) => {
              try { opts.onDownloadProgress?.(e.loaded, e.total); } catch {}
            });
          } catch {}
        },
      });
      const out: string = await translator.translate(input);
      return {
        text: (out || '').trim(),
        used: 'translator',
        sourceLanguage,
        targetLanguage,
      };
    } catch (e) {
      console.warn('[translate] Translator API failed, falling back to Gemini:', e);
    }
  }

  // Fallback: Gemini model
  const model = getGeminiModel();
  const prompt = `Translate the following text to ${targetLanguage}. Preserve meaning and key terms. Return only the translation.\n\nText:\n"""\n${input}\n"""`;
  const res = await model.generateContent(prompt);
  const txt = res?.response?.text?.() ?? '';
  return {
    text: (txt || '').trim() || input,
    used: 'gemini',
    sourceLanguage,
    targetLanguage,
  };
}
