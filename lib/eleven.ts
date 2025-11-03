"use client";

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export type ElevenComposeOptions = {
  prompt: string;
  musicLengthMs?: number; // 3s..300s
  modelId?: "music_v1";
  forceInstrumental?: boolean;
  outputFormat?:
    | "mp3_44100_128"
    | "mp3_44100_192"
    | "mp3_44100_320"
    | "wav_44100"
    | "pcm_44100"
    | string;
};

export type ElevenComposeResult = {
  blobUrl: string;
  filename?: string;
  metadata?: any;
  used: "prompt" | "plan";
};

function getApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
}

export function getElevenClient() {
  const key = getApiKey();
  if (!key) throw new Error("Missing NEXT_PUBLIC_ELEVENLABS_API_KEY");
  const client = new ElevenLabsClient({
    apiKey: key,
    environment: "https://api.elevenlabs.io",
  });
  return client;
}

export async function composeSongDetailed(opts: ElevenComposeOptions): Promise<ElevenComposeResult> {
  const client = getElevenClient();
  const {
    prompt,
    musicLengthMs,
    modelId = "music_v1",
    forceInstrumental = false,
    outputFormat = "mp3_44100_128",
  } = opts;

  try {
    const resp: any = await client.music.composeDetailed({
      prompt,
      musicLengthMs,
      modelId,
      forceInstrumental,
    });

    // resp.audio is Uint8Array or ArrayBuffer per SDK
    const audioBytes: any = resp?.audio ?? resp?.audioData ?? resp?.audioBytes;
    const filename: string | undefined = resp?.filename;
    const json = resp?.json || { composition_plan: resp?.composition_plan, song_metadata: resp?.song_metadata };

    if (!audioBytes) throw new Error("No audio returned from ElevenLabs");
    const blob = new Blob([audioBytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    return { blobUrl: url, filename, metadata: json, used: "prompt" };
  } catch (err: any) {
    const detail = (err && (err.body?.detail || err.response?.data?.detail)) as any;
    if (detail?.status === "bad_prompt") {
      const suggestion = detail?.data?.prompt_suggestion;
      throw Object.assign(new Error("bad_prompt"), { code: "bad_prompt", suggestion });
    }
    throw err;
  }
}
