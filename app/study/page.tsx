"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaSearch, FaBrain, FaGlobe, FaPenFancy, FaCopy, FaChevronDown, FaChevronRight, FaDownload, FaMagic, FaVolumeUp as FaVolume, FaCloudUploadAlt, FaMusic, FaChartBar, FaQuestionCircle, FaClock, FaComments } from "react-icons/fa";
import HighlightToolbar from "@/components/HighlightToolbar";
import MusicDock from "@/components/MusicDock";
import { HiOutlineX } from "react-icons/hi";
import ChatPanel from "@/components/ChatPanel";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getGeminiModel } from "@/lib/ai";
import { translateText } from "@/lib/translate";
import MarkdownViewer from "@/components/MarkdownViewer";
import MDEditor from "@uiw/react-md-editor";

// Simple toast system
type Toast = { id: number; message: string };

export default function StudyWorkspace() {
  const router = useRouter();
  const { user } = useAuth();
  const userDisplay = (user?.displayName || user?.email || 'You') as string;
  // Editor refs/state
  const editorRef = useRef<HTMLDivElement | null>(null);
  const mdTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mdEditing, setMdEditing] = useState<string>("");
  const savedRangeRef = useRef<Range | null>(null);

  // Floating toolbar state
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // AI Modal state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState<"explain" | "summarize" | "translate" | "rewrite">("explain");
  const [aiOutput, setAiOutput] = useState<string>("");

  // Sidebar collapsibles (removed old right panel)
  const [openPanels, setOpenPanels] = useState<{ [k: string]: boolean }>({});

  // Music dock state
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(0.7);

  // Chatbot UI state
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: "Hi! I’m your study assistant. Ask me to explain, summarize, or quiz you based on your notes." }
  ]);
  const [chatTyping, setChatTyping] = useState(false);
  // When chat is open, reserve space on the right on md+ so notes and chat sit side-by-side
  const rightPadClass = chatOpen ? "md:pr-[32rem]" : "";

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((m) => [...m, { role: 'user', text }]);
    setChatInput("");
    // Simple mock response using selectedText context if exists
    const context = selectedText?.trim() ? `Regarding your selection: "${selectedText.slice(0, 200)}"` : "";
    setTimeout(() => {
      setChatMessages((m) => [
        ...m,
        { role: 'ai', text: `Here’s a helpful note. ${context} — This is a placeholder response you can wire to AI later.` },
      ]);
    }, 600);
  };

  // Assistant + selection state
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantTab, setAssistantTab] = useState<"explain" | "simplify" | "summarize" | "translate" | "read" | "music">("explain");
  const [selectedText, setSelectedText] = useState("");

  // Focus mode
  const [focusMode, setFocusMode] = useState(false);

  // Timer state
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerMode, setTimerMode] = useState<"pomodoro" | "custom">("pomodoro");
  const [customMinutes, setCustomMinutes] = useState<number>(25);
  const [remainingSecs, setRemainingSecs] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [showCountdown, setShowCountdown] = useState<boolean>(true);
  const [timeUpOpen, setTimeUpOpen] = useState<boolean>(false);

  // Music genre
  const [genre, setGenre] = useState("Lo-fi");

  // Assistant panel output
  const [assistantOutput, setAssistantOutput] = useState<string>("");

  // Notes panel tabs: Original | Summarize | Translate | Voice Read
  const [notesTab, setNotesTab] = useState<"original" | "summarize" | "translate" | "voice">("original");
  const [summaryText, setSummaryText] = useState<string>("");
  const [translatedText, setTranslateText] = useState<string>("");
  const [notesLoading, setNotesLoading] = useState<false | "summarize" | "translate">(false);
  const [notesError, setNotesError] = useState<string>("");
  const [ttsSpeaking, setTtsSpeaking] = useState<boolean>(false);
  // Persistent notes content (HTML) and edit mode
  const [notesContentHtml, setNotesContentHtml] = useState<string>("");
  const [notesMarkdown, setNotesMarkdown] = useState<string>("");
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  // Keep a mirror of the editor text so features work even when the editor DOM isn't mounted
  const [editorText, setEditorText] = useState<string>("");
  // Translate settings
  const [translateLang, setTranslateLang] = useState<string>("es");
  const [translatorDownloading, setTranslatorDownloading] = useState<boolean>(false);
  const [translatorProgress, setTranslatorProgress] = useState<number | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  };

  // Derived title for the notes
  const [notesTitle, setNotesTitle] = useState<string>("Study Notes");

  // Basic markdown to HTML converter (very small subset: headings, bullets, paragraphs)
  const mdToHtml = (md: string) => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = md.split(/\r?\n/);
    const out: string[] = [];
    let inList = false;
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^\s*$/.test(line)) { if (inList) { out.push('</ul>'); inList = false; } continue; }
      if (/^#{1,6}\s+/.test(line)) {
        if (inList) { out.push('</ul>'); inList = false; }
        const level = (line.match(/^#+/)![0].length);
        const text = esc(line.replace(/^#{1,6}\s+/, ''));
        out.push(`<h${level}>${text}</h${level}>`);
      } else if (/^[-*]\s+/.test(line)) {
        if (!inList) { out.push('<ul class="list-disc pl-6">'); inList = true; }
        const item = esc(line.replace(/^[-*]\s+/, ''));
        out.push(`<li>${item}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<p>${esc(line)}</p>`);
      }
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
  };

  // Load structured (Markdown) and/or extracted text and title from sessionStorage on first mount
  useEffect(() => {
    const structuredKey = "knotes_structured_text"; // Markdown when available
    const extractedKey = "knotes_extracted_text"; // Raw fallback
    const titleKey = "knotes_title";
    const structured = typeof window !== "undefined" ? sessionStorage.getItem(structuredKey) : null;
    const extracted = typeof window !== "undefined" ? sessionStorage.getItem(extractedKey) : null;
    const savedTitle = typeof window !== "undefined" ? sessionStorage.getItem(titleKey) : null;

    // Persistent storage (survives reloads)
    const persistMdKey = "knotes_persist_markdown";
    const persistHtmlKey = "knotes_persist_html";

    try {
      console.log("[Study] Session payload:", { structuredPreview: structured?.slice(0, 200), extractedPreview: extracted?.slice(0, 200), title: savedTitle });
    } catch {}
    if (savedTitle) setNotesTitle(savedTitle);

    if (structured && structured.trim().length > 0) {
      // Prefer structured Markdown from session (fresh upload)
      setNotesMarkdown(structured);
      const html = mdToHtml(structured);
      setNotesContentHtml(html);
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      setEditorText((tmp.innerText || tmp.textContent || '').trim());

      // Persist for future reloads
      try {
        localStorage.setItem(persistMdKey, structured);
        localStorage.setItem(persistHtmlKey, html);
        if (savedTitle) localStorage.setItem(titleKey, savedTitle);
      } catch {}
    } else if (extracted && extracted.trim().length > 0) {
      // Fallback: plain extracted text → simple HTML paragraphs
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = extracted
        .split(/\n+/)
        .map((l) => `<p>${esc(l)}</p>`)
        .join('');
      setNotesContentHtml(html);
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      setEditorText((tmp.innerText || tmp.textContent || '').trim());

      // Persist HTML fallback
      try {
        localStorage.setItem(persistHtmlKey, html);
        if (savedTitle) localStorage.setItem(titleKey, savedTitle);
      } catch {}
    } else {
      // Nothing in session; try persistent storage
      let persistedMd: string | null = null;
      let persistedHtml: string | null = null;
      try {
        persistedMd = localStorage.getItem(persistMdKey);
        persistedHtml = localStorage.getItem(persistHtmlKey);
        const persistedTitle = localStorage.getItem(titleKey);
        if (persistedTitle) setNotesTitle(persistedTitle);
      } catch {}

      if (persistedMd && persistedMd.trim()) {
        setNotesMarkdown(persistedMd);
        const html = mdToHtml(persistedMd);
        setNotesContentHtml(html);
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        setEditorText((tmp.innerText || tmp.textContent || '').trim());
      } else if (persistedHtml && persistedHtml.trim()) {
        setNotesContentHtml(persistedHtml);
        const tmp = document.createElement('div');
        tmp.innerHTML = persistedHtml;
        setEditorText((tmp.innerText || tmp.textContent || '').trim());
      } else {
        // Seed with default example content if nothing provided
        const defaultHtml = `<p><strong>The Mitochondrion: Powerhouse of the Cell</strong> — <span class=\"bg-blue-200/50\">Mitochondria generate ATP through cellular respiration</span>, providing energy needed for cellular processes.</p>
<p class=\"mt-3\">They have a double membrane, their own DNA, and play roles in apoptosis and calcium storage.</p>
<p class=\"mt-3\">In some organisms, organelles and pathways can be highly reduced or even lost due to parasitic or anaerobic lifestyles.</p>`;
        setNotesContentHtml(defaultHtml);
        const tmp = document.createElement('div');
        tmp.innerHTML = defaultHtml;
        setEditorText((tmp.innerText || tmp.textContent || '').trim());
      }
    }

    // Clear session keys (we persisted what we need)
    sessionStorage.removeItem(structuredKey);
    sessionStorage.removeItem(extractedKey);
    sessionStorage.removeItem(titleKey);
  }, []);

  // Track mouseup/selection in editor to toggle toolbar and open assistant
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aiOpen) setAiOpen(false);
    };
    window.addEventListener("keydown", handleKey);

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setToolbarVisible(false);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) {
        setToolbarVisible(false);
        return;
      }
      const text = sel.toString();
      if (text.trim().length > 0) {
        savedRangeRef.current = range.cloneRange();
        const rect = range.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = Math.max(64, rect.top - 8); // keep under navbar
        setToolbarPos({ x, y });
        setToolbarVisible(true);
        setSelectedText(text);
        setAssistantOpen(true);
        setAssistantTab("explain");
      } else {
        setToolbarVisible(false);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  // Hide toolbar on scroll or window resize
  useEffect(() => {
    const hide = () => setToolbarVisible(false);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  // Insert text back into notes. If editing, insert at caret; otherwise append to saved HTML state.
  const insertIntoNotes = (text: string) => {
    const editor = editorRef.current;
    if (isEditingNotes && editor) {
      editor.focus();
      const sel = window.getSelection();
      if (savedRangeRef.current) {
        sel?.removeAllRanges();
        sel?.addRange(savedRangeRef.current);
      }
      const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (range) {
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        // move caret after inserted node
        range.setStartAfter(node);
        range.setEndAfter(node);
        sel?.removeAllRanges();
        sel?.addRange(range);
      } else {
        // append to end if no range
        editor.append(text);
      }
      // update mirrors
      setEditorText((editor.innerText || editor.textContent || '').trim());
      setNotesContentHtml(editor.innerHTML);
      pushToast("✅ Inserted into notes");
      return;
    }
    // Not editing: append to persistent HTML content
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const toHtml = (t: string) => t
      .split(/\n+/)
      .map(l => `<p>${esc(l)}</p>`) 
      .join('');
    setNotesContentHtml(prev => (prev || '') + toHtml(text));
    // update plain mirror
    setEditorText(prev => (prev ? prev + '\n' + text.trim() : text.trim()));
    pushToast("✅ Added to notes");
  };

  // Handle AI actions (mock)
  const runAI = (type: "explain" | "summarize" | "translate" | "rewrite") => {
    setAiTab(type);
    setAiOpen(true);
    if (type === "explain") pushToast("✨ Generating explanation…");
    if (type === "summarize") pushToast("✨ Generating summary…");
    if (type === "translate") pushToast("✨ Translating…");
    if (type === "rewrite") pushToast("✨ Improving writing…");

    setTimeout(() => {
      const samples: Record<string, string> = {
        explain: "This concept can be understood by breaking it into simpler parts and relating it to everyday examples.",
        summarize: "In short, this section outlines the key ideas, the underlying mechanism, and their practical implications.",
        translate: "Traducción de ejemplo: Este texto demuestra cómo podría verse una traducción al español.",
        rewrite: "Revised: The clarity and flow of this passage have been improved for readability and impact.",
      };
      setAiOutput(samples[type]);
      if (type === "summarize") pushToast("✅ Summary ready!");
    }, 900);
  };

  // Floating toolbar action handlers
  const handleExplain = () => {
    setToolbarVisible(false);
    runAI("explain");
  };
  const handleSimplify = () => {
    setToolbarVisible(false);
    runAI("rewrite");
  };
  const handleRead = () => {
    if (!selectedText) return;
    setToolbarVisible(false);
    try {
      // Use Web Speech API if available
      // stop any existing
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(selectedText);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        window.speechSynthesis.speak(utter);
        pushToast("🔊 Reading selection…");
        setAiTab("explain");
        setAiOutput("Reading aloud the selected text…");
        setAiOpen(true);
      } else {
        pushToast("⚠️ TTS not supported in this browser");
      }
    } catch (e) {
      pushToast("⚠️ Failed to start TTS");
    }
  };
  const handleConvertMusic = () => {
    setToolbarVisible(false);
    pushToast("🎵 Converting selection to music prompt…");
    setAiTab("summarize");
    setAiOutput("We will turn your highlighted text into a mood-based soundtrack. (Demo)");
    setAiOpen(true);
  };
  const handleSearch = () => {
    setToolbarVisible(false);
    pushToast("🌐 Searching more info…");
    const query = selectedText.length > 120 ? selectedText.slice(0, 120) + "…" : selectedText;
    setAiTab("summarize");
    setAiOutput(`Top insights for: "${query}"\n\n• Definition overview\n• Related concepts\n• Further reading suggestions`);
    setAiOpen(true);
  };

  const copyToNotes = (text: string) => {
    insertIntoNotes("\n" + text + "\n");
  };

  // Sidebar mock content
  const quickSummary = useMemo(() => (
    "Key points: 1) Define the concept, 2) Show an example, 3) Connect to prior knowledge."
  ), []);
  const aiNotes = useMemo(() => (
    "AI Notes: Bullet highlights, definitions, and mnemonics will appear here as you work."
  ), []);
  const searchResults = useMemo(() => (
    "Search Results: Related topics and references derived from your selection."
  ), []);

  // Timer helpers
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };
  const startTimer = (minutes: number) => {
    const secs = Math.max(1, Math.round(minutes * 60));
    setRemainingSecs(secs);
    setIsTimerRunning(true);
  };

  // Tick interval
  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(() => {
      setRemainingSecs((s) => {
        if (s <= 1) {
          clearInterval(id);
          setIsTimerRunning(false);
          setTimeUpOpen(true);
          pushToast("⏰ Time's up!");
          try {
            if (typeof window !== "undefined" && "navigator" in window && (window as any).navigator.vibrate) {
              (window as any).navigator.vibrate(200);
            }
          } catch {}
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isTimerRunning]);

  // Helpers to get plain text from editor/state
  const htmlToPlainText = (html: string) => {
    const tmp = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (!tmp) return html;
    tmp.innerHTML = html;
    return (tmp.innerText || tmp.textContent || '').trim();
  };
  const getEditorPlainText = () => {
    const el = editorRef.current;
    if (isEditingNotes && el) {
      return (el.innerText || el.textContent || '').trim();
    }
    // Not editing: rely on saved HTML content
    if (notesContentHtml) return htmlToPlainText(notesContentHtml);
    return editorText.trim();
  };

  // Generate a concise summary using Gemini
  const summarizeNotes = async () => {
    const text = getEditorPlainText();
    if (!text) {
      setNotesError("Nothing to summarize. Paste or type some notes first.");
      return;
    }
    try {
      setNotesError("");
      setNotesLoading("summarize");
      const model = getGeminiModel();
      const prompt = `Summarize the following study notes into a concise paragraph and 3-5 bullet points. Keep it accurate and clear.\n\nNotes:\n"""\n${text}\n"""`;
      const res = await model.generateContent(prompt);
      const out = res?.response?.text?.() ?? "";
      setSummaryText(out.trim() || "(No summary generated)");
    } catch (e: any) {
      setNotesError(e?.message || "Failed to generate summary.");
    } finally {
      setNotesLoading(false);
    }
  };

  // Translate notes via built-in Translator API (with fallback) using lib/translate
  const translateNotes = async (lang: string = translateLang) => {
    const text = getEditorPlainText();
    if (!text) {
      setNotesError("Nothing to translate. Paste or type some notes first.");
      return;
    }
    try {
      setNotesError("");
      setNotesLoading("translate");
      setTranslatorProgress(null);
      setTranslatorDownloading(false);

      const result = await translateText(text, lang, {
        onDownloadStart() {
          setTranslatorDownloading(true);
        },
        onDownloadProgress(loaded) {
          setTranslatorProgress(typeof loaded === 'number' ? loaded : null);
        },
      });

      setTranslateText(result.text || '(No translation generated)');
      setTranslatorDownloading(false);
      setTranslatorProgress(null);
      try { console.log(`[Translate] Used: ${result.used} | ${result.sourceLanguage} → ${result.targetLanguage}`); } catch {}
    } catch (e: any) {
      setNotesError(e?.message || 'Failed to translate notes.');
    } finally {
      setNotesLoading(false);
    }
  };

  // Voice read controls using Web Speech API
  const speakAll = () => {
    const text = getEditorPlainText();
    if (!text) {
      pushToast("⚠️ Nothing to read");
      return;
    }
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0;
        u.pitch = 1.0;
        u.onend = () => setTtsSpeaking(false);
        setTtsSpeaking(true);
        window.speechSynthesis.speak(u);
        pushToast("🔊 Reading notes…");
      } else {
        pushToast("⚠️ TTS not supported in this browser");
      }
    } catch {
      pushToast("⚠️ Failed to start TTS");
    }
  };
  const stopSpeak = () => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setTtsSpeaking(false);
      }
    } catch {}
  };

  // Auto-run generators on first switch
  useEffect(() => {
    if (notesTab === "summarize" && !summaryText && !notesLoading) summarizeNotes();
    // Do not auto-run translate; user selects a language first and clicks Translate
    if (notesTab !== "voice") stopSpeak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesTab]);

  return (
    <main className="relative w-full min-h-screen pb-36">{/* padding bottom for dock */}
      {/* Page background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{
          background:
            "radial-gradient(50% 50% at 0% 0%, rgba(139,198,236,0.35) 0%, rgba(139,198,236,0.08) 55%, rgba(139,198,236,0.03) 100%), " +
            "radial-gradient(55% 55% at 100% 100%, rgba(179,255,171,0.35) 0%, rgba(179,255,171,0.08) 55%, rgba(179,255,171,0.02) 100%)"
        }} />
      </div>

      {/* Header Bar */}
      <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 pt-16 ${rightPadClass} transition-[padding] duration-300`}>
        <div className="mb-6 flex items-center justify-between">
          {/* Left: Timer control */}
          <div className="flex items-center gap-2 text-slate-900 dark:text-[--color-accent]">
            {isTimerRunning && showCountdown ? (
              <button
                onClick={() => setTimerOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-white/70 ring-1 ring-red-300/60 px-3 py-1.5 shadow-sm hover:bg-white/90"
                title="Timer running — click to adjust or stop"
              >
                <FaClock className="text-red-500" />
                <span className="text-xl font-bold text-red-600 tabular-nums">{formatTime(remainingSecs)}</span>
              </button>
            ) : (
              <button
                onClick={() => setTimerOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2 hover:bg-blue-200"
                title="Open timer"
              >
                <FaClock />
                <span className="text-lg font-semibold">Timer</span>
              </button>
            )}
          </div>

          {/* Center: Actions */}
          {!focusMode && (
            <div className="hidden sm:flex items-center gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2 hover:bg-blue-200"
                onClick={() => pushToast("📄 Upload coming soon")}
                title="Upload your notes"
              >
                <FaCloudUploadAlt /> Upload Notes
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2 hover:bg-blue-200"
                onClick={() => router.push("/music")}
                title="Generate Study Music"
              >
                <FaMusic /> Generate Study Music
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2 hover:bg-blue-200"
                onClick={() => pushToast("📝 Generating quiz…")}
                title="Generate Quiz"
              >
                <FaQuestionCircle /> Generate Quiz
              </button>
            </div>
          )}

          {/* Right: Focus Mode toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-700 dark:text-slate-300">Focus Mode</span>
            <button
              aria-pressed={focusMode}
              onClick={() => setFocusMode(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${focusMode ? 'bg-blue-500' : 'bg-slate-300'} ring-1 ring-black/10 dark:ring-white/10`}
              title="Hide menus and darken UI"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${focusMode ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </div>

        {/* Center actions on mobile */}
        {!focusMode && (
          <div className="sm:hidden flex items-center justify-center gap-3 mb-4">
            <button className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2" onClick={() => pushToast('📄 Upload coming soon')}>
              <FaCloudUploadAlt /> Upload Notes
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2" onClick={() => router.push('/music')}>
              <FaMusic /> Generate Study Music
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2" onClick={() => pushToast('📝 Generating quiz…')}>
              <FaQuestionCircle /> Generate Quiz
            </button>
          </div>
        )}
      </div>

      {/* Focus mode dim overlay */}
      {focusMode && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-10 bg-black/40 transition-opacity" />
      )}

      {/* AI Popup Mini-Toolbar (appears on selection) */}
      <HighlightToolbar
        visible={toolbarVisible}
        x={toolbarPos.x}
        y={toolbarPos.y}
        onExplain={handleExplain}
        onRead={handleRead}
        onSearch={handleSearch}
      />

      {/* Main card with two-column grid */}
      <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 pb-6 ${rightPadClass} transition-[padding] duration-300`}>
        <div className="bg-white rounded-2xl shadow-lg p-8 ring-1 ring-black/5">
          <div className="grid grid-cols-1 gap-8">
            {/* Notes Panel with Tabs */}
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-slate-900">{notesTitle}</h2>
                <div className="inline-flex rounded-full bg-white/60 ring-1 ring-black/10 p-1">
                  <TabBtn active={notesTab === 'original'} onClick={() => setNotesTab('original')}>Original</TabBtn>
                  <TabBtn active={notesTab === 'summarize'} onClick={() => setNotesTab('summarize')}>Summarize</TabBtn>
                  <TabBtn active={notesTab === 'translate'} onClick={() => setNotesTab('translate')}>Translate</TabBtn>
                  <TabBtn active={notesTab === 'voice'} onClick={() => setNotesTab('voice')}>Voice Read</TabBtn>
                </div>
              </div>

              {/* Content: switch by tab */}
              {notesTab === 'original' && (
                <div>
                  {/* Controls: Edit/Save/Cancel */}
                  <div className="mb-2 flex items-center gap-2 justify-end">
                    {!isEditingNotes ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-black/10 px-3 py-1.5 text-slate-800 hover:bg-white/80"
                        onClick={() => {
                          setIsEditingNotes(true);
                          // prepare editor buffers after next paint
                          setTimeout(() => {
                            if (notesMarkdown) {
                              setMdEditing(notesMarkdown);
                            } else if (editorRef.current) {
                              editorRef.current.innerHTML = notesContentHtml || '';
                            }
                          }, 0);
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-slate-900"
                          onClick={() => {
                            if (notesMarkdown) {
                              const md = mdEditing;
                              setNotesMarkdown(md);
                              const html = mdToHtml(md);
                              setNotesContentHtml(html);
                              const tmp = document.createElement('div');
                              tmp.innerHTML = html;
                              setEditorText((tmp.innerText || tmp.textContent || '').trim());
                              setIsEditingNotes(false);
                              pushToast('💾 Notes saved');
                              return;
                            }
                            const el = editorRef.current;
                            const html = el ? el.innerHTML : notesContentHtml;
                            const plain = el ? (el.innerText || el.textContent || '').trim() : editorText;
                            setNotesContentHtml(html || '');
                            setEditorText(plain);
                            setIsEditingNotes(false);
                            pushToast('💾 Notes saved');
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-black/10 px-3 py-1.5 text-slate-800 hover:bg-white/80"
                          onClick={() => {
                            setIsEditingNotes(false);
                            if (!notesMarkdown) {
                              // revert DOM to saved HTML
                              if (editorRef.current) editorRef.current.innerHTML = notesContentHtml || '';
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>

                  {/* Viewer / Editor */}
                  {!isEditingNotes && (
                    notesMarkdown ? (
                      <div ref={editorRef} className="min-h-[500px] max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 p-4 bg-white">
                        <MarkdownViewer source={notesMarkdown} className="prose max-w-none" />
                      </div>
                    ) : (
                      <div
                        ref={editorRef}
                        className={`min-h-[500px] max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 p-4 leading-7 text-slate-900 bg-white`}
                        dangerouslySetInnerHTML={{ __html: notesContentHtml || '<p class="text-gray-400 select-none">Paste your notes here to get started...</p>' }}
                      />
                    )
                  )}

                  {isEditingNotes && (
                    notesMarkdown ? (
                      <div ref={editorRef} className="min-h-[500px] max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 p-2 bg-white">
                        <MDEditor
                          value={mdEditing}
                          onChange={(val) => setMdEditing(val || "")}
                          height={Math.max(500, Math.min(800, window.innerHeight * 0.6))}
                        />
                      </div>
                    ) : (
                      <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        className={`min-h-[500px] max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 p-4 leading-7 text-slate-900 outline-none focus:ring-2 focus:ring-primary`}
                        onInput={() => { setEditorText(getEditorPlainText()); }}
                        dangerouslySetInnerHTML={{ __html: notesContentHtml || '<p class="text-gray-400 select-none">Paste your notes here to get started...</p>' }}
                      />
                    )
                  )}
                </div>
              )}

              {notesTab === 'summarize' && (
                <div className="min-h-[300px] max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 p-4 bg-white/70">
                  {notesLoading === 'summarize' ? (
                    <p className="text-slate-700">Summarizing…</p>
                  ) : notesError ? (
                    <p className="text-red-600">{notesError}</p>
                  ) : (
                    <article className="prose prose-slate max-w-none">
                      <pre className="whitespace-pre-wrap text-slate-900">{summaryText || "Switch to Original and add some notes, or click Summarize again."}</pre>
                    </article>
                  )}
                  <div className="mt-3 flex justify-end">
                    <button className="rounded-full bg-secondary px-4 py-2 text-slate-900" onClick={() => insertIntoNotes("\n" + (summaryText || "") + "\n")}>Copy to Notes</button>
                  </div>
                </div>
              )}

              {notesTab === 'translate' && (
                <div className="rounded-xl border border-gray-200 p-4 bg-white/70">
                  {/* Controls */}
                  <div className="flex flex-col md:flex-row md:items-end gap-3">
                    <div className="flex-1">
                      <label htmlFor="target-lang" className="block text-sm font-medium text-slate-700 mb-1">Target language</label>
                      <select
                        id="target-lang"
                        className="w-full md:w-64 rounded-lg bg-white ring-1 ring-black/10 px-3 py-2 text-slate-800"
                        value={translateLang}
                        onChange={(e) => setTranslateLang((e.target as HTMLSelectElement).value)}
                      >
                        {[
                          ['es','Spanish'],
                          ['fr','French'],
                          ['de','German'],
                          ['it','Italian'],
                          ['pt','Portuguese'],
                          ['ru','Russian'],
                          ['ja','Japanese'],
                          ['ko','Korean'],
                          ['zh','Chinese'],
                          ['ar','Arabic'],
                          ['hi','Hindi'],
                          ['yo','Yoruba'],
                          ['sw','Swahili'],
                          ['tr','Turkish'],
                          ['nl','Dutch']
                        ].map(([code, label]) => (
                          <option key={code} value={code}>{label} ({code})</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">Choose the language and click Translate. You can translate again into another language anytime.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-slate-900 disabled:opacity-60"
                        disabled={notesLoading === 'translate'}
                        onClick={() => translateNotes(translateLang)}
                        title="Translate notes"
                      >
                        {notesLoading === 'translate' ? 'Translating…' : 'Translate'}
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-black/10 px-4 py-2 text-slate-800"
                        onClick={() => { setTranslateText(''); setNotesError(''); }}
                        title="Clear translated text"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Download / availability status */}
                  {translatorDownloading && (
                    <div className="mt-2 text-xs text-slate-600">Downloading translation model… {translatorProgress !== null ? Math.round((translatorProgress as number) * 100) + '%' : ''}</div>
                  )}

                  {/* Result */}
                  <div className="mt-4 min-h-[220px] max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200 bg-white/60 p-3">
                    {notesLoading === 'translate' ? (
                      <p className="text-slate-700">Translating…</p>
                    ) : notesError ? (
                      <p className="text-red-600">{notesError}</p>
                    ) : (
                      <article className="prose prose-slate max-w-none">
                        <pre className="whitespace-pre-wrap text-slate-900">{translatedText || "No translation yet. Select a language and click Translate."}</pre>
                      </article>
                    )}
                  </div>

                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-xs text-slate-500">Target: <strong className="text-slate-700">{translateLang}</strong></span>
                    <div className="flex items-center gap-2">
                      <button className="rounded-full bg-secondary px-4 py-2 text-slate-900" onClick={() => insertIntoNotes('\n' + (translatedText || '') + '\n')} disabled={!translatedText}>Copy to Notes</button>
                    </div>
                  </div>
                </div>
              )}

              {notesTab === 'voice' && (
                <div className="rounded-xl border border-gray-200 p-4 bg-white/70">
                  <p className="text-slate-700">Use Voice Read to listen to your entire notes content. This uses your browser's built-in text-to-speech.</p>
                  <div className="mt-3 flex items-center gap-2">
                    {!ttsSpeaking ? (
                      <button className="rounded-full bg-primary px-4 py-2 text-slate-900" onClick={speakAll}>Start Reading</button>
                    ) : (
                      <button className="rounded-full bg-red-500 px-4 py-2 text-white" onClick={stopSpeak}>Stop</button>
                    )}
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
      </div>

      {/* Floating Chat FAB */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-28 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-slate-900 font-medium shadow-[0_8px_16px_rgba(0,0,0,0.15)] hover:brightness-105 active:translate-y-px"
        title="Open chat assistant"
      >
        <FaComments /> Chat
      </button>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        typing={chatTyping}
        botName="Knotes AI"
        botAvatarUrl="https://chatscope.io/storybook/react/assets/zoe-E7ZdmXF0.svg"
        userName={userDisplay}
        userAvatarUrl=""
        onSend={(text) => {
          setChatMessages((m) => [...m, { role: 'user', text }]);
          setChatTyping(true);
          const context = selectedText?.trim() ? `Regarding your selection: "${selectedText.slice(0, 200)}"` : "";
          setTimeout(() => {
            setChatMessages((m) => [
              ...m,
              { role: 'ai', text: `Here’s a helpful note. ${context} — This is a placeholder response you can wire to AI later.` },
            ]);
            setChatTyping(false);
          }, 600);
        }}
      />

      {/* Bottom Music Dock */}
      <MusicDock
        isPlaying={isPlaying}
        volume={volume}
        genre={genre}
        onPlayPause={() => setIsPlaying((p) => !p)}
        onPrev={() => pushToast("⏮️ Replaying previous")}
        onNext={() => pushToast("⏭️ Skipping to next")}
        onVolume={(v) => setVolume(v)}
        onGenre={(g) => setGenre(g)}
        onRegen={() => pushToast(`✨ Regenerating ${genre} soundtrack…`)}
        onDownload={() => pushToast("⬇️ Download started")}
        onConvert={() => pushToast(`🎼 Converting notes to ${genre} track…`)}
      />

      {/* Timer Settings Modal */}
      {timerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setTimerOpen(false); }}
        >
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-accent/95 dark:bg-[--color-dark-bg]/95 ring-1 ring-black/10 dark:ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">Timer</h3>
              <button
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/5 text-slate-700 dark:text-[--color-accent] hover:bg-white/80"
                onClick={() => setTimerOpen(false)}
              >
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 text-slate-800 dark:text-slate-200">
              <div className="flex gap-2">
                <button
                  className={`flex-1 rounded-lg px-3 py-2 ring-1 ${timerMode === 'pomodoro' ? 'bg-primary text-slate-900 ring-primary/50' : 'bg-white/70 dark:bg-white/5 ring-black/10 dark:ring-white/10'}`}
                  onClick={() => setTimerMode('pomodoro')}
                >
                  Pomodoro (25 min)
                </button>
                <button
                  className={`flex-1 rounded-lg px-3 py-2 ring-1 ${timerMode === 'custom' ? 'bg-primary text-slate-900 ring-primary/50' : 'bg-white/70 dark:bg-white/5 ring-black/10 dark:ring-white/10'}`}
                  onClick={() => setTimerMode('custom')}
                >
                  Custom
                </button>
              </div>

              {timerMode === 'custom' && (
                <div className="flex items-center gap-3">
                  <label htmlFor="minutes" className="text-sm text-slate-600 dark:text-slate-300">Minutes</label>
                  <input
                    id="minutes"
                    type="number"
                    min={1}
                    max={180}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Math.max(1, Math.min(180, Number(e.target.value) || 0)))}
                    className="w-24 rounded-lg bg-white/80 dark:bg-white/5 ring-1 ring-black/10 dark:ring-white/10 p-2 text-slate-900 dark:text-[--color-accent]"
                  />
                </div>
              )}

              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showCountdown}
                  onChange={(e) => setShowCountdown(e.target.checked)}
                />
                Show countdown in header
              </label>

              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {isTimerRunning ? (
                    <>Remaining: <span className="font-semibold text-red-600">{formatTime(remainingSecs)}</span></>
                  ) : (
                    <>Not running</>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isTimerRunning ? (
                    <>
                      <button
                        className="rounded-lg px-4 py-2 ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/5 hover:bg-white/90"
                        onClick={() => { setIsTimerRunning(false); setRemainingSecs(0); }}
                      >
                        Stop
                      </button>
                      <button
                        className="rounded-lg px-4 py-2 bg-primary text-slate-900 font-medium"
                        onClick={() => { setRemainingSecs((timerMode === 'pomodoro' ? 25 : customMinutes) * 60); setIsTimerRunning(true); }}
                      >
                        Restart
                      </button>
                    </>
                  ) : (
                    <button
                      className="rounded-lg px-4 py-2 bg-primary text-slate-900 font-medium"
                      onClick={() => {
                        const mins = timerMode === 'pomodoro' ? 25 : customMinutes;
                        startTimer(mins);
                        setTimerOpen(false);
                      }}
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Up Modal */}
      {timeUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={() => setTimeUpOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white ring-1 ring-black/10 shadow-xl p-6 text-center">
            <h4 className="text-xl font-semibold text-slate-900 mb-2">Time's up!</h4>
            <p className="text-slate-700 mb-4">Great job. Take a short break and resume when ready.</p>
            <button className="rounded-full bg-primary px-6 py-2 text-slate-900 font-medium" onClick={() => setTimeUpOpen(false)}>OK</button>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {aiOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setAiOpen(false); }}
        >
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-2xl rounded-3xl bg-accent/95 dark:bg-[--color-dark-bg]/95 ring-1 ring-black/10 dark:ring-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 gap-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">AI Assistant</h3>
              <div className="inline-flex rounded-full bg-white/50 dark:bg-white/10 p-1">
                <TabBtn active={aiTab === "explain"} onClick={() => setAiTab("explain")}>
                  Explain
                </TabBtn>
                <TabBtn active={aiTab === "summarize"} onClick={() => setAiTab("summarize")}>
                  Summarize
                </TabBtn>
                <TabBtn active={aiTab === "translate"} onClick={() => setAiTab("translate")}>
                  Translate
                </TabBtn>
                <TabBtn active={aiTab === "rewrite"} onClick={() => setAiTab("rewrite")}>
                  Rewrite
                </TabBtn>
              </div>
              <button
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/5 text-slate-700 dark:text-[--color-accent] hover:bg-white/80"
                onClick={() => setAiOpen(false)}
              >
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="px-6 py-5 max-h-[45vh] overflow-auto text-slate-900 dark:text-slate-100">
              <p className="whitespace-pre-wrap leading-7">{aiOutput || "AI is ready. Choose a tab or run an action from the toolbar."}</p>
            </div>
            <div className="px-6 pb-6">
              <button
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 text-slate-900 font-medium shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px"
                title="Add this explanation directly into your notes."
                onClick={() => insertIntoNotes("\n" + (aiOutput || "(No output)") + "\n")}
              >
                <FaCopy /> Insert Back into Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-24 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-xl bg-slate-900/90 text-white px-3 py-2 text-sm shadow-lg ring-1 ring-black/20">
            {t.message}
          </div>
        ))}
      </div>
    </main>
  );
}

function ToolBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-[--color-accent] hover:bg-black/5 dark:hover:bg-white/10"
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Panel({ title, open, onToggle, onCopy, children }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onCopy: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 bg-white/80 dark:bg-white/5">
      <div className="flex items-center justify-between px-4 py-3">
        <button className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-[--color-accent]" onClick={onToggle}>
          {open ? <FaChevronDown /> : <FaChevronRight />} {title}
        </button>
        <button className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-primary ring-1 ring-primary/40 hover:bg-primary/10" onClick={onCopy}>
          <FaCopy /> Copy to Notes
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}


function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`px-3 py-1 rounded-full text-sm ${active ? "bg-primary text-slate-900" : "text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-white/10"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}