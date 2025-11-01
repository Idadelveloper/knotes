// Client helper for Gemini-TTS via server route
// Provides a simple function to synthesize audio from text with optional voice and format controls.

export type TtsEncoding = "MP3" | "OGG_OPUS" | "LINEAR16" | "PCM" | "MULAW" | "ALAW";

export type SynthesizeOptions = {
  text: string; // transcript/content to speak (<= 4000 bytes)
  prompt?: string; // style instructions (<= 4000 bytes)
  languageCode?: string; // e.g., "en-US"
  voiceName?: string; // e.g., "Charon", "Callirrhoe", etc.
  outputFormat?: TtsEncoding; // default MP3
  // Note: sampleRateHertz is currently ignored by the backend because Gemini TTS does not accept it in speechConfig.
  // Models typically output 24 kHz; we return audio/wav without resampling.
  sampleRateHertz?: number; // e.g., 24000 (ignored)
};

export type SynthesizeResult = {
  blob: Blob;
  url: string; // object URL for quick playback. Remember to revokeObjectURL when done.
  contentType: string;
};

/**
 * Call the Next.js API route to synthesize speech using Gemini-TTS.
 * Returns a Blob and object URL for easy playback with <audio>.
 */
export async function synthesizeTts(opts: SynthesizeOptions): Promise<SynthesizeResult> {
  const {
    text,
    prompt = "",
    languageCode = "en-US",
    voiceName,
    outputFormat = "LINEAR16",
    sampleRateHertz,
  } = opts || ({} as any);

  if (!text || !text.trim()) throw new Error("Missing text");

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, prompt, languageCode, voiceName, outputFormat, sampleRateHertz }),
  });
  if (!res.ok) {
    let err = "TTS request failed";
    try {
      const j = await res.json();
      err = j?.error || err;
    } catch {}
    throw new Error(err);
  }
  const ctype = res.headers.get("Content-Type") || "audio/mpeg";
  const buf = await res.arrayBuffer();
  const blob = new Blob([buf], { type: ctype });
  const url = URL.createObjectURL(blob);
  return { blob, url, contentType: ctype };
}

// Optional list of voice names from the docs for easy selection
export const GeminiTtsVoices = [
  "Achernar","Achird","Algenib","Algieba","Alnilam","Aoede","Autonoe","Callirrhoe","Charon","Despina","Enceladus","Erinome","Fenrir","Gacrux","Iapetus","Kore","Laomedeia","Leda","Orus","Pulcherrima","Puck","Rasalgethi","Sadachbia","Sadaltager","Schedar","Sulafat","Umbriel","Vindemiatrix","Zephyr","Zubenelgenubi",
] as const;

// Build a prompt to convert raw study notes into a concise, audio-friendly transcript
export function buildAudioTranscriptPrompt(notes: string): string {
  const cleaned = (notes || "").trim();
  return (
    "Rewrite the following study notes into a clear, listener-friendly transcript for text-to-speech. " +
    "Focus ONLY on core learning content: concepts, definitions, theorems, formulas, processes, reasoning, examples, and applications. " +
    "EXCLUDE logistics like course info, instructor names, assignment numbers, due dates, grading, policies, office hours, or contact info. " +
    "Use short sentences and add brief cues for pacing such as [short pause] between major points if helpful. " +
    "Return plain text only (no markdown headings).\n\nNotes:\n" + cleaned
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}

export type GenerateTtsOptions = {
  voiceName?: string;
  languageCode?: string;
  outputFormat?: TtsEncoding;
  sampleRateHertz?: number;
  prompt?: string; // style instructions, e.g., "Narrate in a calm, friendly tone."
};

// High-level convenience: send a prepared transcript to the server TTS and return URLs for playback/download
export async function generateTTS(transcript: string, opts?: GenerateTtsOptions): Promise<{ blobUrl: string; dataUrl: string; contentType: string }> {
  const res = await synthesizeTts({
    text: transcript,
    prompt: opts?.prompt || "Narrate in a clear, friendly, study-focused tone.",
    languageCode: opts?.languageCode || "en-US",
    voiceName: opts?.voiceName,
    outputFormat: opts?.outputFormat || "LINEAR16",
    sampleRateHertz: opts?.sampleRateHertz,
  });
  const dataUrl = await blobToDataUrl(res.blob);
  return { blobUrl: res.url, dataUrl, contentType: res.contentType };
}
