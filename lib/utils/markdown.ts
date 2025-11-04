// Markdown utilities
// stripWrappingCodeFence removes a single top-level triple-backtick fence
// like ```markdown ... ``` or ```text ... ``` (or bare ``` ... ```), when it
// wraps the entire content. Inner code blocks remain untouched.
// Supported info strings: markdown, md, text, txt, plain, plaintext (case-insensitive).
export function stripWrappingCodeFence(input: string): string {
  if (!input) return input;
  // Normalize newlines to simplify regex; we accept potential CRLF -> LF in this cleanup path
  const s = input.replace(/\r\n/g, "\n");
  const m = s.match(/^\s*```([^\n]*)\n([\s\S]*?)\n```\s*$/);
  if (!m) return input;
  const info = (m[1] || "").trim().toLowerCase();
  const allowed = ["", "markdown", "md", "text", "txt", "plain", "plaintext"];
  if (allowed.includes(info)) {
    return m[2];
  }
  return input;
}
