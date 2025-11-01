"use client";

// Chrome Prompt API (LanguageModel) integration with graceful fallback to Firebase AI Logic (Gemini)
// This utility manages a reusable on-device session when available and
// provides a high-level function to answer questions based on the authUser's notes.

import { getGeminiModel } from "./ai";

export type PromptEngine = "prompt" | "gemini";

export type PromptOptions = {
  // Temperature and topK for Prompt API sessions; ignored by Gemini fallback.
  temperature?: number;
  topK?: number;
  // Called when the on-device model download starts and progresses.
  onDownloadStart?: () => void;
  onDownloadProgress?: (loaded: number, total?: number) => void;
};

export type PromptResult = {
  text: string;
  used: PromptEngine;
};

let session: any | null = null;
let creating = false;

/** Returns true if the Prompt API is available (model present or downloadable). */
export async function isPromptAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const g: any = window as any;
  if (!("LanguageModel" in g)) return false;
  try {
    const availability = await g.LanguageModel.availability();
    return availability === "available" || availability === "downloadable" || availability === "downloading";
  } catch {
    return false;
  }
}

/** Create (or reuse) a LanguageModel session, downloading the model if necessary. */
export async function getPromptSession(opts?: PromptOptions): Promise<any | null> {
  if (!(await isPromptAvailable())) return null;
  if (session || creating) return session;
  creating = true;
  try {
    const g: any = window as any;
    const params = await g.LanguageModel.params?.().catch(() => ({ defaultTemperature: 1, defaultTopK: 3 }))
      || { defaultTemperature: 1, defaultTopK: 3 };

    const { temperature = params.defaultTemperature, topK = params.defaultTopK } = opts || {};

    session = await g.LanguageModel.create({
      temperature,
      topK,
      monitor(m: any) {
        try {
          opts?.onDownloadStart?.();
          m.addEventListener("downloadprogress", (e: any) => {
            try { opts?.onDownloadProgress?.(e.loaded, e.total); } catch {}
          });
        } catch {}
      },
    });
    return session;
  } catch (e) {
    console.warn("[Prompt] Failed to create on-device session:", e);
    session = null;
    return null;
  } finally {
    creating = false;
  }
}

/** Destroy the current LanguageModel session (optional). */
export function destroyPromptSession() {
  try { session?.destroy?.(); } catch {}
  session = null;
}

/**
 * Prompt the on-device model (if available) or fall back to Gemini.
 * Notes are provided as contextual system instructions to ground answers.
 */
export async function promptWithNotes(notes: string, userQuery: string, opts?: PromptOptions): Promise<PromptResult> {
  const g: any = typeof window !== "undefined" ? (window as any) : undefined;
  const trimmedNotes = (notes || "").trim();
  const trimmedQuery = (userQuery || "").trim();

  if (g && (await isPromptAvailable())) {
    const s = await getPromptSession(opts);
    if (s) {
      try {
        // We add instruction to use only the given notes when possible.
        const initial = [
          { role: "system", content: "You are Knotes Study Assistant. Answer precisely and helpfully based ONLY on the provided study notes when possible. If the answer is not in the notes, say so briefly and offer a concise, relevant explanation." },
          { role: "user", content: `Study Notes (context):\n${trimmedNotes.slice(0, 150_000)}` },
        ];
        // Append context once per session if empty (best-effort check):
        if (!s.inputUsage || s.inputUsage === 0) {
          await s.append?.(initial).catch(() => undefined);
        }
        const result: string = await s.prompt(trimmedQuery);
        return { text: (result || "").trim(), used: "prompt" };
      } catch (e) {
        console.warn("[Prompt] prompt() failed, falling back to Gemini:", e);
      }
    }
  }

  // Fallback to Gemini (cloud via Firebase AI Logic)
  const model = getGeminiModel();
  const prompt = `You are Knotes Study Assistant. Use the student's notes below as primary context.\n\nNotes:\n"""\n${trimmedNotes}\n"""\n\nQuestion:\n${trimmedQuery}\n\nAnswer clearly and concisely. If something isn't present in the notes, say so and add helpful context.`;
  const res = await model.generateContent(prompt);
  const text = res?.response?.text?.() ?? "";
  return { text: (text || "").trim(), used: "gemini" };
}
