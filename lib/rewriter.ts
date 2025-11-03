'use client';

import { getGeminiModel } from './ai';

type RewriteOptions = {
  sharedContext?: string;
  tone?: 'more-formal' | 'as-is' | 'more-casual';
  format?: 'as-is' | 'markdown' | 'plain-text';
  length?: 'shorter' | 'as-is' | 'longer';
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
};

export async function isRewriterAvailable() {
  if (typeof window === 'undefined') return false;
  const g: any = window as any;
  if (!('Rewriter' in g)) return false;
  try {
    const availability = await (g as any).Rewriter.availability();
    return availability === 'available' || availability === 'downloadable';
  } catch {
    return false;
  }
}

export async function rewriteText(input: string, options?: RewriteOptions): Promise<{ text: string; used: 'rewriter' | 'gemini' }> {
  const context = options?.sharedContext ?? 'Restructure these study notes into clean, well-organized Markdown suitable for studying. Use clear headings (##, ###), bullet/numbered lists, and tables when needed. Math is already rendered using KaTex. For diagrams/flows, include Mermaid fenced code blocks (```mermaid ... ```). Keep original meaning. Return ONLY the Markdown, no extra commentary. Ditch the markdown/text (\`\`\`markdown or \`\`\`text) opening and closing backticks wrapping the entire output and return ONLY the Markdown formatted text.';
  if (await isRewriterAvailable()) {
    try {
      const g: any = window as any;
      const available = await g.Rewriter.availability();
      let rewriter: any;
      const baseOpts = {
        tone: options?.tone ?? 'as-is',
        format: options?.format ?? 'markdown',
        length: options?.length ?? 'as-is',
        sharedContext: context,
        expectedInputLanguages: options?.expectedInputLanguages ?? ['en'],
        expectedContextLanguages: options?.expectedContextLanguages ?? ['en'],
        outputLanguage: options?.outputLanguage ?? 'en',
        monitor(m: any) {
          m.addEventListener('downloadprogress', (e: any) => {
            try { console.log('[Rewriter] downloadprogress', e.loaded, e.total); } catch {}
          });
        },
      } as any;
      rewriter = await g.Rewriter.create(baseOpts);
      const result: string = await rewriter.rewrite(input, { context });
      rewriter.destroy?.();
      if (result && result.trim().length > 0) {
        try { console.log('[Rewriter] Output (first 500 chars):', result.slice(0, 500)); } catch {}
        return { text: result.trim(), used: 'rewriter' };
      }
    } catch (e) {
      console.warn('[Rewriter] Failed, falling back to Gemini:', e);
    }
  }
  // Fallback to Gemini model rewrite
  const model = getGeminiModel();
  const prompt = `${context}\n\nInput Notes:\n"""\n${input}\n"""`;
  const res = await model.generateContent(prompt);
  const text = res?.response?.text?.() ?? '';
  return { text: text.trim() || input, used: 'gemini' };
}

export async function generateTitle(input: string): Promise<{ title: string; used: 'rewriter' | 'gemini' | 'heuristic' }>{
  // Rewriter to create a concise title
  if (await isRewriterAvailable()) {
    try {
      const g: any = window as any;
      const rewriter = await g.Rewriter.create({
        format: 'plain-text',
        length: 'shorter',
        tone: 'as-is',
        sharedContext: 'Generate a concise 3–7 word study note title. No punctuation at the end.',
        expectedInputLanguages: ['en'],
        outputLanguage: 'en',
      });
      const out: string = await rewriter.rewrite(input, {
        context: 'Return only the title text, no quotes.',
      });
      rewriter.destroy?.();
      const cleaned = (out || '').split('\n')[0].trim().replace(/^"|"$/g, '');
      if (cleaned) return { title: cleaned, used: 'rewriter' };
    } catch (e) {
      console.warn('[Rewriter] Title generation failed, fallback to Gemini:', e);
    }
  }
  // Gemini fallback
  try {
    const model = getGeminiModel();
    const prompt = `You are titling a set of study notes. Provide a concise 3–7 word title that captures the main topic. Return only the title.\n\nNotes:\n"""\n${input}\n"""`;
    const res = await model.generateContent(prompt);
    const txt = res?.response?.text?.() ?? '';
    const title = (txt || '').split('\n')[0].trim().replace(/^"|"$/g, '');
    if (title) return { title, used: 'gemini' };
  } catch {}
  // Heuristic fallback
  const firstLine = input.split(/\r?\n/).map(s => s.trim()).find(Boolean) || 'Study Notes';
  return { title: firstLine.slice(0, 80), used: 'heuristic' };
}
