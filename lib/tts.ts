// Client-side TTS helper with Gemini primary and ElevenLabs fallback
// Generates single-speaker audio from text and returns base64, data URL, Blob, and Object URL

'use client';

import { GoogleGenAI } from '@google/genai';

export type TTSOptions = {
  // Gemini options
  voiceName?: string; // one of the supported prebuilt voices (Gemini)
  model?: string; // default gemini-2.5-flash-preview-tts
  // ElevenLabs options
  elevenVoiceId?: string; // overrides env voice id
  elevenModelId?: string; // defaults to eleven_multilingual_v2
  elevenOutputFormat?: string; // defaults to mp3_44100_128
};

export type TTSResult = {
  base64: string;
  mimeType: string;
  dataUrl: string; // data:<mime>;base64,<data>
  blob: Blob;
  blobUrl: string; // object URL for immediate playback
  provider?: 'gemini' | 'elevenlabs';
};

function getGeminiApiKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    undefined
  );
}

function getElevenApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVEN_API_KEY || undefined;
}

function b64FromArrayBuffer(buf: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer for validation and Blob creation
function b64ToArrayBuffer(base64: string): ArrayBuffer {
  const byteString = atob(base64);
  const len = byteString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Basic validation to detect obviously invalid or empty audio payloads
function isValidAudio(buf: ArrayBuffer, mimeType: string): boolean {
  try {
    const minSize = 1024; // 1KB minimal sanity threshold
    if (!buf || buf.byteLength < minSize) return false;
    const u8 = new Uint8Array(buf);
    // MP3 signatures: 'ID3' or frame sync 0xFF 0xFB/F3/F2
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
      if (u8.length >= 3 && u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return true; // 'ID3'
      if (u8.length >= 2 && u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return true; // frame sync
      // Some streams may start with ID3v2.4 extended headers; already covered by 'ID3'
      return false;
    }
    // WAV signatures: 'RIFF' .... 'WAVE'
    if (mimeType.includes('wav') || mimeType.includes('wave') || mimeType.includes('x-wav')) {
      if (u8.length >= 12) {
        const riff = u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46; // 'RIFF'
        const wave = u8[8] === 0x57 && u8[9] === 0x41 && u8[10] === 0x56 && u8[11] === 0x45; // 'WAVE'
        if (riff && wave) return true;
      }
      return false;
    }
    // For other audio types, just rely on size
    return buf.byteLength >= minSize;
  } catch {
    return false;
  }
}

function resultFromBase64(base64: string, mimeType: string): TTSResult {
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  return { base64, mimeType, dataUrl, blob, blobUrl };
}

async function generateWithGemini(text: string, opts?: TTSOptions): Promise<TTSResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Missing Google API key. Set NEXT_PUBLIC_GEMINI_API_KEY.');
  const ai = new GoogleGenAI({ apiKey });
  const modelName = opts?.model || 'gemini-2.5-flash-preview-tts';
  const voiceName = opts?.voiceName || 'Kore';

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    } as any,
  } as any);

  const part: any = response?.candidates?.[0]?.content?.parts?.[0];
  const data: string | undefined = part?.inlineData?.data;
  const mimeType: string = part?.inlineData?.mimeType || 'audio/wav';
  if (!data) throw new Error('No audio returned from TTS model');

  // Validate audio payload
  try {
    const buf = b64ToArrayBuffer(data);
    if (!isValidAudio(buf, mimeType)) {
      throw new Error('Gemini returned an invalid or empty audio payload.');
    }
  } catch (e) {
    throw e instanceof Error ? e : new Error('Gemini audio validation failed');
  }

  const res = resultFromBase64(data, mimeType);
  return { ...res, provider: 'gemini' };
}

async function generateWithElevenLabs(text: string, opts?: TTSOptions): Promise<TTSResult> {
  const apiKey = getElevenApiKey();
  const voiceId = opts?.elevenVoiceId || process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || process.env.NEXT_PUBLIC_ELEVEN_VOICE_ID;
  if (!apiKey) throw new Error('Missing ElevenLabs API key. Set NEXT_PUBLIC_ELEVENLABS_API_KEY.');
  if (!voiceId) throw new Error('Missing ElevenLabs voice id. Set NEXT_PUBLIC_ELEVENLABS_VOICE_ID.');

  const modelId = opts?.elevenModelId || process.env.NEXT_PUBLIC_ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
  const outputFormat = opts?.elevenOutputFormat || process.env.NEXT_PUBLIC_ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';

  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const body = {
    text,
    model_id: modelId,
    output_format: outputFormat,
  } as any;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let msg = `${resp.status} ${resp.statusText}`;
    try { const j = await resp.json(); msg = j?.detail || j?.error || msg; } catch {}
    throw new Error(`ElevenLabs TTS failed: ${msg}`);
  }
  const arrayBuf = await resp.arrayBuffer();
  // Infer MIME from output format (we default to mp3)
  const mimeType = outputFormat?.startsWith('mp3') ? 'audio/mpeg' : outputFormat?.startsWith('pcm') ? 'audio/wav' : 'audio/mpeg';

  // Validate basic audio signature and size
  if (!isValidAudio(arrayBuf, mimeType)) {
    throw new Error('ElevenLabs returned an invalid or empty audio payload.');
  }

  const base64 = b64FromArrayBuffer(arrayBuf);
  const res = resultFromBase64(base64, mimeType);
  return { ...res, provider: 'elevenlabs' };
}

export async function generateTTS(text: string, opts?: TTSOptions): Promise<TTSResult> {
  // Prefer ElevenLabs first (smaller MP3, broad device compatibility)
  try {
    const eleven = await generateWithElevenLabs(text, opts);
    if (eleven?.base64) return eleven;
  } catch (e) {
    try { console.warn('[TTS] ElevenLabs failed, falling back to Gemini:', e); } catch {}
  }
  // Fallback to Gemini TTS
  const gem = await generateWithGemini(text, opts);
  if (gem?.base64) return gem;
  throw new Error('TTS failed: no audio returned from providers');
}

// Build a voice-friendly transcript prompt from raw notes, removing non-essential metadata
export function buildAudioTranscriptPrompt(notes: string) {
  return (
    'Rewrite the following study notes into a clear, concise, audio-friendly transcript that can be read aloud as a mini lecture. ' +
    'Focus ONLY on the core subject matter and key concepts. Remove metadata and logistics like attendance, dates, course code, instructor, submission details, classroom rules, or grading policies. ' +
    'Organize ideas with natural phrasing, smooth transitions, and short sentences. Avoid markdown syntax. Keep technical terms but explain briefly when helpful. Keep it self-contained.\n\n' +
    'Notes:\n"""\n' + notes + '\n"""\n\n' +
    'Return ONLY the transcript text, suitable for TTS.'
  );
}
