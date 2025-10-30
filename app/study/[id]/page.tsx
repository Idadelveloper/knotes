"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaSearch, FaBrain, FaGlobe, FaPenFancy, FaCopy, FaChevronDown, FaChevronRight, FaDownload, FaMagic, FaVolumeUp as FaVolume, FaCloudUploadAlt, FaMusic, FaChartBar, FaQuestionCircle, FaClock, FaComments } from "react-icons/fa";
import HighlightToolbar from "@/components/HighlightToolbar";
import { HiOutlineX } from "react-icons/hi";
import ChatPanel from "@/components/ChatPanel";
import { useRouter, useParams } from "next/navigation";
import MusicGenerator from "@/components/music/MusicGenerator";
import MusicPlayer from "@/components/music/MusicPlayer";
import { useAuth } from "@/components/AuthProvider";
import { getGeminiModel } from "@/lib/ai";
import { translateText } from "@/lib/translate";
import { summarizeText, isSummarizerAvailable } from "@/lib/summarize";
import { promptWithNotes } from "@/lib/prompt";
import MarkdownViewer from "@/components/MarkdownViewer";
import MDEditor from "@uiw/react-md-editor";
import { addRecentSession, addStudyMinutes } from "@/lib/stats";
import { updateEditableText, getSession } from "@/lib/storage/sessions";

// Simple toast system
type Toast = { id: number; message: string };

export default function StudyWorkspace() {
  const router = useRouter();
  const params = useParams();
  const routeId = Array.isArray((params as any)?.id) ? (params as any).id[0] : ((params as any)?.id as string | undefined);
  // When arriving via /study/[id], populate sessionStorage for this session so the workspace can load content.
  useEffect(() => {
    if (!routeId) return;
    try {
      const sess = getSession(routeId);
      if (sess) {
        sessionStorage.setItem("knotes_current_session_id", sess.id);
        sessionStorage.setItem("knotes_extracted_text", sess.originalText);
        sessionStorage.setItem("knotes_structured_text", (sess.editableText || sess.structuredText || sess.originalText));
        sessionStorage.setItem("knotes_title", sess.title || "Study Notes");
      }
    } catch {}
  }, [routeId]);

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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: "Hi! I’m your study assistant. Ask me to explain, summarize, or quiz you based on your notes." }
  ]);
  const [chatTyping, setChatTyping] = useState(false);
  // Voice chat state
  const [recording, setRecording] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // When chat is open, reserve space on the right on md+ so notes and chat sit side-by-side
  const rightPadClass = chatOpen ? "md:pr-[32rem]" : "";

  const sendChat = async (text: string) => {
    const userMsg = (text || "").trim();
    if (!userMsg) return;
    setChatMessages((m) => [...m, { role: 'user', text: userMsg }]);

    // Build contextual notes from current state (prefer markdown, else HTML/plain)
    const notesContext = notesMarkdown?.trim()
      ? notesMarkdown
      : getEditorPlainText();

    try {
      setChatTyping(true);
      const { text, used } = await promptWithNotes(notesContext || '', userMsg, {
        onDownloadStart: () => {
          try { console.log('[Chat] Downloading on-device model…'); } catch {}
        },
        onDownloadProgress: (loaded) => {
          try { console.log('[Chat] Model download progress:', loaded); } catch {}
        },
      });
      setChatMessages((m) => [...m, { role: 'ai', text: text || '(No response)'}]);
      // Optional: Speak the AI reply if enabled
      try {
        if (speakEnabled) {
          const { speak } = await import('@/lib/utils/speech');
          await speak(text || '', { rate: 1.0, pitch: 1.0 });
        }
      } catch (e) {
        try { console.warn('[Chat] TTS failed', e); } catch {}
      }
      try { console.log(`[Chat] Reply via ${used}`); } catch {}
    } catch (e: any) {
      console.warn('[Chat] promptWithNotes failed:', e);
      setChatMessages((m) => [...m, { role: 'ai', text: 'Sorry, I ran into a problem answering that. Please try again.' }]);
    } finally {
      setChatTyping(false);
    }
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

  // Music dropdown + settings trigger
  const [musicMenuOpen, setMusicMenuOpen] = useState(false);
  const [musicSettingsSignal, setMusicSettingsSignal] = useState(0);

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

  // Summarize settings (built-in Summarizer API or Gemini fallback)
  const [summarizeType, setSummarizeType] = useState<'key-points' | 'tldr' | 'teaser' | 'headline'>('key-points');
  const [summarizeFormat, setSummarizeFormat] = useState<'markdown' | 'plain-text'>('markdown');
  const [summarizeLength, setSummarizeLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [sharedContext, setSharedContext] = useState<string>("");
  const [requestContext, setRequestContext] = useState<string>("");
  const [expectedInputLanguages, setExpectedInputLanguages] = useState<string>("en");
  const [expectedContextLanguages, setExpectedContextLanguages] = useState<string>("en");
  const [outputLanguage, setOutputLanguage] = useState<string>("");
  const [summarizerAvailable, setSummarizerAvailable] = useState<boolean | null>(null);
  const [summarizerDownloading, setSummarizerDownloading] = useState<boolean>(false);
  const [summarizerProgress, setSummarizerProgress] = useState<number | null>(null);
  const [summaryUsedEngine, setSummaryUsedEngine] = useState<'summarizer' | 'gemini' | ''>('');

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
        const level = (line.match(/^#+/)! [0].length);
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

  // Record recent session when title becomes available (prefer dynamic session id if present)
  useEffect(() => {
    if (!notesTitle || !notesTitle.trim()) return;
    try {
      const sid = typeof window !== 'undefined' ? sessionStorage.getItem('knotes_current_session_id') : null;
      const href = sid ? `/study/${sid}` : '/study';
      addRecentSession({ id: sid || `${Date.now()}:${notesTitle}`, title: notesTitle.trim(), openedAt: new Date().toISOString(), href });
    } catch {}
  }, [notesTitle]);

  // Simple study timer: accumulate minutes on unmount or page unload
  const studyStartRef = useRef<number | null>(null);
  useEffect(() => {
    studyStartRef.current = Date.now();
    const onBeforeUnload = () => {
      if (studyStartRef.current) {
        const elapsedMs = Date.now() - studyStartRef.current;
        const minutes = Math.max(0, Math.round(elapsedMs / 60000));
        if (minutes > 0) {
          try { addStudyMinutes(minutes); } catch {}
        }
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      onBeforeUnload();
    };
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
        (editor as any).append(text);
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
    const text = (selectedText || '').trim();
    if (!text) {
      pushToast('👆 Highlight some text first, then tap Explain.');
      return;
    }
    const MAX = 1500;
    const isLong = text.length > MAX;
    const excerpt = isLong ? text.slice(0, MAX) + '…' : text;

    // Open chat and immediately send a context-rich explanation prompt
    setChatOpen(true);

    const userPrompt = `Explain the following highlighted passage in clear, student-friendly terms. Use my current notes as primary context, and include:\n- A concise overview in 2–3 sentences\n- Step-by-step reasoning or derivation if applicable\n- A simple example or analogy\n- 5–10 key takeaways as bullet points\nIf math is present, format formulas clearly.\n\nHighlighted passage:\n"""\n${excerpt}\n"""${isLong ? '\n\n(Note: Excerpt truncated for length.)' : ''}`;

    // Clear any draft and send now
    try { setChatInput(''); } catch {}
    sendChat(userPrompt);
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

  // Generate a summary using built-in Summarizer API (with fallback) using lib/summarize
  const summarizeNotes = async () => {
    const text = getEditorPlainText();
    if (!text) {
      setNotesError("Nothing to summarize. Paste or type some notes first.");
      return;
    }
    try {
      setNotesError("");
      setNotesLoading("summarize");
      setSummarizerProgress(null);
      setSummarizerDownloading(false);
      setSummaryUsedEngine('');

      const parseCsv = (s: string) => (s || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

      const result = await summarizeText(text, {
        type: summarizeType,
        format: summarizeFormat,
        length: summarizeLength,
        sharedContext: sharedContext || undefined,
        context: requestContext || undefined,
        expectedInputLanguages: parseCsv(expectedInputLanguages),
        expectedContextLanguages: parseCsv(expectedContextLanguages),
        outputLanguage: outputLanguage || undefined,
        onDownloadStart() {
          setSummarizerDownloading(true);
        },
        onDownloadProgress(loaded) {
          setSummarizerProgress(typeof loaded === 'number' ? loaded : null);
        },
      });

      setSummaryText(result.text || '(No summary generated)');
      setSummaryUsedEngine(result.used);
      setSummarizerDownloading(false);
      setSummarizerProgress(null);
      try { console.log(`[Summarize] Used: ${result.used}`); } catch {}
    } catch (e: any) {
      setNotesError(e?.message || 'Failed to summarize notes.');
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

  // Voice read controls using Gemini TTS + MusicPlayer
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [voiceGenerating, setVoiceGenerating] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string>("");
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | undefined>(undefined);
  const [voiceDownloadUrl, setVoiceDownloadUrl] = useState<string | undefined>(undefined);
  const [playerOpen, setPlayerOpen] = useState<boolean>(false);
  const [playerState, setPlayerState] = useState<"playing" | "paused" | "stopped">("stopped");

  const playInPlayer = (audioUrl: string, title: string) => {
    setVoiceAudioUrl(audioUrl);
    setPlayerState("playing");
    setPlayerOpen(true);
    pushToast("🔊 Playing audio");
  };

  async function toBlobUrl(url?: string): Promise<string | undefined> {
    if (!url) return undefined;
    try {
      if (url.startsWith('data:')) {
        const res = await fetch(url);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
      return url;
    } catch {
      return url;
    }
  }

  const startVoiceRead = async () => {
    const sid = typeof window !== 'undefined' ? sessionStorage.getItem('knotes_current_session_id') : null;
    const title = typeof window !== 'undefined' ? (sessionStorage.getItem('knotes_title') || 'Study Notes') : 'Study Notes';
    const rawText = getEditorPlainText();
    if (!rawText) { pushToast('⚠️ Nothing to read'); return; }

    try {
      setVoiceError("");
      setVoiceGenerating(true);

      // 1) If we already have a saved audio track for this session, reuse it
      const { findTrackBySession, addTrack } = await import('@/lib/storage/music');
      const existing = sid ? findTrackBySession(sid, 'lyrics') : null;
      if (existing && existing.audioUrl) {
        setVoiceTranscript(existing.lyrics || "");
        const playUrl = await toBlobUrl(existing.audioUrl);
        setVoiceDownloadUrl(existing.audioUrl);
        if (playUrl) playInPlayer(playUrl, existing.title || title);
        setTtsSpeaking(false);
        return;
      }

      // 2) Build an audio-friendly transcript (rewrite to filter out non-topic details)
      const { buildAudioTranscriptPrompt, generateTTS } = await import('@/lib/tts');
      const prompt = buildAudioTranscriptPrompt(rawText);
      // We can reuse our general Gemini model to create the transcript text first
      const { getGeminiModel } = await import('@/lib/ai');
      const model = getGeminiModel('gemini-2.0-flash');
      const transcriptRes = await model.generateContent(prompt);
      let transcript = (transcriptRes?.response?.text?.() as string)?.trim() || '';
      // If transcript seems empty or too short to be useful, fall back to original notes text
      if (!transcript || transcript.replace(/\s+/g, '').length < 40) {
        transcript = rawText;
      }
      setVoiceTranscript(transcript);

      // 3) Send transcript to TTS model
      const tts = await generateTTS(transcript, { voiceName: 'Kore' });
      // Use Blob URL for playback reliability; save Data URL for persistence/download
      const playUrl = tts.blobUrl;
      const downloadUrl = tts.dataUrl;

      // 4) Save as a lyrics Track so it appears in Music and is downloadable
      const trackTitle = title; // Name audio same as the session title
      const track = addTrack({
        id: sid ? `aud_${sid}` : undefined,
        title: trackTitle,
        kind: 'lyrics',
        audioUrl: downloadUrl,
        lyrics: transcript,
        sessionId: sid || undefined,
      } as any);
      // Persisted via addTrack; ensure index updated

      setVoiceDownloadUrl(downloadUrl);
      playInPlayer(playUrl, trackTitle);
      setTtsSpeaking(false);
    } catch (e: any) {
      console.warn('[VoiceRead] Failed:', e);
      setVoiceError(e?.message || 'Failed to generate audio');
      pushToast('⚠️ Failed to generate audio');
    } finally {
      setVoiceGenerating(false);
    }
  };

  const stopVoice = () => {
    setPlayerState('stopped');
  };

  // Auto-run settings on tab switch (no auto-summarize; require explicit click)
  useEffect(() => {
    if (notesTab === 'summarize') {
      // Check availability when entering the tab
      (async () => {
        try {
          const ok = await isSummarizerAvailable();
          setSummarizerAvailable(ok);
        } catch {
          setSummarizerAvailable(false);
        }
      })();
    }
    if (notesTab !== 'voice') {
      setPlayerState('stopped');
    } else {
      // Preload any existing generated audio/transcript for this session
      (async () => {
        try {
          const sid = typeof window !== 'undefined' ? sessionStorage.getItem('knotes_current_session_id') : null;
          if (!sid) return;
          const { findTrackBySession } = await import('@/lib/storage/music');
          const existing = findTrackBySession(sid, 'lyrics');
          if (existing) {
            if (existing.lyrics) setVoiceTranscript(existing.lyrics);
            if (existing.audioUrl) {
              setVoiceDownloadUrl(existing.audioUrl);
              const playUrl = await toBlobUrl(existing.audioUrl);
              if (playUrl) setVoiceAudioUrl(playUrl);
            }
          }
        } catch {}
      })();
    }
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
              <div className="relative">
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2 hover:bg-blue-200"
                  onClick={() => setMusicMenuOpen(v => !v)}
                  title="Generate Study Music"
                  aria-haspopup="menu"
                  aria-expanded={musicMenuOpen}
                >
                  <FaMusic /> Generate Study Music <span aria-hidden>▾</span>
                </button>
                {musicMenuOpen && (
                  <div role="menu" className="absolute z-20 mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black/10 overflow-hidden">
                    <button
                      role="menuitem"
                      className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-100"
                      onClick={() => { setMusicMenuOpen(false); setMusicSettingsSignal(s => s + 1); }}
                    >
                      Background music
                    </button>
                    <button
                      role="menuitem"
                      className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-100"
                      onClick={() => { setMusicMenuOpen(false); try { const sid = sessionStorage.getItem('knotes_current_session_id'); router.push(sid ? `/music/${sid}` : '/music'); } catch { router.push('/music'); } }}
                    >
                      Compose Music
                    </button>
                  </div>
                )}
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2 hover:bg-blue-200"
                onClick={() => { pushToast("📝 Generating quiz…"); try { const sid = sessionStorage.getItem('knotes_current_session_id'); if (sid) router.push(`/study/${sid}/quiz`); else router.push(`/study/${routeId || ''}/quiz`); } catch { const sid = typeof window !== 'undefined' ? (sessionStorage.getItem('knotes_current_session_id') || routeId || '') : (routeId || ''); router.push(`/study/${sid}/quiz`); } }}
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
            <div className="relative">
              <button className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2" onClick={() => setMusicMenuOpen(v => !v)} aria-haspopup="menu" aria-expanded={musicMenuOpen}>
                <FaMusic /> Generate Study Music <span aria-hidden>▾</span>
              </button>
              {musicMenuOpen && (
                <div role="menu" className="absolute right-0 z-20 mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black/10 overflow-hidden">
                  <button role="menuitem" className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-100" onClick={() => { setMusicMenuOpen(false); setMusicSettingsSignal(s => s + 1); }}>
                    Background music
                  </button>
                  <button role="menuitem" className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-100" onClick={() => { setMusicMenuOpen(false); try { const sid = sessionStorage.getItem('knotes_current_session_id'); router.push(sid ? `/music/${sid}` : '/library?intent=music'); } catch { router.push('/library?intent=music'); } }}>
                    Compose Music
                  </button>
                </div>
              )}
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-blue-100 text-blue-700 px-4 py-2" onClick={() => { pushToast('📝 Generating quiz…'); try { const sid = sessionStorage.getItem('knotes_current_session_id'); if (sid) router.push(`/study/${sid}/quiz`); else router.push(`/study/${routeId || ''}/quiz`); } catch { const sid = typeof window !== 'undefined' ? (sessionStorage.getItem('knotes_current_session_id') || routeId || '') : (routeId || ''); router.push(`/study/${sid}/quiz`); } }}>
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
                      <>
                        <button
                          className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-black/10 px-3 py-1.5 text-slate-800 hover:bg-white/80"
                          onClick={() => {
                            setIsEditingNotes(true);
                            // prepare editor buffers after next paint
                            setTimeout(() => {
                              if (notesMarkdown) {
                                setMdEditing(notesMarkdown);
                              } else if (editorRef.current) {
                                (editorRef.current as any).innerHTML = notesContentHtml || '';
                              }
                            }, 0);
                          }}
                        >
                          Edit
                        </button>
                        {notesMarkdown && (
                          <button
                            className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-black/10 px-3 py-1.5 text-slate-800 hover:bg-white/80"
                            onClick={() => {
                              try {
                                const sid = sessionStorage.getItem('knotes_current_session_id');
                                if (!sid) return;
                                const sess = getSession(sid);
                                const md = (sess?.structuredText || sess?.originalText || notesMarkdown) as string;
                                setNotesMarkdown(md);
                                const html = mdToHtml(md);
                                setNotesContentHtml(html);
                                const tmp = document.createElement('div');
                                tmp.innerHTML = html;
                                setEditorText((tmp.innerText || tmp.textContent || '').trim());
                                updateEditableText(sid, md);
                                try { sessionStorage.setItem('knotes_structured_text', md); } catch {}
                                // Persist restored version for refreshes
                                try {
                                  localStorage.setItem('knotes_persist_markdown', md);
                                  localStorage.setItem('knotes_persist_html', html);
                                } catch {}
                                pushToast('🔁 Restored original');
                              } catch {}
                            }}
                          >
                            Reset to Original
                          </button>
                        )}
                      </>
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
                              try {
                                const sid = sessionStorage.getItem('knotes_current_session_id');
                                if (sid) {
                                  updateEditableText(sid, md);
                                }
                                try { sessionStorage.setItem('knotes_structured_text', md); } catch {}
                                // Persist across reloads
                                try {
                                  localStorage.setItem('knotes_persist_markdown', md);
                                  localStorage.setItem('knotes_persist_html', html);
                                } catch {}
                              } catch {}
                              setIsEditingNotes(false);
                              pushToast('💾 Notes saved');
                              return;
                            }
                            const el = editorRef.current;
                            const html = el ? (el as any).innerHTML : notesContentHtml;
                            const plain = el ? ((el as any).innerText || (el as any).textContent || '').trim() : editorText;
                            setNotesContentHtml(html || '');
                            setEditorText(plain);
                            // Persist HTML-based edits for non-Markdown sessions
                            try { if (html) localStorage.setItem('knotes_persist_html', html); } catch {}
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
                              if (editorRef.current) (editorRef.current as any).innerHTML = notesContentHtml || '';
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
                          height={Math.max(500, Math.min(800, typeof window !== 'undefined' ? window.innerHeight * 0.6 : 600))}
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
                <div className="rounded-xl border border-gray-200 p-4 bg-white/70">
                  {/* Controls */}
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                        <select className="w-full rounded-lg bg-white ring-1 ring-black/10 px-3 py-2 text-slate-800" value={summarizeType} onChange={(e) => setSummarizeType((e.target as HTMLSelectElement).value as any)}>
                          <option value="key-points">Key points</option>
                          <option value="tldr">TL;DR</option>
                          <option value="teaser">Teaser</option>
                          <option value="headline">Headline</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Format</label>
                        <select className="w-full rounded-lg bg-white ring-1 ring-black/10 px-3 py-2 text-slate-800" value={summarizeFormat} onChange={(e) => setSummarizeFormat((e.target as HTMLSelectElement).value as any)}>
                          <option value="markdown">Markdown</option>
                          <option value="plain-text">Plain text</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Length</label>
                        <select className="w-full rounded-lg bg-white ring-1 ring-black/10 px-3 py-2 text-slate-800" value={summarizeLength} onChange={(e) => setSummarizeLength((e.target as HTMLSelectElement).value as any)}>
                          <option value="short">Short</option>
                          <option value="medium">Medium</option>
                          <option value="long">Long</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-slate-900 disabled:opacity-60"
                        disabled={notesLoading === 'summarize'}
                        onClick={summarizeNotes}
                        title="Generate summary"
                      >
                        {notesLoading === 'summarize' ? 'Summarizing…' : 'Generate Summary'}
                      </button>
                      <button
                        className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-black/10 px-4 py-2 text-slate-800"
                        onClick={() => { setSummaryText(''); setNotesError(''); setSummaryUsedEngine(''); }}
                        title="Clear summary"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Advanced context and languages */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Shared context (optional)</label>
                      <input className="w-full rounded-lg bg-white ring-1 ring-black/10 px-3 py-2 text-slate-800" placeholder="e.g., This is a scientific article" value={sharedContext} onChange={(e) => setSharedContext((e.target as HTMLInputElement).value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Request context (optional)</label>
                      <input className="w-full rounded-lg bg-white ring-1 ring-black/10 px-3 py-2 text-slate-800" placeholder="e.g., Audience is junior developers" value={requestContext} onChange={(e) => setRequestContext((e.target as HTMLInputElement).value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Expected input languages (CSV)</label>
                      <input className="w-full rounded-lg bg-white ring-1 ring-black/10 px-3 py-2 text-slate-800" placeholder="en,ja,es" value={expectedInputLanguages} onChange={(e) => setExpectedInputLanguages((e.target as HTMLInputElement).value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Expected context languages (CSV)</label>
                      <input className="w-full rounded-lg bg-white ring-1 ring-black/10 px-3 py-2 text-slate-800" placeholder="en" value={expectedContextLanguages} onChange={(e) => setExpectedContextLanguages((e.target as HTMLInputElement).value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Output language (optional)</label>
                      <input className="w-full rounded-lg bg-white ring-1 ring-black/10 px-3 py-2 text-slate-800" placeholder="e.g., es" value={outputLanguage} onChange={(e) => setOutputLanguage((e.target as HTMLInputElement).value)} />
                    </div>
                  </div>

                  {/* Availability / download status */}
                  <div className="mt-2 text-xs text-slate-600">
                    {summarizerAvailable === null ? (
                      <span>Checking Summarizer support…</span>
                    ) : summarizerAvailable ? (
                      <span>Built-in Summarizer API detected. {summarizerDownloading ? `Downloading model… ${Math.round((summarizerProgress || 0) * 100)}%` : ''}</span>
                    ) : (
                      <span>Summarizer API not available. Falling back to Gemini automatically.</span>
                    )}
                    {summaryUsedEngine && (
                      <span className="ml-2">Last run via: <strong>{summaryUsedEngine}</strong></span>
                    )}
                  </div>

                  {/* Output */}
                  <div className="mt-4 min-h-[200px] max-h-[40vh] overflow-y-auto rounded-xl border border-gray-200 p-4 bg-white">
                    {notesLoading === 'summarize' ? (
                      <p className="text-slate-700">Summarizing…</p>
                    ) : notesError ? (
                      <p className="text-red-600">{notesError}</p>
                    ) : summarizeFormat === 'markdown' ? (
                      <div className="-m-2">
                        <MDEditor
                          value={summaryText}
                          onChange={(val) => setSummaryText(val || "")}
                          height={Math.max(220, Math.min(500, typeof window !== 'undefined' ? window.innerHeight * 0.4 : 400))}
                        />
                      </div>
                    ) : (
                      <article className="prose prose-slate max-w-none">
                        <pre className="whitespace-pre-wrap text-slate-900">{summaryText || 'Adjust settings above, then click Generate Summary.'}</pre>
                      </article>
                    )}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button className="rounded-full bg-secondary px-4 py-2 text-slate-900" onClick={() => insertIntoNotes("\n" + (summaryText || "") + "\n")} disabled={!summaryText}>Copy to Notes</button>
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
                          <option key={code as string} value={code as string}>{label as string} ({code as string})</option>
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
                      <div className="-m-2">
                        <MDEditor
                          value={translatedText}
                          onChange={(val) => setTranslateText(val || "")}
                          height={Math.max(220, Math.min(500, typeof window !== 'undefined' ? window.innerHeight * 0.5 : 400))}
                        />
                      </div>
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
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-slate-700">Generate an audio-friendly transcript and listen to it. We'll filter out logistics like attendance and instructor details, focusing on the main topic.</p>
                      {voiceTranscript ? (
                        <div className="mt-3 max-h-64 overflow-auto rounded-lg bg-white ring-1 ring-black/10 p-3 whitespace-pre-wrap text-slate-800 text-sm">
                          {voiceTranscript}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-500">Transcript will appear here after generation.</div>
                      )}
                      {voiceError && (
                        <div className="mt-2 text-sm text-red-600">{voiceError}</div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <button className="rounded-full bg-primary px-4 py-2 text-slate-900 disabled:opacity-50" onClick={startVoiceRead} disabled={voiceGenerating}>
                          {voiceGenerating ? 'Generating…' : (voiceAudioUrl ? 'Play Audio' : 'Start Reading')}
                        </button>
                        {voiceAudioUrl && (
                          <button className="rounded-full bg-white ring-1 ring-black/10 px-4 py-2 text-slate-800" onClick={() => playInPlayer(voiceAudioUrl!, (typeof window !== 'undefined' ? (sessionStorage.getItem('knotes_title') || 'Study Notes') : 'Study Notes'))}>
                            Play Again
                          </button>
                        )}
                        {(voiceDownloadUrl || voiceAudioUrl) && (
                          <a className="rounded-full bg-white ring-1 ring-black/10 px-4 py-2 text-slate-800" href={(voiceDownloadUrl || voiceAudioUrl)!} download={(typeof window !== 'undefined' ? (sessionStorage.getItem('knotes_title') || 'audio') : 'audio') + ((voiceDownloadUrl || voiceAudioUrl)?.startsWith('data:audio/mpeg') ? '.mp3' : '.wav')}>
                            Download Audio
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
      </div>

      {/* Inline Music Player for Voice Read */}
      {playerOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto w-full max-w-5xl px-3 pb-2">
            <MusicPlayer
              trackTitle={(typeof window !== 'undefined' ? (sessionStorage.getItem('knotes_title') || 'Audio Notes') : 'Audio Notes')}
              playbackState={playerState as any}
              isGenerating={voiceGenerating}
              audioUrl={voiceAudioUrl}
              onPlayPause={() => setPlayerState((s) => (s === 'playing' ? 'paused' : 'playing'))}
              onStop={() => { setPlayerState('stopped'); }}
              onTweakSettings={() => { /* no-op for voice */ }}
              onRegenerate={() => { /* no-op for voice */ }}
              onDownload={() => {
                try {
                  const url = voiceDownloadUrl || voiceAudioUrl;
                  if (!url) return;
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = ((typeof window !== 'undefined' ? (sessionStorage.getItem('knotes_title') || 'audio') : 'audio') + (url?.startsWith('data:audio/mpeg') ? '.mp3' : '.wav'));
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                } catch {}
              }}
            />
          </div>
        </div>
      )}

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
          // Delegate to the prompt-powered handler that uses the user's notes as context
          sendChat(text);
        }}
        onMicStart={async () => {
          try {
            if (recording) return;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];
            mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.onstop = async () => {
              setRecording(false);
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              // Transcribe via Firebase AI Logic (Gemini) using generateContent with audio file part
              try {
                setChatTyping(true);
                const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
                const { fileToGenerativePart, getGeminiModel } = await import('@/lib/ai');
                const part = await fileToGenerativePart(file);
                const model = getGeminiModel('gemini-2.5-flash');
                const prompt = 'Transcribe this user audio into accurate text for a study assistant chat.';
                const result = await model.generateContent([prompt, part as any]);
                const transcript = (result?.response?.text?.() as string) || '';
                if (transcript.trim()) {
                  setChatMessages((m) => [...m, { role: 'user', text: transcript.trim() }]);
                  await sendChat(transcript.trim());
                } else {
                  setChatMessages((m) => [...m, { role: 'ai', text: 'Sorry, I could not transcribe that audio.' }]);
                }
              } catch (e) {
                console.warn('[Chat] Transcription failed', e);
                setChatMessages((m) => [...m, { role: 'ai', text: 'Transcription failed. Please try again.' }]);
                setChatTyping(false);
              }
            };
            mr.start(250);
            mediaRecorderRef.current = mr;
            setRecording(true);
          } catch (e) {
            pushToast('⚠️ Microphone permission denied or unavailable.');
          }
        }}
        onMicStop={() => {
          try {
            const mr = mediaRecorderRef.current;
            if (mr && mr.state !== 'inactive') {
              mr.stop();
              mr.stream.getTracks().forEach(t => t.stop());
              mediaRecorderRef.current = null;
            }
          } catch {}
        }}
        recording={recording}
        speakEnabled={speakEnabled}
        onToggleSpeak={async () => {
          try {
            const next = !speakEnabled;
            setSpeakEnabled(next);
            if (next) {
              // Attempt to unlock/resume speech on user gesture and give quick feedback
              const { canSpeak, speak } = await import('@/lib/utils/speech');
              if (!canSpeak()) {
                pushToast('⚠️ Voice not supported in this browser');
              } else {
                try {
                  await speak('Voice replies enabled');
                } catch {
                  // ignored; will still be enabled and speak on next reply
                }
              }
            } else {
              try {
                const { stopSpeaking } = await import('@/lib/utils/speech');
                stopSpeaking();
              } catch {}
            }
          } catch {}
        }}
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
                    onChange={(e) => setCustomMinutes(Math.max(1, Math.min(180, Number((e.target as HTMLInputElement).value) || 0)))}
                    className="w-24 rounded-lg bg-white/80 dark:bg-white/5 ring-1 ring-black/10 dark:ring-white/10 p-2 text-slate-900 dark:text-[--color-accent]"
                  />
                </div>
              )}

              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showCountdown}
                  onChange={(e) => setShowCountdown((e.target as HTMLInputElement).checked)}
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

      {/* Music generator instance (hidden launcher). We trigger settings via dropdown signal. */}
      <MusicGenerator showLauncher={false} openSettingsSignal={musicSettingsSignal} />
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
