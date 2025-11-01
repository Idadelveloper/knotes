import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Utility to compute UTF-8 byte length
function utf8Bytes(str: string): number {
  return new TextEncoder().encode(str || "").byteLength;
}

// Write a minimal WAV header for 16-bit PCM mono
function pcm16ToWav(pcm: Buffer, sampleRate = 24000, channels = 1): Buffer {
  const byteRate = sampleRate * channels * 2; // 16-bit
  const blockAlign = channels * 2;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); // ChunkID
  header.writeUInt32LE(36 + dataSize, 4); // ChunkSize
  header.write("WAVE", 8); // Format
  header.write("fmt ", 12); // Subchunk1ID
  header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(channels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(byteRate, 28); // ByteRate
  header.writeUInt16LE(blockAlign, 32); // BlockAlign
  header.writeUInt16LE(16, 34); // BitsPerSample
  header.write("data", 36); // Subchunk2ID
  header.writeUInt32LE(dataSize, 40); // Subchunk2Size
  return Buffer.concat([header, pcm]);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      text,
      prompt = "",
      // We always return WAV since Gemini provides raw PCM; keep field for backward compat.
      outputFormat = "LINEAR16",
      languageCode = "en-US",
      voiceName = "Kore",
      modelName = "gemini-2.5-pro-preview-tts",
      sampleRateHertz = 24000,
    }: {
      text: string;
      prompt?: string;
      outputFormat?: string;
      languageCode?: string;
      voiceName?: string | undefined;
      modelName?: string;
      sampleRateHertz?: number;
    } = body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Missing required 'text'" }, { status: 400 });
    }

    // Enforce input limits per docs (bytes)
    const textBytes = utf8Bytes(text);
    const promptBytes = utf8Bytes(prompt);
    if (textBytes > 4000) {
      return NextResponse.json({ error: "Text exceeds 4000 bytes limit" }, { status: 400 });
    }
    if (promptBytes > 4000) {
      return NextResponse.json({ error: "Prompt exceeds 4000 bytes limit" }, { status: 400 });
    }
    if (textBytes + promptBytes > 8000) {
      return NextResponse.json({ error: "Combined size of text + prompt exceeds 8000 bytes limit" }, { status: 400 });
    }

    // Prepare Gemini client (server-side). Use server-side API key if available; fall back to NEXT_PUBLIC key as last resort.
    const apiKey = process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.NEXT_PUBLIC_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing Google API key for TTS (set GOOGLE_API_KEY or NEXT_PUBLIC_GOOGLE_API_KEY)" }, { status: 500 });
    }
    const ai = new GoogleGenAI({ apiKey });

    // Compose contents: include style prompt (if any) followed by the text to speak.
    const combined = (prompt && prompt.trim().length > 0)
      ? `${prompt.trim()}\n${text.trim()}`
      : text.trim();

    // Build request to Gemini TTS per docs
    const response = await ai.models.generateContent({
      model: modelName || "gemini-2.5-pro-preview-tts",
      contents: [{ parts: [{ text: combined }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: String(voiceName || "Kore") },
          },
        } as any,
      },
    } as any);

    const data = (response as any)?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!data || typeof data !== "string") {
      return NextResponse.json({ error: "TTS returned no audio data" }, { status: 502 });
    }

    const pcmBuffer = Buffer.from(data, "base64");
    // Wrap raw PCM in a valid WAV container for browser playback
    const wavBuffer = pcm16ToWav(pcmBuffer, sampleRateHertz || 24000, 1);

    // Convert Node Buffer to ArrayBuffer for NextResponse BodyInit
    const ab = wavBuffer.buffer.slice(wavBuffer.byteOffset, wavBuffer.byteOffset + wavBuffer.byteLength);

    return new NextResponse(ab as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    const msg = err?.message || "TTS synthesis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
