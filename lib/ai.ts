// Firebase AI Logic helpers for Gemini via Vertex AI backend
// Web client-side usage

import { app } from "./firebase";
import { getAI, getGenerativeModel, VertexAIBackend, type GenerativeModel } from "firebase/ai";

// Initialize AI with Vertex backend (use 'global' per docs recommendation)
let model: GenerativeModel | null = null;

// Use a PDF-capable model by default
export function getGeminiModel(modelName: string = "gemini-2.5-flash") {
  if (!model) {
    const ai = getAI(app, { backend: new VertexAIBackend("global") });
    model = getGenerativeModel(ai, { model: modelName });
  }
  return model!;
}

// Converts a File to a Generative Part that can be passed to generateContent
export async function fileToGenerativePart(file: File) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => {
      const result = reader.result as string; // data:[mime];base64,XXXX
      const comma = result.indexOf(",");
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
  // If browser didn't detect MIME, infer from extension to help the API
  const inferredMime = (() => {
    if (file.type) return file.type;
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".txt")) return "text/plain";
    return "application/octet-stream";
  })();
  return {
    inlineData: { data: base64, mimeType: inferredMime },
  } as const;
}

export async function extractTextFromFile(file: File, promptOverride?: string) {
  // Guard limits
  const maxBytes = 20 * 1024 * 1024; // 20MB transport limit note (base64 inflates)
  if (file.size > maxBytes) {
    throw new Error("File is too large. Please upload a file under 20MB.");
  }

  // Accept by MIME or extension to handle browsers that omit type on drag/drop
  const name = (file.name || "").toLowerCase();
  const mime = file.type || "";
  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
  const isTxt = mime === "text/plain" || name.endsWith(".txt");

  if (!isPdf && !isTxt) {
    throw new Error("Unsupported file type. Please upload a PDF or TXT file.");
  }

  const part = await fileToGenerativePart(file);

  const model = getGeminiModel();
  const prompt =
    promptOverride ||
    "Extract the plain textual content from this document. Return only the text with original reading order. Do not add commentary.";

  const result = await model.generateContent([prompt, part as any]);
  // Prefer response.text(), but add a safety fallback
  const text = result?.response?.text?.() ?? "";
  // Debug: log Gemini extraction result and file info
  try {
    console.log("[Gemini] Extraction result for", { name: file.name, type: file.type, size: file.size }, "\n--- BEGIN TEXT ---\n" + (text || "") + "\n--- END TEXT ---");
  } catch {}
  if (!text || !text.trim()) {
    throw new Error("No text could be extracted from the document.");
  }
  return text.trim();
}
