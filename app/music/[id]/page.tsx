"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    FaMusic,
    FaPlay,
    FaPause,
    FaStepForward,
    FaStepBackward,
    FaDownload,
    FaChevronDown,
    FaChevronUp,
    FaCloudDownloadAlt,
    FaHeadphones,
    FaRegLightbulb,
} from "react-icons/fa";
import { HiOutlineX } from "react-icons/hi";
import MusicPlayer from "@/components/music/MusicPlayer";
import PlaylistModal from "@/components/music/PlaylistModal";
import { composeSongDetailed } from "@/lib/eleven";
import { generateLyricsFromNotes, buildMusicPromptFromControls } from "@/lib/lyrics";
import { generateTrackName } from "@/lib/writer";
import { addRecentTrack, getRecentTracks } from "@/lib/stats";
import { getGeminiModel } from "@/lib/ai";
import { addTrack } from "@/lib/storage/music";

// Simple toast messages (local, minimal)
type Toast = { id: number; message: string };

const GENRES = [
    "Pop",
    "Hip-Hop / Rap",
    "Classical",
    "Acoustic",
    "Lo-Fi Chill",
    "Afrobeats",
    "EDM / Dance",
    "Jazz / Soul",
] as const;

const MOODS = [
    "Calm",
    "Focused",
    "Uplifting",
    "Deep",
    "Dreamy",
    "Motivational",
] as const;

type Energy = "Low" | "Medium" | "High";

const INSTRUMENTS = ["Piano", "Guitar", "Synth", "Rain", "Strings", "Bass", "Waves"] as const;

export default function MusicPage() {
    const { id } = (require('next/navigation') as any).useParams?.() || {};
    const [notes, setNotes] = useState<string>('');
    const [sessionTitle, setSessionTitle] = useState<string>('');

    useEffect(() => {
        if (!id) return;
        try {
            const { getSession } = require('@/lib/storage/sessions');
            const sid = Array.isArray(id) ? id[0] : id;
            const sess = getSession(sid);
            if (sess) {
                setSessionTitle(sess.title || 'Study Notes');
                setNotes(sess.editableText || sess.structuredText || sess.originalText || '');
                // Load last saved song title for this session if present
                try {
                    const saved = localStorage.getItem(`knotes_song_title_${sid}`);
                    if (saved) setTrackTitle(saved);
                } catch {}
            }
        } catch {}
    }, [id]);
    // Background toasts
    const [toasts, setToasts] = useState<Toast[]>([]);
    const pushToast = (message: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, message }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
    };

    // Helper: generate topics list from notes via Writer → Gemini fallback
    async function generateTopicsFromNotes(text: string): Promise<string[]> {
        const cleaned = (text || '').slice(0, 8000);
        try {
            const g: any = typeof window !== 'undefined' ? window : null;
            if (g && 'Writer' in g) {
                try {
                    const writer: any = await g.Writer.create({
                        tone: 'neutral',
                        format: 'plain-text',
                        length: 'short',
                        sharedContext: 'You extract study topics succinctly as bullet items.'
                    });
                    const out: string = await writer.write(
                        `From the following study notes, extract 5–12 concise topics/sections as a plain list (one per line). Return only the topics without numbering.\n\n${cleaned}`,
                        { context: 'Return just the list, one topic per line.' }
                    );
                    writer.destroy?.();
                    const lines = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 12);
                    if (lines.length) return lines;
                } catch {}
            }
        } catch {}
        try {
            const model = getGeminiModel('gemini-2.5-flash');
            const prompt = `Extract 5–12 concise topics covered in these study notes. Return only a plain list, one topic per line, no numbering.\n\n${cleaned}`;
            const res = await model.generateContent(prompt as any);
            const txt: string = (res?.response?.text?.() as string) || '';
            const lines = txt.split(/\r?\n/).map(s => s.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 12);
            return lines;
        } catch {}
        return [];
    }

    // Topics (mock detected)
    const [topics, setTopics] = useState<string[]>([
        "Neural Networks",
        "Backpropagation",
        "Optimization Techniques",
        "Overfitting & Regularization",
        "Loss Functions",
    ]);
    const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
    const allSelected = topics.length > 0 && selectedTopics.size === topics.length;

    // Generator controls
    const [genre, setGenre] = useState<(typeof GENRES)[number]>("Lo-Fi Chill");
    const [mood, setMood] = useState<(typeof MOODS)[number]>("Calm");
    const [tempo, setTempo] = useState<number>(75); // 40-180 typical range, we show 40-120 normalized
    const [energy, setEnergy] = useState<Energy>("Low");
    const [instrumentMix, setInstrumentMix] = useState<Record<string, boolean>>(() => {
        const base: Record<string, boolean> = {};
        INSTRUMENTS.forEach((i) => (base[i] = i === "Piano" || i === "Waves"));
        return base;
    });

    // Generation flow
    const [isGenerating, setIsGenerating] = useState(false);
    const [genStep, setGenStep] = useState(0);
    const steps = ["Analyzing notes", "Writing lyrics", "Composing music", "Synthesizing vocals"];
    const [previewOpen, setPreviewOpen] = useState(false);
    const [trackTitle, setTrackTitle] = useState<string>("");
    const previewRef = useRef<HTMLDivElement | null>(null);

    // Real player state using MusicPlayer
    const [playbackState, setPlaybackState] = useState<'playing' | 'paused' | 'stopped' | 'loading'>("stopped");
    const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
    const [progress, setProgress] = useState(0); // for legacy bar (kept for top progress bar only)
    const progressRef = useRef<number>(0);

    const [recentTracks, setRecentTracks] = useState(() => getRecentTracks());
    // Manual topics input
    const [manualTopics, setManualTopics] = useState<string>("");
    // Track persistence for playlists
    const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
    const [playlistOpen, setPlaylistOpen] = useState<boolean>(false);

    async function generateSong() {
        if (!notes) {
            pushToast('No notes available for this session.');
            return;
        }
        try {
            setIsGenerating(true);
            setGenStep(0);
            setPreviewOpen(false);
            setPlaybackState('loading');
            setAudioUrl(undefined);

            // 1) Build description for title
            const instrumentList = Object.keys(instrumentMix).filter((k) => instrumentMix[k]);
            const desc = `${mood} ${genre} • ${energy} energy ${tempo} BPM${instrumentList.length ? ' • ' + instrumentList.join(', ') : ''}`;
            try {
                const { title } = await generateTrackName({ description: desc, context: `Notes title: ${sessionTitle}` });
                setTrackTitle(title);
                try { if (id) localStorage.setItem(`knotes_song_title_${Array.isArray(id)?id[0]:id}`, title); } catch {}
            } catch {
                const fallbackTitle = `${mood} ${genre}`;
                setTrackTitle(fallbackTitle);
                try { if (id) localStorage.setItem(`knotes_song_title_${Array.isArray(id)?id[0]:id}`, fallbackTitle); } catch {}
            }
            setGenStep(1);

            // 2) Generate lyrics (based on entire lecture)
            let lyrics = '';
            try {
                lyrics = await generateLyricsFromNotes({
                    notes,
                    genre,
                    mood,
                    tempoBpm: Math.round(tempo),
                    energy,
                    instruments: instrumentList,
                    style: lyricsMode,
                    singer,
                    totalLengthSec: lengthSec,
                    manualTopics: manualTopics,
                });
                if (lyrics && lyrics.trim()) setLyricsText(lyrics.trim());
            } catch {}
            setGenStep(2);

            // Generate topics for "Notes Covered"
            try {
                setTopicsLoading(true);
                const topics = await generateTopicsFromNotes(notes);
                setTopicsCovered(topics);
            } catch {}
            finally { setTopicsLoading(false); }

            // 3) Build music prompt
            const prompt = buildMusicPromptFromControls({
                notes,
                lyrics,
                genre,
                mood,
                tempoBpm: Math.round(tempo),
                energy,
                instruments: instrumentList,
                singer,
                forceInstrumental: !lyrics,
                lyricStyle: lyricsMode,
                durationSec: lengthSec,
                manualTopics: manualTopics,
            });

            // 4) Compose via ElevenLabs
            const lengthMs = Math.max(3000, Math.min(300000, Math.round(lengthSec * 1000)));
            try {
                const res = await composeSongDetailed({ prompt, musicLengthMs: lengthMs, forceInstrumental: !lyrics });
                setGenStep(3);
                setAudioUrl(res.blobUrl);
                setPreviewOpen(true);
                setIsGenerating(false);
                setPlaybackState('playing');
                pushToast('🎶 Song ready');
                // Persist track entity for playlist usage
                try {
                    const sid = Array.isArray(id) ? id[0] : id;
                    const tTitle = (trackTitle && trackTitle.trim()) ? trackTitle : `${mood} ${genre}`;
                    const track = addTrack({ title: tTitle, sessionId: sid, kind: 'lyrics', audioUrl: res.blobUrl, lyrics: lyrics });
                    setCurrentTrackId(track.id);
                } catch {}
                // Save recent track with generated title
                try {
                    const sid = Array.isArray(id) ? id[0] : id;
                    const href = sid ? `/music/${sid}` : undefined;
                    const t = (trackTitle && trackTitle.trim()) ? trackTitle : `${mood} ${genre}`;
                    addRecentTrack({ id: `${Date.now()}:${t}`, title: t, playedAt: new Date().toISOString(), href });
                    setRecentTracks(getRecentTracks());
                } catch {}
                // Auto-scroll to preview/lyrics section (player will appear when audio is ready)
                try { previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
            } catch (err: any) {
                // Retry once with suggestion if bad_prompt
                if (err && err.code === 'bad_prompt' && err.suggestion) {
                    try {
                        const res2 = await composeSongDetailed({ prompt: err.suggestion, musicLengthMs: lengthMs, forceInstrumental: !lyrics });
                        setAudioUrl(res2.blobUrl);
                        setPreviewOpen(true);
                        setIsGenerating(false);
                        setPlaybackState('playing');
                        pushToast('🎶 Song ready');
                        // Save recent track with generated title (retry path)
                        try {
                            const sid = Array.isArray(id) ? id[0] : id;
                            const href = sid ? `/music/${sid}` : undefined;
                            const t = (trackTitle && trackTitle.trim()) ? trackTitle : `${mood} ${genre}`;
                            addRecentTrack({ id: `${Date.now()}:${t}`, title: t, playedAt: new Date().toISOString(), href });
                            setRecentTracks(getRecentTracks());
                        } catch {}
                        // Persist track entity for playlist usage (retry path)
                        try {
                            const sid = Array.isArray(id) ? id[0] : id;
                            const tTitle = (trackTitle && trackTitle.trim()) ? trackTitle : `${mood} ${genre}`;
                            const track = addTrack({ title: tTitle, sessionId: sid, kind: 'lyrics', audioUrl: res2.blobUrl, lyrics: lyrics });
                            setCurrentTrackId(track.id);
                        } catch {}
                        try { previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
                        return;
                    } catch {}
                }
                throw err;
            }
        } catch (e: any) {
            console.error('Generate song failed', e);
            pushToast(e?.message || 'Failed to generate song');
            setIsGenerating(false);
            setPlaybackState('stopped');
        }
    }

    function handlePlayPause() {
        setPlaybackState((s) => (s === 'playing' ? 'paused' : 'playing'));
    }
    function handleStop() {
        setPlaybackState('stopped');
    }
    function handleRegenerate() { generateSong(); }
    function handleDownload() {
        if (!audioUrl) return;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `${(trackTitle || 'study-track').replace(/[^a-z0-9-_ ]/gi, '')}.mp3`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
    function handleTweak() { pushToast('Open tweak panel'); }

    // Tiny sample sound for genre/mood preview (optional)
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sampleTimeout = useRef<any>(null);
    const playSample = (freq = 440, durationMs = 500) => {
        try {
            const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
            audioCtxRef.current = ctx;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = freq;
            g.gain.value = 0.0001;
            o.connect(g).connect(ctx.destination);
            o.start();
            // quick fade in/out
            const now = ctx.currentTime;
            g.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
            g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
            sampleTimeout.current && clearTimeout(sampleTimeout.current);
            sampleTimeout.current = setTimeout(() => {
                o.stop();
                o.disconnect();
                g.disconnect();
            }, durationMs + 40);
        } catch (e) {
            // ignore if not allowed
        }
    };

    const moodFreq = (m: typeof MOODS[number]) => {
        switch (m) {
            case "Calm":
                return 392;
            case "Focused":
                return 440;
            case "Uplifting":
                return 523.25;
            case "Deep":
                return 349.23;
            case "Dreamy":
                return 415.3;
            case "Motivational":
                return 587.33;
            default:
                return 440;
        }
    };


    const toggleTopic = (t: string) => {
        setSelectedTopics((prev) => {
            const next = new Set(prev);
            if (next.has(t)) next.delete(t);
            else next.add(t);
            return next;
        });
    };

    const selectAll = () => {
        if (allSelected) setSelectedTopics(new Set());
        else setSelectedTopics(new Set(topics));
    };

    const analyzeAgain = () => {
        // Mock re-detection (shuffle topics slightly)
        setTopics((prev) => {
            const copy = [...prev];
            copy.push("Neural Architecture Search");
            return Array.from(new Set(copy)).slice(0, 6);
        });
        pushToast("🔍 Analyzing notes again…");
    };

    const adjectiveForMood = (m: typeof MOODS[number]) => {
        switch (m) {
            case "Calm":
                return "Calm";
            case "Focused":
                return "Focused";
            case "Uplifting":
                return "Uplifting";
            case "Deep":
                return "Deep";
            case "Dreamy":
                return "Dreamy";
            case "Motivational":
                return "Motivational";
            default:
                return "Study";
        }
    };

    const moodIndicator = `${mood} | Genre: ${genre} | Tempo: ${Math.round(tempo)} BPM`;

    // Preview tabs content
    const [previewTab, setPreviewTab] = useState<'lyrics' | 'notes'>('lyrics');
    const [lyricsText, setLyricsText] = useState<string>(
        `Verse 1:\nCells hum softly in the night, ATP begins to rise,\nMitochondria light the way, power in disguise.\n\nChorus:\nEnergy flows, let your mind unwind,\nFocus beats guide the working mind.`
    );
    const [topicsCovered, setTopicsCovered] = useState<string[]>([]);
const [topicsLoading, setTopicsLoading] = useState<boolean>(false);

    const genreChange = (g: (typeof GENRES)[number]) => {
        setGenre(g);
        playSample(moodFreq(mood), 400);
    };
    const moodChange = (m: (typeof MOODS)[number]) => {
        setMood(m);
        playSample(moodFreq(m), 500);
    };

    const toggleInstrument = (name: string) => {
        setInstrumentMix((mix) => ({ ...mix, [name]: !mix[name] }));
    };

    // Song config additional state
    const [scope, setScope] = useState<'all' | 'topics'>('all');
    const [singer, setSinger] = useState<'Male' | 'Female' | 'Duet' | 'AI Voice' | 'Robotic / Filtered'>('AI Voice');
    const [lyricsMode, setLyricsMode] = useState<'summary' | 'educational' | 'mix'>('mix');
    const [lengthSec, setLengthSec] = useState<number>(120); // 2 min default

    // Fun tips during generation
    const funTips = [
        'Did you know? Music boosts memory retention by 20%!',
        'Tip: Shorter tracks generate faster and loop better for focus.',
        'Fun fact: Lo‑fi beats often sit around 70–90 BPM for relaxation.',
    ];
    const [tipIndex, setTipIndex] = useState(0);
    useEffect(() => {
        if (!isGenerating) return;
        const id = setInterval(() => setTipIndex((i) => (i + 1) % funTips.length), 2500);
        return () => clearInterval(id);
    }, [isGenerating]);

    const isReady = !!notes;

    return (
        <main className="relative w-full min-h-screen pb-36">
            {/* Background gradient like landing */}
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(50% 50% at 0% 0%, rgba(139,198,236,0.35) 0%, rgba(139,198,236,0.08) 55%, rgba(139,198,236,0.03) 100%), " +
                            "radial-gradient(55% 55% at 100% 100%, rgba(179,255,171,0.35) 0%, rgba(179,255,171,0.08) 55%, rgba(179,255,171,0.02) 100%)",
                    }}
                />
                {/* Soft floating orbs for composing visual (behind content) */}
                {isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative h-40 w-40">
                            <span className="absolute inset-0 rounded-full bg-primary/30 blur-2xl animate-ping" />
                            <span className="absolute left-6 top-6 h-8 w-8 rounded-full bg-secondary/50 animate-bounce" />
                            <span className="absolute right-6 bottom-8 h-5 w-5 rounded-full bg-primary/40 animate-[pulse_1.8s_ease-in-out_infinite]" />
                        </div>
                    </div>
                )}
            </div>

            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-16">
                {/* Page title */}
                <header className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-[--color-accent]">Music Generator</h1>
                    <p className="text-sm text-slate-700 dark:text-slate-300">Turn your key topics into focus-friendly soundtracks.</p>
                </header>

                {/* Split view */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Note Insights */}
                    <section className="lg:col-span-1 space-y-4">
                        {/* Song Scope card */}
                        <div className="rounded-2xl bg-white/90 dark:bg-white/5 backdrop-blur p-6 shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-transform hover:-translate-y-0.5">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent] mb-3">Song Scope</h2>
                            <div className="flex flex-col gap-2 text-sm">
                                <div className="text-sm text-slate-700 dark:text-slate-300">Generating based on the entire lecture/upload.</div>
                            </div>
                        </div>

                        {/* Topics card (only if scope is topics) */}
                        {scope === 'topics' && (
                            <div className="rounded-2xl bg-white/90 dark:bg-white/5 backdrop-blur p-6 shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-transform hover:-translate-y-0.5">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">Detected Topics</h2>
                                    <button
                                        className="text-sm rounded-full px-3 py-1 bg-primary text-slate-900 shadow hover:brightness-105"
                                        onClick={selectAll}
                                    >
                                        {allSelected ? "Clear" : "Select All"}
                                    </button>
                                </div>
                                <div className="max-h-64 overflow-auto pr-1">
                                    <div className="flex flex-wrap gap-2">
                                        {topics.map((t) => {
                                            const active = selectedTopics.has(t);
                                            return (
                                                <button
                                                    key={t}
                                                    onClick={() => toggleTopic(t)}
                                                    className={`group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ring-1 transition ${
                                                        active
                                                            ? "bg-primary text-slate-900 ring-primary/60"
                                                            : "bg-white text-slate-700 ring-black/10 hover:bg-primary/10"
                                                    }`}
                                                    title={active ? "Selected" : "Select topic"}
                                                >
                                                    <span aria-hidden className="animate-[pulse_2s_ease-in-out_infinite]">🎵</span>
                                                    <span className="group-hover:text-slate-900">{t}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between">
                                    <button
                                        onClick={analyzeAgain}
                                        className="rounded-xl px-4 py-2 bg-white ring-1 ring-black/10 text-slate-800 hover:bg-white/90 dark:bg-white/10 dark:text-[--color-accent] dark:ring-white/10"
                                        title="Re-detect topics from notes"
                                    >
                                        Analyze Notes Again
                                    </button>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{selectedTopics.size} selected</span>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Right: Music Generator */}
                    <section className="lg:col-span-2">
                        <div className="rounded-2xl bg-white/90 dark:bg-white/5 backdrop-blur p-6 shadow-md ring-1 ring-black/5 dark:ring-white/10">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-slate-900 dark:text-[--color-accent]">Generate Your Study Music</h2>
                                {isGenerating && (
                                    <div className="text-sm text-slate-700 dark:text-slate-300">
                                        {steps[Math.min(genStep, steps.length - 1)]}…
                                    </div>
                                )}
                            </div>

                            {/* Controls */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-600 dark:text-slate-300">Genre</label>
                                    <select
                                        className="mt-1 w-full rounded-lg bg-white/80 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 p-2 text-slate-900 dark:text-[--color-accent]"
                                        value={genre}
                                        onChange={(e) => genreChange(e.target.value as any)}
                                    >
                                        {GENRES.map((g) => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-600 dark:text-slate-300">Vibe / Mood</label>
                                    <select
                                        className="mt-1 w-full rounded-lg bg-white/80 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 p-2 text-slate-900 dark:text-[--color-accent]"
                                        value={mood}
                                        onChange={(e) => moodChange(e.target.value as any)}
                                    >
                                        {MOODS.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-600 dark:text-slate-300">Tempo: {Math.round(tempo)} BPM</label>
                                    <input
                                        type="range"
                                        min={50}
                                        max={120}
                                        value={tempo}
                                        onChange={(e) => setTempo(Number(e.target.value))}
                                        className="mt-2 w-full"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-600 dark:text-slate-300">Energy Level</label>
                                    <div className="mt-1 flex gap-2">
                                        {(["Low", "Medium", "High"] as Energy[]).map((lv) => (
                                            <button
                                                key={lv}
                                                onClick={() => setEnergy(lv)}
                                                className={`flex-1 rounded-lg px-3 py-2 ring-1 ${
                                                    energy === lv
                                                        ? "bg-primary text-slate-900 ring-primary/60"
                                                        : "bg-white/80 dark:bg-white/10 text-slate-800 dark:text-[--color-accent] ring-black/10 dark:ring-white/10"
                                                }`}
                                            >
                                                {lv}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-600 dark:text-slate-300">Singer Style</label>
                                    <select
                                        className="mt-1 w-full rounded-lg bg-white/80 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 p-2 text-slate-900 dark:text-[--color-accent]"
                                        value={singer}
                                        onChange={(e) => setSinger(e.target.value as any)}
                                    >
                                        {(["Male","Female","Duet","AI Voice","Robotic / Filtered"] as const).map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-600 dark:text-slate-300">Song Length: {Math.round(lengthSec/60)}:{String(Math.round(lengthSec%60)).padStart(2,'0')}</label>
                                    <input
                                        type="range"
                                        min={30}
                                        max={300}
                                        step={15}
                                        value={lengthSec}
                                        onChange={(e) => setLengthSec(Number(e.target.value))}
                                        className="mt-2 w-full"
                                    />
                                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Shorter tracks are generated faster.</p>
                                </div>
                            </div>

                            {/* Lyrics Style */}
                            <div className="mt-4">
                                <div className="text-xs text-slate-600 dark:text-slate-300 mb-1">Lyrics Style</div>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => setLyricsMode('summary')} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${lyricsMode==='summary' ? 'bg-secondary text-slate-900 ring-secondary/60' : 'bg-white/80 dark:bg-white/10 text-slate-800 dark:text-[--color-accent] ring-black/10 dark:ring-white/10'}`}>Summarize Notes into Catchy Lyrics</button>
                                    <button onClick={() => setLyricsMode('educational')} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${lyricsMode==='educational' ? 'bg-secondary text-slate-900 ring-secondary/60' : 'bg-white/80 dark:bg-white/10 text-slate-800 dark:text-[--color-accent] ring-black/10 dark:ring-white/10'}`}>Keep Educational Tone</button>
                                    <button onClick={() => setLyricsMode('mix')} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${lyricsMode==='mix' ? 'bg-secondary text-slate-900 ring-secondary/60' : 'bg-white/80 dark:bg-white/10 text-slate-800 dark:text-[--color-accent] ring-black/10 dark:ring-white/10'}`}>Mix Both</button>
                                </div>
                                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">You can preview generated lyrics before full song generation.</p>
                            </div>

                            {/* Manual Topics Input */}
                            <div className="mt-4">
                                <label className="text-xs text-slate-600 dark:text-slate-300">Areas/Topics to cover (optional)</label>
                                <textarea
                                  value={manualTopics}
                                  onChange={(e) => setManualTopics(e.target.value)}
                                  placeholder="e.g. Backpropagation, Gradient Descent vs Adam, Overfitting, Regularization"
                                  className="mt-1 w-full rounded-lg bg-white/80 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 p-2 text-sm min-h-20"
                                />
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">These topics will be prioritized in the lyrics and music prompt.</p>
                            </div>

                            {/* Instruments */}
                            <div className="mt-4">
                                <div className="text-xs text-slate-600 dark:text-slate-300 mb-2">Instrument Mix</div>
                                <div className="flex flex-wrap gap-2">
                                    {INSTRUMENTS.map((name) => {
                                        const on = !!instrumentMix[name];
                                        return (
                                            <button
                                                key={name}
                                                onClick={() => toggleInstrument(name)}
                                                className={`rounded-full px-3 py-1.5 text-sm ring-1 transition ${
                                                    on
                                                        ? "bg-secondary text-slate-900 ring-secondary/60"
                                                        : "bg-white/80 dark:bg-white/10 text-slate-800 dark:text-[--color-accent] ring-black/10 dark:ring-white/10"
                                                }`}
                                                title={on ? "Enabled" : "Enable"}
                                            >
                                                {name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Compose CTA */}
                            <div className="mt-6 flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => generateSong()}
                                    disabled={isGenerating || !isReady}
                                    className={`inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-slate-900 font-medium shadow-[0_4px_0_rgba(0,0,0,0.08)] disabled:opacity-60 ${!isGenerating && isReady ? 'animate-pulse' : ''}`}
                                    title="Generate a full song from your notes"
                                >
                                    <FaMusic /> Generate Song
                                </button>
                            </div>

                            {/* Progress & tips */}
                            {isGenerating && (
                                <div className="mt-6 space-y-3">
                                    <div className="h-2 w-full rounded-full bg-slate-200/70 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-all" style={{ width: `${(Math.min(genStep, steps.length) / steps.length) * 100}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300">
                                        <span>{steps[Math.min(genStep, steps.length - 1)]}…</span>
                                        <span className="italic opacity-80">{funTips[tipIndex]}</span>
                                    </div>
                                    <div className="h-24 rounded-xl bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 relative overflow-hidden">
                                        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.6) 2px, transparent 2px)', backgroundSize: '20px 20px' }} />
                                        <div className="absolute inset-0 flex items-center justify-center text-slate-800 dark:text-[--color-accent]">
                                            <span className="text-sm">Creating your unique study soundtrack…</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>


                {/* Preview section (collapsible) */}
                {previewOpen && (
                    <section ref={previewRef} className="mt-6">
                        <div className="rounded-2xl bg-white/95 dark:bg-white/5 backdrop-blur p-6 shadow-md ring-1 ring-black/5 dark:ring-white/10">
                            <button
                                className="w-full flex items-center justify-between text-left"
                                onClick={() => setPreviewOpen((v) => !v)}
                                aria-expanded={previewOpen}
                            >
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">Music Preview</h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-300">{moodIndicator}</p>
                                </div>
                                {previewOpen ? <FaChevronUp /> : <FaChevronDown />}
                            </button>

                            {/* Lyrics/Notes Tabs */}
                            <div className="mt-6">
                                <div className="flex items-center gap-6 text-sm">
                                    <button className={`pb-1 border-b-2 ${previewTab==='lyrics' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`} onClick={() => setPreviewTab('lyrics')}>Lyrics Preview</button>
                                    <button className={`pb-1 border-b-2 ${previewTab==='notes' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`} onClick={() => setPreviewTab('notes')}>Notes Covered</button>
                                </div>
                                <div className="mt-3 rounded-lg bg-white/80 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 p-4 max-h-48 overflow-auto text-sm text-slate-800 dark:text-[--color-accent]">
                                    {previewTab === 'lyrics' ? (
                                        <pre className="whitespace-pre-wrap font-sans">{lyricsText}</pre>
                                    ) : (
                                        topicsLoading ? (
                                            <div className="text-sm opacity-80">Detecting topics from your notes…</div>
                                        ) : (
                                            <ul className="list-disc pl-5 space-y-1">
                                                {topicsCovered.length > 0 ? topicsCovered.map((n, i) => (
                                                    <li key={i}>{n}</li>
                                                )) : (
                                                    <li>No topics detected yet.</li>
                                                )}
                                            </ul>
                                        )
                                    )}
                                </div>

                                {/* Edit Controls Panel */}
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button className="rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10" onClick={() => { pushToast('Regenerating lyrics only…'); setLyricsText(lyricsText + '\n\n(Alt verse) Knowledge grows with every line.'); }}>Regenerate Lyrics Only</button>
                                    <button className="rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10" onClick={() => pushToast('Open genre selector')}>Change Genre</button>
                                    <button className="rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10" onClick={() => pushToast('Open voice style selector')}>Change Voice Style</button>
                                    <button className="rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10" onClick={() => pushToast('Adding instrument layer…')}>Add Instrument Layer</button>
                                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white dark:bg-white/10 dark:ring-white/10">
                                        <span className="text-sm">Adjust Tempo</span>
                                        <input type="range" min={50} max={120} value={tempo} onChange={(e)=>setTempo(Number(e.target.value))} />
                                    </div>
                                    <button className="rounded-lg px-3 py-2 bg-secondary text-slate-900 font-medium" onClick={() => setPlaylistOpen(true)} disabled={!currentTrackId}>Save to Playlist</button>
                                </div>
                            </div>

                            {/* Tips */}
                            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">💡 Tip: You can highlight parts of your notes to create mini-tracks for each concept.</p>
                        </div>
                    </section>
                )}
            </div>

            {/* Recent Songs */}
            <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 mt-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent] mb-3">Recently Generated Songs</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(recentTracks.slice(0,3)).map((t, i) => (
                        <div key={t.id} className="rounded-2xl bg-white/90 dark:bg-white/5 backdrop-blur p-4 shadow-md ring-1 ring-black/5 dark:ring-white/10">
                            <div className="flex items-center gap-3">
                                <div className={`h-12 w-12 rounded-md bg-gradient-to-br ${i % 2 === 0 ? 'from-primary to-secondary' : 'from-secondary to-primary'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-slate-900 dark:text-[--color-accent] truncate">{t.title}</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-300">{new Date(t.playedAt).toLocaleString()}</div>
                                </div>
                                {t.href ? (
                                    <a href={t.href} className="rounded-md px-2 py-1 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10 text-xs">Open</a>
                                ) : null}
                            </div>
                        </div>
                    ))}
                    {recentTracks.length === 0 && (
                        <div className="rounded-2xl bg-white/90 dark:bg-white/5 backdrop-blur p-6 text-sm text-slate-700 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10">No recent songs yet. Generate your first track above!</div>
                    )}
                </div>
            </section>

            {/* Fixed Music Player shows only after song is generated */}
            {audioUrl && (
              <>
                <MusicPlayer
                  trackTitle={trackTitle || 'Untitled Focus Track'}
                  playbackState={playbackState}
                  isGenerating={false}
                  audioUrl={audioUrl}
                  onPlayPause={handlePlayPause}
                  onStop={handleStop}
                  onTweakSettings={handleTweak}
                  onRegenerate={handleRegenerate}
                  onDownload={handleDownload}
                />
                <PlaylistModal open={playlistOpen} onClose={() => setPlaylistOpen(false)} trackId={currentTrackId} />
              </>
            )}

            {/* Toasts */}
            <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
                {toasts.map((t) => (
                    <div key={t.id} className="pointer-events-auto rounded-lg bg-slate-900/90 text-white text-sm px-3 py-2 shadow-lg">
                        {t.message}
                    </div>
                ))}
            </div>
        </main>
    );
}