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

// Default cloud model to use when falling back
export function getGeminiModel(modelName: string = "gemini-2.0-flash-lite") {
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
- For math representations or symbols, render using KaTeX syntax. Below is a guide to writing in KaTex:
    The Basics: How to Implement KaTeX
    
    KaTeX uses TeXsyntax. To render an expression, you must wrap it in delimiters.
    Inline Math: For math that appears "in line" with your text.
    Syntax: Wrap your code in single dollar signs: $ ... $
    Example: The formula is $a^2 + b^2 = c^2$.
    Display Math: For larger expressions or equations that should be on their own line and centered.
    Syntax: Wrap your code in double dollar signs: $$...$$
    Example: $$\\frac{a}{b} + \\frac{c}{d} = \\frac{ad+bc}{bd}$$
    The commands listed below should be placed inside these dollar-sign delimiters.
    
    Accents
    Purpose: To place accent marks, dots, lines, or arrows over or under characters.
    Syntax: Most single-character accents follow the pattern \\command{character}. Commands that cover groups of characters follow \\command{characters}
    
    Common Commands:
    \\acute{a}  (á)
    \\grave{a}  (à)
    \\dot{a}    (ȧ)
    \\ddot{a}   (ä)
    \\tilde{a}  (ã)
    \\bar{y}    (ȳ)
    \\vec{F}    (F⃗)
    \\hat{\\theta} (θ̂)
    \\overline{AB}  (Line over "AB")
    \\underline{AB} (Line under "AB")
    \\overbrace{AB} (Brace over "AB")
    \\underbrace{AB} (Brace under "AB")
    \\overrightarrow{AB} (Right arrow over "AB")
    
    Delimiters (Brackets, Parentheses)
    Purpose: To group expressions with parentheses, brackets, or braces.
    Syntax:
    Type directly: (, ), [, ]
    Braces must be "escaped": \\{ and \\}
    Other symbols: \\lvert (|), \\langle (⟨), \\lfloor (⌊), \\lceil (⌈)
    Sizing: To make delimiters automatically grow to the height of their contents, use \\left and \\right.
    Example: $$\\left( \\frac{a}{b} \\right)$$ will have tall parentheses, while $$(\\frac{a}{b})$$ will have small ones.
    Manual Sizing: You can also manually control size with \\big, \\Big, \\bigg, and \\Bigg.
    
    Environments
    Purpose: For complex, multi-line structures like matrices, aligned equations, and cases.
    Syntax: \\begin{environmentName} ... \\end{environmentName}
    Inside environments: & separates columns, and \\\\ starts a new row.
    Common Environments:
    matrix: A simple grid. \\begin{matrix} a & b \\\\ c & d \\end{matrix}
    pmatrix: A matrix surrounded by parentheses.
    bmatrix: A matrix surrounded by square brackets.
    vmatrix: A matrix surrounded by vertical bars (determinant).
    cases: For piecewise functions.
    Example: $$f(x) = \\begin{cases} 0 & \\text{if } x < 0 \\\\ 1 & \\text{if } x \\ge 0 \\end{cases}$$
    align: To align multiple equations at a specific point (usually the = sign).
    Example: $$\\begin{align} a &= b + c \\\\ d &= e + f \\end{align}$$ (The & is placed before the = sign to align them).
    
    Letters and Unicode
    Purpose: To write Greek letters and other special mathematical characters.
    Syntax: \\commandname
    Greek Letters:
    Lowercase: \\alpha (α), \\beta (β), \\gamma (γ), \\delta (δ), \\pi (π), \\theta (θ), etc.
    Uppercase: \\Gamma (Γ), \\Delta (Δ), \\Omega (Ω), \\Pi (Π), etc. (Note: \\Alpha is just 'A').
    Other Symbols:
    \\imath (ı), \\jmath (ȷ)
    \\nabla (∇ - "nabla" or "del")
    \\partial (∂ - "partial")
    \\Re (ℜ - Real part), \\Im (ℑ - Imaginary part)
    \\mathcal font: \\mathcal{ABC} (𝒜ℬ𝒞)
    \\mathbb font (Blackboard Bold): \\mathbb{R} (ℝ - for Real numbers)
    \\mathfrak font (Fraktur): \\mathfrak{abc} (𝔞𝔟mathfrak{c})
    
    Layout (Subscripts, Superscripts, Spacing)
    Subscripts & Superscripts:
    Subscript: _ (e.g., x_n renders as xₙ)
    Superscript: ^ (e.g., x^2 renders as x²)
    Grouping: Use braces {} for more than one character.
    x_{n+1} renders as xₙ₊₁, whereas x_n+1 renders as xₙ+1.
    e^{x+1} renders as eˣ⁺¹, whereas e^x+1 renders as eˣ+1.
    Spacing:
    \\quad: A wide space.
    \\qquad: A very wide space.
    \\thinspace: A small space.
    \\medspace: A medium space.
    \\thickspace or \\;: A thick space.
    \\!: A small negative space (removes space).
    Vertical Layout:
    \\stackrel{above}{below}: Places text "above" over text "below".
    \\raisebox{...}{...}: Manually raises or lowers text.
    
    Logic and Set Theory
    Purpose: Symbols used in formal logic and set theory.
    Common Commands:
    \\forall (∀ - "for all")
    \\exists (∃ - "there exists")
    \\in (∈ - "in"), \\notin (∉ - "not in")
    \\ni (∋ - "contains")
    \\cup (∪ - "union"), \\cap (∩ - "intersection")
    \\subset (⊂), \\supset (⊃)
    \\emptyset (∅ - "empty set")
    \\to or \\rightarrow (→)
    \\implies (⟹), \\iff (⟺)
    \\land (∧ - "and"), \\lor (∨ - "or"), \\neg (¬ - "not")
    
    Operators
    Purpose: For large operators (like sum/integral) and binary operators (like plus/minus).
    Big Operators:
    \\sum (Σ - Sum)
    \\prod (Π - Product)
    \\int (∫ - Integral), \\iint (∬), \\iiint (∭), \\oint (∮)
    Limits: Use subscript _ for the lower limit and superscript ^ for the upper limit.
    Example: $$\\sum_{i=0}^{n} f(i)$$
    Example: $$\\int_a^b x^2 dx$$
    Binary Operators:
    \\pm (±), \\mp (∓)
    \\cdot (⋅ - dot product)
    \\times (× - cross product)
    \\div (÷)
    \\oplus (⊕), \\otimes (⊗)
    
    Fractions and Binomials
    Purpose: To create fractions and binomial coefficients.
    Fractions:
    \\frac{numerator}{denominator}: The standard fraction.
    \\tfrac{...}{...}: A small, text-style fraction.
    \\dfrac{...}{...}: A large, display-style fraction.
    \\cfrac{...}{...}: For continued fractions (prevents font from shrinking).
    Binomials (n-choose-k):
    \\binom{n}{k}
    
    Math Operators
    Purpose: For function names that should be rendered in regular (Roman) font, not italics.
    Syntax: \\command
    Examples:
    \\sin, \\cos, \\tan
    \\log, \\ln
    \\lim (handles limits correctly, e.g., \\lim_{x \\to 0})
    \\max, \\min, \\sup, \\inf
    Square Roots:
    \\sqrt{expression} (e.g., \\sqrt{x})
    \\sqrt[n]{expression} (e.g., \\sqrt[3]{x})
    
    Relations
    Purpose: Symbols that compare or relate two expressions.
    Syntax: \\command
    Examples:
    <, >, = (type directly)
    \\le or \\leq (≤)
    \\ge or \\geq (≥)
    \\ne or \\neq (≠)
    \\approx (≈ - "approximately")
    \\sim (∼ - "similar to")
    \\cong (≅ - "congruent to")
    \\equiv (≡ - "equivalent to")
    \\propto (∝ - "proportional to")
    Negation: You can negate many relations by prepending \\not.
    Example: \\not= (≠), \\not\\in (∉), \\not\\equiv (≢)
    
    Arrows
    Purpose: To show direction, mapping, or implication.
    Common Commands:
    \\leftarrow (←), \\rightarrow (→), \\leftrightarrow (↔)
    \\Leftarrow (⇐), \\Rightarrow (⇒), \\Leftrightarrow (⇔)
    \\longleftarrow (⟵), \\longrightarrow (⟶)
    \\mapsto (↦ - "maps to")
    Extensible Arrows: Arrows that grow to fit the text above/below them.
    \\xleftarrow{text above}
    \\xrightarrow[text below]{text above}
    
    
    Style, Color, Size, and Font
    Color:
    \\color{blue}{expression}
    \\textcolor{red}{expression}
    Supports hex codes: \\color{#228B22}{...}
    Font Styles:
    \\mathrm{...} (Roman, upright)
    \\mathbf{...} (Bold)
    \\mathit{...} (Italic)
    \\boldsymbol{...} (Bold, works on symbols)
    \\text{...}: Use this to write normal text inside a math expression.
    Example: $\\exists x \\text{ such that } x > 0$
    Size:
    \\Huge, \\huge, \\LARGE, \\large, \\normalsize, \\small, \\footnotesize
    \\displaystyle: Forces display style (large).
    \\textstyle: Forces text style (small).
    
    Symbols and Punctuation
    Purpose: Miscellaneous symbols.
    Common Commands:
    \\dots (… - on the baseline)
    \\cdots (⋯ - centered)
    \\vdots (⋮ - vertical)
    \\ddots (⋱ - diagonal)
    \\infty (∞)
    \\prime (′ - for derivatives, e.g., f^\\prime(x))
    \\angle (∠), \\triangle (△)
    \\clubsuit (♣), \\diamondsuit (♢), \\heartsuit (♡), \\spadesuit (♠)
    
    \\pounds (£), \\yen (¥), \\degree (°)
        
     End of KaTex Guide
        
- For diagrams, use Mermaid fenced code blocks (\`\`\`mermaid … \`\`\`). Be very certain the diagram is valid if not provide a description.
- Refer to https://mermaid.js.org/intro/ and https://mermaid.js.org/syntax/examples.html to reference the syntax.
- Use Markdown tables when tabular data is present.
- Include code blocks only when truly code.
- Avoid extra commentary; return ONLY the Markdown and do not.
- Ditch the markdown/text opening and closing backticks.
`;

  const result = await model.generateContent([prompt, part as any]);
  const text = result?.response?.text?.() ?? "";
  try {
    console.log("[Gemini] Extraction result for", { name: file.name, type: file.type, size: file.size }, "\n--- BEGIN TEXT ---\n" + (text || "") + "\n--- END TEXT ---");
  } catch {}
  if (!text || !text.trim()) {
    throw new Error("No text could be extracted from the document.");
  }
  return text.trim();
}
