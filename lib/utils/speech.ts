/* Simple Speech Synthesis helpers for consistent voice replies across browsers */

export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number; // 0..1
  lang?: string;
  voiceName?: string; // exact match if provided
};

const voicesReady = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window &&
  Array.isArray(window.speechSynthesis.getVoices()) && window.speechSynthesis.getVoices().length > 0;

async function waitForVoices(timeoutMs = 1500): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (voicesReady()) return;
  await new Promise<void>((resolve) => {
    const start = Date.now();
    const handler = () => resolveCleanup();
    const resolveCleanup = () => {
      try { window.speechSynthesis.removeEventListener?.('voiceschanged', handler as any); } catch {}
      resolve();
    };
    try { window.speechSynthesis.addEventListener?.('voiceschanged', handler as any); } catch {}
    const check = () => {
      if (voicesReady() || Date.now() - start > timeoutMs) resolveCleanup();
      else setTimeout(check, 100);
    };
    check();
  });
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  try { if (canSpeak()) { window.speechSynthesis.cancel(); } } catch {}
}

function chooseVoice(opts?: SpeakOptions): SpeechSynthesisVoice | null {
  if (!canSpeak()) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  if (opts?.voiceName) {
    const exact = voices.find(v => v.name === opts.voiceName);
    if (exact) return exact;
  }
  const lang = opts?.lang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
  const byLang = voices.find(v => v.lang?.toLowerCase().startsWith(lang.toLowerCase()));
  if (byLang) return byLang;
  // Prefer an English fallback
  return voices.find(v => v.lang?.toLowerCase().startsWith('en')) || voices[0] || null;
}

function plainText(from: string): string {
  // Strip HTML tags quickly
  const noHtml = from.replace(/<[^>]*>/g, ' ');
  // Replace some markdown patterns with spaces
  return noHtml
    .replace(/[`*_#>-]+/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function speak(text: string, opts?: SpeakOptions): Promise<void> {
  if (!canSpeak()) throw new Error('Speech synthesis not supported');
  await waitForVoices();
  // Attempt to resume in case of paused state (Safari/iOS quirks)
  try { window.speechSynthesis.resume(); } catch {}

  const utter = new SpeechSynthesisUtterance(plainText(text));
  const voice = chooseVoice(opts || {});
  if (voice) utter.voice = voice;
  utter.rate = opts?.rate ?? 1.0;
  utter.pitch = opts?.pitch ?? 1.0;
  utter.volume = opts?.volume ?? 1.0;
  if (voice?.lang) utter.lang = voice.lang;

  return new Promise<void>((resolve, reject) => {
    utter.onend = () => resolve();
    utter.onerror = (e) => reject(e);
    try {
      window.speechSynthesis.cancel(); // stop any prior speech
      window.speechSynthesis.speak(utter);
    } catch (e) {
      reject(e);
    }
  });
}
