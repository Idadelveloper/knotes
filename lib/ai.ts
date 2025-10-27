// Firebase AI Logic helpers for Gemini via Vertex AI backend, with direct Google GenAI fallback
// Web client-side usage

import { app } from "./firebase";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type GenerativeModel } from "firebase/ai";
import { GoogleGenAI } from "@google/genai";

// Initialize a single model instance
let model: any | null = null;
let cachedName: string | null = null;
let mode: 'direct' | 'firebase' | null = null;

function getApiKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    undefined
  );
}

// Wrap @google/genai to look like Firebase AI Logic's GenerativeModel enough for our callers
function getDirectModel(modelName: string) {
  const key = getApiKey();
  if (!key) return null;
  const ai = new GoogleGenAI({ apiKey: key });
  const extractText = (res: any): string => {
    try {
      if (typeof res.text === 'function') return res.text();
      if (res.text) return res.text;
      const c = res.candidates?.[0];
      const parts = c?.content?.parts;
      if (Array.isArray(parts)) {
        const t = parts.map((p: any) => p.text).filter(Boolean).join('');
        if (t) return t;
      }
    } catch {}
    return '';
  };
  return {
    async generateContent(input: any) {
      // Normalize input to contents format
      let parts: any[] = [];
      if (typeof input === 'string') {
        parts = [{ text: input }];
      } else if (Array.isArray(input)) {
        parts = input.map((p) => (typeof p === 'string' ? { text: p } : p));
      } else {
        parts = [input];
      }
      const contents = [{ role: 'user', parts }];
      // @google/genai accepts { model, contents }
      // @ts-ignore
      const res = await ai.models.generateContent({ model: modelName, contents });
      const text = extractText(res) || '';
      return { response: { text: () => text } } as any;
    },
  } as const;
}

// Default cloud model to use when falling back (can be overridden)
export function getGeminiModel(modelName: string = "gemini-2.0-flash-lite") {
  // Re-create if model name changes
  if (!model || cachedName !== modelName) {
    const direct = getDirectModel(modelName);
    if (direct) {
      model = direct;
      mode = 'direct';
    } else {
      const ai = getAI(app, { backend: new GoogleAIBackend() });
      model = getGenerativeModel(ai, {
        mode: InferenceMode.PREFER_ON_DEVICE,
        inCloudParams: { model: modelName },
      });
      mode = 'firebase';
    }
    cachedName = modelName;
    try { console.log(`[AI] Using ${mode} model: ${modelName}`); } catch {}
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
    `Extract and transcribe this document into clean, well-structured Markdown suitable for studying.
- Preserve logical reading order and hierarchy.
- Use clear section headings (##, ###) and bullet/numbered lists where appropriate.
- For math, render using KaTeX/LaTeX syntax (for example: c = \\pm\\sqrt{a^2 + b^2}).
- For diagrams, use Mermaid fenced code blocks (\`\`\`mermaid … \`\`\`).
- Use Markdown tables when tabular data is present.
- Include code blocks only when truly code.
- Avoid extra commentary; return ONLY the Markdown.
`;

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
