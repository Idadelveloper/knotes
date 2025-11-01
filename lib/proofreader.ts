// Chrome Proofreader API integration with fallback profanity masking
// Client-side utilities, SSR-safe

'use client';

export type ProofreaderAvailability = 'available' | 'downloadable' | 'unavailable';

function getWindow(): any | null {
  if (typeof window === 'undefined') return null;
  return window as any;
}

export async function getProofreaderAvailability(): Promise<ProofreaderAvailability> {
  const g = getWindow();
  if (!g || !('Proofreader' in g)) return 'unavailable';
  try {
    const availability: ProofreaderAvailability = await g.Proofreader.availability();
    return availability;
  } catch {
    return 'unavailable';
  }
}

export async function isProofreaderUsable(): Promise<boolean> {
  const a = await getProofreaderAvailability();
  return a === 'available' || a === 'downloadable';
}

export interface CreateProofreaderOptions {
  expectedInputLanguages?: string[];
}

export async function createProofreader(opts?: CreateProofreaderOptions, hooks?: { onDownloadStart?: () => void; onDownloadProgress?: (loadedFraction: number) => void; }): Promise<any | null> {
  const g = getWindow();
  if (!g || !('Proofreader' in g)) return null;

  const base: any = {
    expectedInputLanguages: opts?.expectedInputLanguages ?? ['en'],
  };

  const availability = await getProofreaderAvailability();
  if (availability === 'unavailable') return null;

  if (availability === 'available') {
    return g.Proofreader.create(base);
  }
  return g.Proofreader.create({
    ...base,
    monitor(m: any) {
      try { hooks?.onDownloadStart?.(); } catch {}
      try {
        m.addEventListener('downloadprogress', (e: any) => {
          try { hooks?.onDownloadProgress?.(Number(e.loaded) || 0); } catch {}
        });
      } catch {}
    },
  });
}

export interface ProofreadResult {
  corrected: string;
  corrections?: Array<{ startIndex: number; endIndex: number; replacement: string; label?: string }>;
  used: 'proofreader' | 'fallback';
}

// Simple profanity masker fallback: masks inner characters of listed words (case-insensitive)
const DEFAULT_PROFANITY = [
  // broad but not exhaustive; minimal for safety without being overzealous
  'fuck','shit','bitch','asshole','bastard','dick','pussy','cunt','slut','whore','niga','nigger','retard','faggot','damn','crap',
];

function maskWord(word: string): string {
  if (word.length <= 2) return '*'.repeat(word.length);
  return word[0] + '*'.repeat(Math.max(1, word.length - 2)) + word[word.length - 1];
}

export function maskProfanity(input: string, customList?: string[]): { text: string; masked: boolean } {
  const list = (customList && customList.length ? customList : DEFAULT_PROFANITY).map(w => w.toLowerCase());
  // Build a regex that matches whole words disregarding punctuation boundaries
  const pattern = new RegExp(`\\b(${list.map(w => w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');
  let masked = false;
  const text = input.replace(pattern, (m) => { masked = true; return maskWord(m); });
  return { text, masked };
}

export async function proofreadText(input: string): Promise<ProofreadResult> {
  const g = getWindow();
  try {
    if (await isProofreaderUsable()) {
      const pr = await createProofreader({ expectedInputLanguages: ['en'] });
      if (pr) {
        const out = await pr.proofread(String(input || ''));
        // out has .correction (string) and .corrections (array)
        const corrected: string = String(out?.correction ?? out?.corrected ?? input ?? '');
        const corrections = Array.isArray(out?.corrections) ? out.corrections : undefined;
        pr.destroy?.();
        return { corrected, corrections, used: 'proofreader' };
      }
    }
  } catch (e) {
    try { console.warn('[Proofreader] failed, using fallback:', e); } catch {}
  }
  // fallback just returns input
  return { corrected: String(input || ''), used: 'fallback' };
}

// High-level: correct grammar via Proofreader if available, then mask profanity
export async function sanitizeLyrics(input: string): Promise<{ text: string; masked: boolean; used: 'proofreader' | 'fallback' }>{
  const pr = await proofreadText(input);
  const { text, masked } = maskProfanity(pr.corrected);
  return { text, masked, used: pr.used };
}
