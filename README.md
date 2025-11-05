# Knotes

A Next.js app that turns your documents into clean Markdown study notes and helps you learn faster with on-device AI. Knotes supports rewriting/retitling, summarizing, translating, quizzing, a study assistant, and even music generation (background and vocal) to reinforce memory. Where available, it uses Chrome Built‑in AI APIs (Writer, Rewriter, Prompt, Summarizer, Translator, Proofreader) with graceful fallbacks to Gemini/Vertex. Music features use Google Lyria guidance and ElevenLabs for audio.


## Features
- Import PDF/TXT and convert to Markdown notes (headings, lists, tables, math)
- Rewrite/retitle notes, summarize and translate content
- Highlight toolbar: Explain, Read (TTS), Google Search
- Study assistant chat (text + optional audio)
- Quiz generation and grading
- Study music generation: instrumental or with vocals
- Playlists, collections, timers, and basic analytics
- Safety: lyrics are sanitized for offensive language via Proofreader API (with masking fallback)


## Tech stack
- Next.js 16, React 19, TypeScript
- Chrome Built‑in AI APIs (when available locally)
- Google AI (Gemini) / Firebase AI Logic fallbacks
- ElevenLabs (music/voice) and guidance for Google Lyria prompts
- Tailwind/PostCSS, Markdown/KaTeX/Mermaid for rendering


## Requirements
- Desktop Chrome (latest). Some Built‑in AI APIs need experimental flags or origin trials.
- Node.js and npm
- Accounts/keys:
  - Firebase (Email/Password Auth enabled) and Firebase config
  - Google API key from Google AI Studio (Gemini)
  - Enable “AI logic” in your Firebase project and connect the Google API key
  - ElevenLabs API key (for music with vocals)


## Environment variables
Create a .env file at the project root (see example.env):

```
NEXT_PUBLIC_GOOGLE_API_KEY=<for direct Gemini>
NEXT_PUBLIC_ELEVENLABS_API_KEY=<required for music>
NEXT_PUBLIC_FIREBASE_API_KEY=<from Firebase console>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<from Firebase console>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<from Firebase console>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<from Firebase console>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from Firebase console>
NEXT_PUBLIC_FIREBASE_APP_ID=<from Firebase console>
```


## Installation
```
npm install
```


## Running locally
```
npm run dev
```
Open http://localhost:3000


## Production build
```
npm run build
npm run start
```


## Scripts
- dev: Start Next.js dev server
- build: Production build
- start: Start production server
- lint: Run ESLint


## Using Chrome Built‑in AI locally
Some APIs (Writer, Rewriter, Prompt, Summarizer, Translator, Proofreader) may require flags or an origin trial. For the Proofreader API on localhost during development:
- Enable: chrome://flags/#proofreader-api-for-gemini-nano
- Or register for the origin trial and include the token
If a Built‑in API isn’t available, Knotes automatically falls back to Gemini/Vertex where possible.


## How it works (high level)
- Document → Markdown: Extracts content and formats as Markdown with headings, lists, tables, and math.
- Editing & AI tools: Uses Built‑in APIs when available; otherwise uses Gemini/Vertex.
- Music: Builds a detailed prompt (with optional math mode) and calls ElevenLabs for audio, with vocals synced to lyrics when provided.
- Safety: lib/proofreader.ts integrates Chrome’s Proofreader API (if available) to correct text and then masks profanity; lib/lyrics.ts runs all generated lyrics through sanitizeLyrics().


## Troubleshooting
- Missing keys: Check console for warnings like “Firebase env vars missing …” or ElevenLabs key issues.
- File issues: Only PDF/TXT under ~20MB are supported.
- Network: If offline/throttled, AI features may fail gracefully—retry when online.
- Built‑in APIs: If you expected on‑device behavior but don’t see it, try Chrome Canary or enable flags/origin trials.
- Proofreader model: First-time downloads can take time; the app remains usable with fallbacks.


## Deploy
You can host anywhere that supports Next.js. For Firebase Hosting:
```
npm run build
firebase deploy --only hosting
```
Configure the same NEXT_PUBLIC_* env vars in your hosting environment.


## Privacy & safety
- User-provided content is processed locally when possible (Built‑in APIs) and otherwise via configured backends.
- Lyrics are sanitized for offensive language (Proofreader + masking fallback).
- Do not include secrets in the repository or commit history; use environment variables.


## License
This project is licensed under the MIT License – see LICENSE for details.


## Acknowledgements
- Chrome Built‑in AI team and documentation
- Google AI (Gemini) and Firebase
- ElevenLabs and Google Lyria guidance
