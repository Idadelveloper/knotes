'use client';

import { getGeminiModel } from './ai';
import { isWriterUsable } from './writer';

export type LyricsStyle = 'summary' | 'educational' | 'mix';

export async function generateLyricsFromNotes(params: {
  notes: string;
  genre: string;
  mood: string;
  tempoBpm?: number;
  energy: string;
  instruments?: string[];
  style: LyricsStyle;
  singer: string;
  totalLengthSec?: number; // desired song length in seconds to inform lyric length
  maxLines?: number;
}): Promise<string> {
  const { notes, genre, mood, tempoBpm, energy, instruments = [], style, singer, totalLengthSec, maxLines } = params;

  // Estimate a target number of lines from length and tempo
  const baseLpm = 16; // lines per minute baseline
  const tempoFactor = tempoBpm ? Math.max(0.7, Math.min(1.5, Math.sqrt(tempoBpm / 90))) : 1;
  const targetLinesFromLen = totalLengthSec ? Math.round((totalLengthSec / 60) * baseLpm * tempoFactor) : undefined;
  const targetLines = Math.max(12, Math.min(64, (maxLines ?? targetLinesFromLen ?? 28)));

  const baseInstruction = style === 'summary'
    ? 'Summarize the key ideas poetically in simple, repeatable lines.'
    : style === 'educational'
      ? 'Teach the concepts with clear, mnemonic-friendly lines.'
      : 'Blend concise summary with lightly instructional phrasing.';

  const constraints = `Avoid copyrighted lyrics and artist names. Keep it original. Favor short lines (max ~8-12 words). Include verses, a memorable chorus, and an optional bridge. Target around ${targetLines} lines in total to match the song length.`;

  const context = `Notes context (may include markdown):\n\n${notes.slice(0, 5000)}`;

  // Try Chrome Writer first for lyric drafting if available; otherwise Gemini/Firebase via getGeminiModel.
  try {
    const g: any = typeof window !== 'undefined' ? window : null;
    if (g && 'Writer' in g) {
      try {
        const writer: any = await g.Writer.create({
          tone: 'neutral',
          format: 'plain-text',
          length: 'long',
          sharedContext: 'You are drafting clean, original song lyrics (no copyrighted material).'
        });
        const out: string = await writer.write(
          `Draft lyrics for a study song. ${baseInstruction}\nImportant: Adhere strictly to the requested genre and mood; do not drift into other genres.\nGenre: ${genre}. Mood: ${mood}. Energy: ${energy}. ${tempoBpm ? `Tempo ~${tempoBpm} BPM. ` : ''}${instruments.length ? `Instruments: ${instruments.join(', ')}. ` : ''}Vocal style: ${singer}. ${constraints}\n\n${context}`,
          { context: 'Return only the lyrics with clear sections and short lines.' }
        );
        writer.destroy?.();
        if (out && out.trim().length > 0) return out.trim();
      } catch {}
    }
    const model = getGeminiModel('gemini-2.5-flash');
    const prompt = `Write song lyrics intended for AI music generation with vocals. ${baseInstruction}\n\nGenre: ${genre}\nMood: ${mood}\nEnergy: ${energy}\n${tempoBpm ? `Tempo: ~${tempoBpm} BPM\n` : ''}${instruments.length ? `Instruments to feature: ${instruments.join(', ')}\n` : ''}Vocal style: ${singer}.\n${constraints}\n\n${context}\n\nReturn only the lyrics text, formatted with line breaks and blank lines between sections (Verse/Chorus/Bridge).`;
    const res = await model.generateContent(prompt);
    const txt = (res?.response?.text?.() as string) || '';
    return txt.trim();
  } catch (e) {
    // Minimal fallback – return empty (instrumental)
    return '';
  }
}

export function buildMusicPromptFromControls(params: {
  notes: string;
  lyrics?: string;
  genre: string;
  mood: string;
  tempoBpm?: number;
  energy: string;
  instruments?: string[];
  singer: string;
  forceInstrumental?: boolean;
  lyricStyle?: LyricsStyle;
  durationSec?: number;
}): string {
  const { notes, lyrics, genre, mood, tempoBpm, energy, instruments = [], singer, forceInstrumental, lyricStyle, durationSec } = params;

  // Helper to keep the final prompt under ElevenLabs 2000-char limit by trimming notes first
  const MAX_PROMPT = 2000;
  const parts: string[] = [];
  const g = genre.toLowerCase();
  parts.push(`Create a ${mood.toLowerCase()} ${g} song with ${energy.toLowerCase()} energy.`);
  parts.push('Important: Adhere strictly to the requested genre and mood. Do not deviate to other genres.');
  if (tempoBpm) parts.push(`Target tempo around ${tempoBpm} BPM.`);
  if (typeof durationSec === 'number') {
    const m = Math.floor(durationSec / 60);
    const s = Math.round(durationSec % 60);
    parts.push(`Target song duration approximately ${m}m ${s}s.`);
  }
  if (instruments.length) parts.push(`Feature ${instruments.join(', ')}.`);

  // Genre-specific guidance to help the model follow the style more reliably
  const genreHints: Record<string, string> = {
    'afrobeats': 'Use syncopated Afrobeat/Afrobeats rhythms, West African-inspired percussion (congas, shakers), off-beat hi-hats, log drums (Amapiano influence optional), warm bass grooves, and call-and-response feel. Avoid EDM drops or trap-style 808 patterns.',
    'lo-fi chill': 'Use dusty hip-hop drums, vinyl crackle, soft Rhodes/piano chords, gentle sidechain, mellow bass. Avoid bright EDM leads or aggressive drums.',
    'edm / dance': 'Use four-on-the-floor kick pattern, sidechained synth pads, energetic risers, bright leads, and modern club mix. Avoid jazz or acoustic textures.',
    'hip-hop / rap': 'Use swung hip-hop drums, punchy snares, 808 or sub bass, sparse melodic motifs. Avoid upbeat pop chords or EDM supersaws.',
    'jazz / soul': 'Use extended chords (7ths/9ths), swung grooves, walking bass or soulful keys/guitar. Avoid heavy electronic elements.',
    'acoustic': 'Use acoustic guitar/piano, minimal percussion, natural room feel. Avoid electronic synths and heavy processing.',
    'pop': 'Use catchy hooks, clean modern production, balanced drums and bass, and clear structure with verses and big choruses.'
  };
  const hint = genreHints[g];
  if (hint) parts.push(`Style hints: ${hint}`);

  if (forceInstrumental) {
    parts.push('Keep it strictly instrumental without vocals.');
  } else if (lyrics && lyrics.trim()) {
    parts.push('Generate a song with vocals using the provided lyrics. Sing the exact lines (allowing only minor musical repetitions like hooks/ad-libs). Do not invent new lines.');
    if (lyricStyle) parts.push(`Lyric style: ${lyricStyle}.`);
    parts.push(`Vocal timbre/voice style: ${singer}.`);
    parts.push('Provided lyrics:');
    parts.push(lyrics.trim());
  } else {
    parts.push(`Include tasteful, simple vocals. Vocal timbre/voice style: ${singer}.`);
  }
  parts.push('Do not reference specific artists or copyrighted works.');
  parts.push('Ensure a clear musical structure (intro, verse, chorus, bridge, outro as needed).');
  parts.push('Focus lyrical content and themes on the following key notes/topics:');

  // We will trim notes to fit within the max prompt size
  const header = parts.join('\n') + '\n';
  const remaining = Math.max(0, MAX_PROMPT - header.length - 1);
  const notesTrimmed = notes.slice(0, Math.min(1800, remaining));
  const final = header + notesTrimmed;
  return final;
}
