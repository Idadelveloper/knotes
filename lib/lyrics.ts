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
  manualTopics?: string; // user-provided topics/areas to cover
  // Expanded lyric controls
  toneMood?: string; // Calm, Energetic, etc.
  persona?: string; // Student, Narrator, Teacher, Rapper, Storyteller
  creativityLevel?: number; // 0-100
  complexity?: number; // 1-5
  addHumor?: boolean;
  learningIntent?: string[]; // Summarize, Define, Reinforce, Mnemonic, Story-based
  focusTopics?: string[]; // keywords
  repetitionLevel?: number; // 0-100
  lyricLength?: 'short'|'medium'|'long'|'full';
  factualAccuracy?: number; // 0-100 (poetic ↔ academic)
  // Math mode options (optional)
  mathMode?: boolean;
  formulaStyle?: 'Spoken'|'Sung'|'Simplified';
  equationFrequency?: number; // 0-100
  symbolPronunciation?: 'Phonetic'|'Literal';
  formulaMnemonics?: boolean;
  conceptRhymes?: boolean;
  stepByStep?: boolean;
  callAndResponse?: boolean;
  addSimpleExamples?: boolean;
  strictFormulaPreservation?: boolean;
}): Promise<string> {
  const { notes, genre, mood, tempoBpm, energy, instruments = [], style, singer, totalLengthSec, maxLines, manualTopics } = params;

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

  const manual = (manualTopics && manualTopics.trim()) ? `\nPriority topics to include (verbatim concepts, woven naturally):\n${manualTopics.trim()}\n` : '';

  // Additional knobs
  const personaLine = params.persona ? `Persona/Voice: ${params.persona}.` : '';
  const creativityLine = typeof params.creativityLevel === 'number' ? `Creativity: ${Math.round(params.creativityLevel)} (0=factual,100=highly creative).` : '';
  const complexityLine = typeof params.complexity === 'number' ? `Lyrical complexity/depth: ${params.complexity}/5.` : '';
  const humorLine = params.addHumor ? `Add light, appropriate humor when suitable.` : '';
  const learningIntentLine = (params.learningIntent && params.learningIntent.length) ? `Learning intent: ${params.learningIntent.join(', ')}.` : '';
  const focusTopicsLine = (params.focusTopics && params.focusTopics.length) ? `Must-include keywords: ${params.focusTopics.join(', ')}.` : '';
  const repetitionLine = typeof params.repetitionLevel === 'number' ? `Repetition: ${Math.round(params.repetitionLevel)} (repeat key ideas accordingly).` : '';
  const lengthLine = params.lyricLength ? `Lyric length: ${params.lyricLength}.` : '';
  const factualLine = typeof params.factualAccuracy === 'number' ? `Factual accuracy preference: ${Math.round(params.factualAccuracy)} (0=poetic,100=academic).` : '';

  const mathBlock = params.mathMode ? `\nMath Optimization:\n- Formula style: ${params.formulaStyle || 'Spoken'}\n- Equation frequency: ${typeof params.equationFrequency === 'number' ? params.equationFrequency : 50}\n- Symbol pronunciation: ${params.symbolPronunciation || 'Phonetic'}\n- Mnemonics: ${params.formulaMnemonics ? 'Yes' : 'No'}; Concept rhymes: ${params.conceptRhymes ? 'Yes' : 'No'}; Step-by-step: ${params.stepByStep ? 'Yes' : 'No'}; Call-and-response: ${params.callAndResponse ? 'Yes' : 'No'}; Examples: ${params.addSimpleExamples ? 'Yes' : 'No'}\n- Strict formula preservation: ${params.strictFormulaPreservation ? 'ON' : 'OFF'}\n` : '';

  const constraints = `Avoid copyrighted lyrics and artist names. Keep it original. Favor short lines (max ~8-12 words). Include verses, a memorable chorus, and an optional bridge. Target around ${targetLines} lines in total to match the song length.${manual}\n${personaLine} ${creativityLine} ${complexityLine} ${humorLine} ${learningIntentLine} ${focusTopicsLine} ${repetitionLine} ${lengthLine} ${factualLine}${mathBlock}`;

  const context = `Notes context (main learning content only; ignore administrative meta like course/instructor, assignments, policies, due dates):\n\n${notes.slice(0, 5000)}`;

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
  manualTopics?: string;
  // Expanded music settings
  dynamicTempo?: boolean;
  beatType?: string;
  instrumentDensity?: number; // 0-100
  backgroundVocals?: boolean;
  effects?: string[]; // Reverb, Echo, Lo-fi Filter, Auto-tune
  vocalType?: string; // Male, Female, Robotic, Choir, Cartoonish
  vocalEmotion?: string; // Calm, Confident, Joyful, Chill
  vocalAccent?: string; // American, British, African, Asian
  layeredVocals?: number; // 1-5
  instrumentVariation?: boolean;
  songStructure?: string[]; // e.g., Intro, Verse, Chorus, Bridge
  // Math enhancements
  mathMode?: boolean;
  beatAlignment?: boolean;
  tempoSync?: boolean;
  keywordEmphasis?: boolean;
  autoChorusBuilder?: boolean;
  backgroundChants?: boolean;
}): string {
  const { notes, lyrics, genre, mood, tempoBpm, energy, instruments = [], singer, forceInstrumental, lyricStyle, durationSec, manualTopics } = params;

  // Helper to keep the final prompt under ElevenLabs 2000-char limit by trimming notes first
  const MAX_PROMPT = 2000;
  const parts: string[] = [];
  const g = genre.toLowerCase();
  parts.push(`Create a ${mood.toLowerCase()} ${g} song with ${energy.toLowerCase()} energy.`);
  parts.push('Important: Adhere strictly to the requested genre and mood. Do not deviate to other genres.');
  if (tempoBpm) parts.push(`Target tempo around ${tempoBpm} BPM.`);
  if (params.dynamicTempo) parts.push('Enable dynamic tempo changes aligned to content intensity.');
  if (typeof durationSec === 'number') {
    const m = Math.floor(durationSec / 60);
    const s = Math.round(durationSec % 60);
    parts.push(`Target song duration approximately ${m}m ${s}s.`);
  }
  if (instruments.length) parts.push(`Feature ${instruments.join(', ')}.`);
  if (params.beatType) parts.push(`Beat type: ${params.beatType}.`);
  if (typeof params.instrumentDensity === 'number') parts.push(`Instrument density: ${Math.round(params.instrumentDensity)} (0=sparse,100=full band).`);
  if (params.backgroundVocals) parts.push('Include tasteful background harmonies.');
  if (params.effects && params.effects.length) parts.push(`Effects to apply: ${params.effects.join(', ')}.`);
  if (params.vocalType) parts.push(`Vocal type: ${params.vocalType}.`);
  if (params.vocalEmotion) parts.push(`Vocal emotion: ${params.vocalEmotion}.`);
  if (params.vocalAccent) parts.push(`Vocal accent: ${params.vocalAccent}.`);
  if (typeof params.layeredVocals === 'number') parts.push(`Number of vocal layers: ${params.layeredVocals}.`);
  if (params.instrumentVariation) parts.push('Vary instruments across sections for interest.');
  if (params.songStructure && params.songStructure.length) parts.push(`Song structure: ${params.songStructure.join(' – ')}.`);
  if (params.mathMode) {
    parts.push('Math Mode Enhancements:');
    if (params.beatAlignment) parts.push('- Align beat to the rhythm of equations.');
    if (params.tempoSync) parts.push('- Slow down tempo slightly during complex formula parts for clarity.');
    if (params.keywordEmphasis) parts.push('- Emphasize key formulas/keywords with volume or pitch lifts.');
    if (params.autoChorusBuilder) parts.push('- Build a catchy chorus around the main formula or concept.');
    if (params.backgroundChants) parts.push('- Add supportive background chants repeating key terms.');
  }

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
  if (manualTopics && manualTopics.trim()) {
    parts.push('Priority topics to cover (use these concepts explicitly):');
    parts.push(manualTopics.trim());
  }
  parts.push('Focus lyrical content and themes on the following key notes/topics:');

  // We will trim notes to fit within the max prompt size
  const header = parts.join('\n') + '\n';
  const remaining = Math.max(0, MAX_PROMPT - header.length - 1);
  const notesTrimmed = notes.slice(0, Math.min(1800, remaining));
  const final = header + notesTrimmed;
  return final;
}
