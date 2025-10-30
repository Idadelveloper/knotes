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
import { FaBookOpen, FaPenNib } from "react-icons/fa6";
import { HiOutlineX } from "react-icons/hi";
import MusicPlayer from "@/components/music/MusicPlayer";
import PlaylistModal from "@/components/music/PlaylistModal";
import { composeSongDetailed } from "@/lib/eleven";
import { generateLyricsFromNotes, buildMusicPromptFromControls } from "@/lib/lyrics";
import { generateTrackName } from "@/lib/writer";
import { addRecentTrack, getRecentTracks, incStat } from "@/lib/stats";
import { getGeminiModel } from "@/lib/ai";
import { addTrack } from "@/lib/storage/music";

// Simple toast messages (local, minimal)
type Toast = { id: number; message: string };

const GENRES = [
    'Pop', 'Hip-hop', 'Lo-fi', 'Rock', 'Classical', 'Jazz', 'Afrobeat', 'EDM', 'Country', 'R&B', 'Trap', 'Reggaeton', 'Blues', 'Folk', 'Soul', 'Chillwave', 'Synthwave', 'Acoustic', 'Ambient', 'Funk', 'Amapiano'
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

const INSTRUMENTS = ['Acoustic','Electronic','Orchestral','Minimal','Full Band','Lo-fi','Jazz Ensemble','Pop Band','Cinematic','Ambient','Rock Setup'] as const;

export default function MusicPage() {
    const { id } = (require('next/navigation') as any).useParams?.() || {};
    const [notes, setNotes] = useState<string>('');
    const [sessionTitle, setSessionTitle] = useState<string>('');
    const [mode, setMode] = useState<'normal' | 'math'>('normal');

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

            // 1) Prepare instruments list
            const instrumentList = Object.keys(instrumentMix).filter((k) => instrumentMix[k]);
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
                    // new lyric settings
                    toneMood: mood,
                    persona,
                    creativityLevel,
                    complexity,
                    addHumor,
                    learningIntent,
                    focusTopics: focusTopicsInput.split(',').map(s=>s.trim()).filter(Boolean),
                    repetitionLevel,
                    lyricLength,
                    factualAccuracy,
                    // math
                    mathMode: mode==='math',
                    formulaStyle,
                    equationFrequency,
                    symbolPronunciation,
                    formulaMnemonics,
                    conceptRhymes,
                    stepByStep,
                    callAndResponse,
                    addSimpleExamples,
                    strictFormulaPreservation,
                });
                if (lyrics && lyrics.trim()) setLyricsText(lyrics.trim());
            } catch {}

            // Generate track title — prioritize lyrics, then transcript/notes, then settings description
            try {
                const instrumentList = Object.keys(instrumentMix).filter((k) => instrumentMix[k]);
                const settingsDesc = `${mood} ${genre} • ${energy} energy ${Math.round(tempo)} BPM${instrumentList.length ? ' • ' + instrumentList.join(', ') : ''}`;
                let description = '';
                if (lyrics && lyrics.trim()) {
                    // Base title on the actual lyrics
                    description = `Lyrics for the song (use to derive a concise track title):\n${lyrics.slice(0, 4000)}`;
                } else if (notes && notes.trim()) {
                    // Fall back to transcript/notes when no lyrics
                    description = `Transcript/notes to base the song title on:\n${notes.slice(0, 4000)}`;
                } else {
                    // Final fallback: use settings
                    description = settingsDesc;
                }
                const { title } = await generateTrackName({ description, context: `Session: ${sessionTitle}` });
                setTrackTitle(title);
                try { if (id) localStorage.setItem(`knotes_song_title_${Array.isArray(id)?id[0]:id}`, title); } catch {}
            } catch {
                const fb = `${mood} ${genre}`;
                setTrackTitle(fb);
                try { if (id) localStorage.setItem(`knotes_song_title_${Array.isArray(id)?id[0]:id}`, fb); } catch {}
            }

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
                forceInstrumental: false,
                lyricStyle: lyricsMode,
                durationSec: lengthSec,
                manualTopics: manualTopics,
                // Expanded music settings
                dynamicTempo,
                beatType,
                instrumentDensity,
                backgroundVocals,
                effects,
                vocalType,
                vocalEmotion,
                vocalAccent,
                layeredVocals,
                instrumentVariation,
                songStructure,
                // Math mode enhancements
                mathMode: mode==='math',
                beatAlignment,
                tempoSync,
                keywordEmphasis,
                autoChorusBuilder,
                backgroundChants,
            });

            // 4) Compose via ElevenLabs
            const lengthMs = Math.max(3000, Math.min(300000, Math.round(lengthSec * 1000)));
            try {
                const res = await composeSongDetailed({ prompt, musicLengthMs: lengthMs, forceInstrumental: false });
                setGenStep(3);
                // Persist audio blob in Cache Storage under a stable URL for replay/streaming later
                let stableUrl = res.blobUrl;
                let newTrackId: string | undefined = undefined;
                try {
                    newTrackId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `t_${Date.now()}`;
                    const blob = await (await fetch(res.blobUrl)).blob();
                    const cache = await caches.open('KNOTES_CACHE_V1');
                    stableUrl = `/cached-audio/${newTrackId}.mp3`;
                    await cache.put(stableUrl, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
                } catch {}
                setAudioUrl(stableUrl);
                setPreviewOpen(true);
                setIsGenerating(false);
                setPlaybackState('playing');
                pushToast('🎶 Song ready');
                try { incStat('musicGenerations', 1); } catch {}
                // Persist track entity for playlist usage (with cached URL if available)
                try {
                    const sid = Array.isArray(id) ? id[0] : id;
                    const tTitle = (trackTitle && trackTitle.trim()) ? trackTitle : `${mood} ${genre}`;
                    const track = addTrack({ id: newTrackId, title: tTitle, sessionId: sid, kind: 'lyrics', audioUrl: stableUrl, lyrics: lyrics, settings: { genre, mood, tempoBpm: Math.round(tempo), energy, instruments: instrumentList, singer, lyricStyle: lyricsMode, durationSec: lengthSec, manualTopics, notes } });
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
                        const res2 = await composeSongDetailed({ prompt: err.suggestion, musicLengthMs: lengthMs, forceInstrumental: false });
                        // Persist audio blob to cache under stable URL (retry path)
                        let stableUrl2 = res2.blobUrl;
                        let newTrackId2: string | undefined = undefined;
                        try {
                            newTrackId2 = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `t_${Date.now()}`;
                            const blob2 = await (await fetch(res2.blobUrl)).blob();
                            const cache2 = await caches.open('KNOTES_CACHE_V1');
                            stableUrl2 = `/cached-audio/${newTrackId2}.mp3`;
                            await cache2.put(stableUrl2, new Response(blob2, { headers: { 'Content-Type': 'audio/mpeg' } }));
                        } catch {}
                        setAudioUrl(stableUrl2);
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
                            const track = addTrack({ id: newTrackId2, title: tTitle, sessionId: sid, kind: 'lyrics', audioUrl: stableUrl2, lyrics: lyrics, settings: { genre, mood, tempoBpm: Math.round(tempo), energy, instruments: instrumentList, singer, lyricStyle: lyricsMode, durationSec: lengthSec, manualTopics, notes } });
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
    async function regenerateLyricsOnly() {
        if (!notes) return;
        try {
            pushToast('Regenerating lyrics…');
            const instrumentList = Object.keys(instrumentMix).filter((k) => instrumentMix[k]);
            const lyrics = await generateLyricsFromNotes({
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
                toneMood: mood,
                persona,
                creativityLevel,
                complexity,
                addHumor,
                learningIntent,
                focusTopics: focusTopicsInput.split(',').map(s=>s.trim()).filter(Boolean),
                repetitionLevel,
                lyricLength,
                factualAccuracy,
                mathMode: mode==='math',
                formulaStyle,
                equationFrequency,
                symbolPronunciation,
                formulaMnemonics,
                conceptRhymes,
                stepByStep,
                callAndResponse,
                addSimpleExamples,
                strictFormulaPreservation,
            });
            if (lyrics && lyrics.trim()) setLyricsText(lyrics.trim());
        } catch (e:any) {
            console.error(e);
            pushToast('Failed to regenerate lyrics');
        }
    }
    async function regenerateMusicOnly() {
        try {
            pushToast('Re-composing music…');
            setIsGenerating(true);
            const instrumentList = Object.keys(instrumentMix).filter((k) => instrumentMix[k]);
            const prompt = buildMusicPromptFromControls({
                notes,
                lyrics: lyricsText,
                genre,
                mood,
                tempoBpm: Math.round(tempo),
                energy,
                instruments: instrumentList,
                singer,
                forceInstrumental: false,
                lyricStyle: lyricsMode,
                durationSec: lengthSec,
                manualTopics,
                dynamicTempo,
                beatType,
                instrumentDensity,
                backgroundVocals,
                effects,
                vocalType,
                vocalEmotion,
                vocalAccent,
                layeredVocals,
                instrumentVariation,
                songStructure,
                mathMode: mode==='math',
                beatAlignment,
                tempoSync,
                keywordEmphasis,
                autoChorusBuilder,
                backgroundChants,
            });
            const lengthMs = Math.max(3000, Math.min(300000, Math.round(lengthSec * 1000)));
            const res = await composeSongDetailed({ prompt, musicLengthMs: lengthMs, forceInstrumental: false });
            let stableUrl = res.blobUrl;
            try {
                const newId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `t_${Date.now()}`;
                const blob = await (await fetch(res.blobUrl)).blob();
                const cache = await caches.open('KNOTES_CACHE_V1');
                stableUrl = `/cached-audio/${newId}.mp3`;
                await cache.put(stableUrl, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
            } catch {}
            setAudioUrl(stableUrl);
            setIsGenerating(false);
            setPlaybackState('playing');
            pushToast('🎧 New mix ready');
        } catch (e:any) {
            console.error(e);
            setIsGenerating(false);
            pushToast('Failed to regenerate music');
        }
    }
    function handleRegenerate() { generateSong(); }
    async function handleDownload() {
        if (!audioUrl) return;
        try {
            const resp = await fetch(audioUrl, { mode: 'cors' });
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(trackTitle || 'study-track').replace(/[^a-z0-9-_ ]/gi, '')}.mp3`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(()=> URL.revokeObjectURL(url), 2000);
        } catch {
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = `${(trackTitle || 'study-track').replace(/[^a-z0-9-_ ]/gi, '')}.mp3`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
    }
    function handleTweak() { pushToast('Open tweak panel'); }
    function handleCopyLyrics() {
        try {
            navigator.clipboard.writeText(lyricsText || '');
            pushToast('Lyrics copied');
        } catch {}
    }
    function handleDownloadLyrics() {
        const blob = new Blob([lyricsText || ''], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(trackTitle || 'lyrics').replace(/[^a-z0-9-_ ]/gi, '')}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=> URL.revokeObjectURL(url), 2000);
    }

    const presetKey = useMemo(()=> {
        const sid = Array.isArray(id) ? id?.[0] : id;
        return sid ? `knotes_music_preset_${sid}` : '';
    }, [id]);

    function savePreset() {
        try {
            if (!presetKey) return;
            const data = {
                mode,
                genre,
                mood,
                tempo,
                energy,
                instrumentMix,
                singer,
                lyricsMode,
                lengthSec,
                // lyrics settings
                persona,
                creativityLevel,
                complexity,
                addHumor,
                learningIntent,
                focusTopicsInput,
                repetitionLevel,
                lyricLength,
                factualAccuracy,
                // math lyric
                formulaStyle,
                equationFrequency,
                symbolPronunciation,
                formulaMnemonics,
                conceptRhymes,
                stepByStep,
                callAndResponse,
                addSimpleExamples,
                strictFormulaPreservation,
                // music settings
                dynamicTempo,
                beatType,
                instrumentDensity,
                backgroundVocals,
                effects,
                vocalType,
                vocalEmotion,
                vocalAccent,
                layeredVocals,
                instrumentVariation,
                songStructure,
                // math music enhancements
                beatAlignment,
                tempoSync,
                keywordEmphasis,
                autoChorusBuilder,
                backgroundChants,
                // output
                lyricSummaryMode,
                highlightKeywords,
                visualizerType,
                downloadFormat,
            };
            localStorage.setItem(presetKey, JSON.stringify(data));
            pushToast('Preset saved');
        } catch (e) { console.error(e);}    
    }

    useEffect(()=>{
        try {
            if (!presetKey) return;
            const raw = localStorage.getItem(presetKey);
            if (!raw) return;
            const d = JSON.parse(raw);
            if (d.mode) setMode(d.mode);
            if (d.genre) setGenre(d.genre);
            if (d.mood) setMood(d.mood);
            if (typeof d.tempo === 'number') setTempo(d.tempo);
            if (d.energy) setEnergy(d.energy);
            if (d.instrumentMix) setInstrumentMix(d.instrumentMix);
            if (d.singer) setSinger(d.singer);
            if (d.lyricsMode) setLyricsMode(d.lyricsMode);
            if (typeof d.lengthSec === 'number') setLengthSec(d.lengthSec);
            if (d.persona) setPersona(d.persona);
            if (typeof d.creativityLevel === 'number') setCreativityLevel(d.creativityLevel);
            if (typeof d.complexity === 'number') setComplexity(d.complexity);
            if (typeof d.addHumor === 'boolean') setAddHumor(d.addHumor);
            if (Array.isArray(d.learningIntent)) setLearningIntent(d.learningIntent);
            if (typeof d.focusTopicsInput === 'string') setFocusTopicsInput(d.focusTopicsInput);
            if (typeof d.repetitionLevel === 'number') setRepetitionLevel(d.repetitionLevel);
            if (d.lyricLength) setLyricLength(d.lyricLength);
            if (typeof d.factualAccuracy === 'number') setFactualAccuracy(d.factualAccuracy);
            if (d.formulaStyle) setFormulaStyle(d.formulaStyle);
            if (typeof d.equationFrequency === 'number') setEquationFrequency(d.equationFrequency);
            if (d.symbolPronunciation) setSymbolPronunciation(d.symbolPronunciation);
            if (typeof d.formulaMnemonics === 'boolean') setFormulaMnemonics(d.formulaMnemonics);
            if (typeof d.conceptRhymes === 'boolean') setConceptRhymes(d.conceptRhymes);
            if (typeof d.stepByStep === 'boolean') setStepByStep(d.stepByStep);
            if (typeof d.callAndResponse === 'boolean') setCallAndResponse(d.callAndResponse);
            if (typeof d.addSimpleExamples === 'boolean') setAddSimpleExamples(d.addSimpleExamples);
            if (typeof d.strictFormulaPreservation === 'boolean') setStrictFormulaPreservation(d.strictFormulaPreservation);
            if (typeof d.dynamicTempo === 'boolean') setDynamicTempo(d.dynamicTempo);
            if (d.beatType) setBeatType(d.beatType);
            if (typeof d.instrumentDensity === 'number') setInstrumentDensity(d.instrumentDensity);
            if (typeof d.backgroundVocals === 'boolean') setBackgroundVocals(d.backgroundVocals);
            if (Array.isArray(d.effects)) setEffects(d.effects);
            if (d.vocalType) setVocalType(d.vocalType);
            if (d.vocalEmotion) setVocalEmotion(d.vocalEmotion);
            if (d.vocalAccent) setVocalAccent(d.vocalAccent);
            if (typeof d.layeredVocals === 'number') setLayeredVocals(d.layeredVocals);
            if (typeof d.instrumentVariation === 'boolean') setInstrumentVariation(d.instrumentVariation);
            if (Array.isArray(d.songStructure)) setSongStructure(d.songStructure);
            if (typeof d.beatAlignment === 'boolean') setBeatAlignment(d.beatAlignment);
            if (typeof d.tempoSync === 'boolean') setTempoSync(d.tempoSync);
            if (typeof d.keywordEmphasis === 'boolean') setKeywordEmphasis(d.keywordEmphasis);
            if (typeof d.autoChorusBuilder === 'boolean') setAutoChorusBuilder(d.autoChorusBuilder);
            if (typeof d.backgroundChants === 'boolean') setBackgroundChants(d.backgroundChants);
            if (typeof d.lyricSummaryMode === 'boolean') setLyricSummaryMode(d.lyricSummaryMode);
            if (typeof d.highlightKeywords === 'boolean') setHighlightKeywords(d.highlightKeywords);
            if (d.visualizerType) setVisualizerType(d.visualizerType);
            if (d.downloadFormat) setDownloadFormat(d.downloadFormat);
        } catch (e) { console.error(e); }
    }, [presetKey]);

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
    const [singer, setSinger] = useState<string>('Solo');
    const [lyricsMode, setLyricsMode] = useState<'summary' | 'educational' | 'mix'>('mix');
    const [lengthSec, setLengthSec] = useState<number>(120); // 2 min default

    // Lyrics settings (expanded)
    const [persona, setPersona] = useState<'Student'|'Narrator'|'Teacher'|'Rapper'|'Storyteller'>('Student');
    const [creativityLevel, setCreativityLevel] = useState<number>(40);
    const [complexity, setComplexity] = useState<number>(3);
    const [addHumor, setAddHumor] = useState<boolean>(false);
    const [learningIntent, setLearningIntent] = useState<string[]>([]);
    const [focusTopicsInput, setFocusTopicsInput] = useState<string>(''); // comma separated
    const [repetitionLevel, setRepetitionLevel] = useState<number>(40);
    const [lyricLength, setLyricLength] = useState<'short'|'medium'|'long'|'full'>('medium');
    const [factualAccuracy, setFactualAccuracy] = useState<number>(60);

    // Math-only lyric settings
    const [formulaStyle, setFormulaStyle] = useState<'Spoken'|'Sung'|'Simplified'>('Spoken');
    const [equationFrequency, setEquationFrequency] = useState<number>(50);
    const [symbolPronunciation, setSymbolPronunciation] = useState<'Phonetic'|'Literal'>('Phonetic');
    const [formulaMnemonics, setFormulaMnemonics] = useState<boolean>(true);
    const [conceptRhymes, setConceptRhymes] = useState<boolean>(true);
    const [stepByStep, setStepByStep] = useState<boolean>(true);
    const [callAndResponse, setCallAndResponse] = useState<boolean>(false);
    const [addSimpleExamples, setAddSimpleExamples] = useState<boolean>(true);
    const [strictFormulaPreservation, setStrictFormulaPreservation] = useState<boolean>(true);

    // Music settings (expanded)
    const [dynamicTempo, setDynamicTempo] = useState<boolean>(false);
    const [beatType, setBeatType] = useState<string>('Lo-fi');
    const [instrumentDensity, setInstrumentDensity] = useState<number>(50);
    const [backgroundVocals, setBackgroundVocals] = useState<boolean>(false);
    const [effects, setEffects] = useState<string[]>([]);
    const [vocalType, setVocalType] = useState<string>('AI Voice');
    const [vocalEmotion, setVocalEmotion] = useState<string>('Calm');
    const [vocalAccent, setVocalAccent] = useState<string>('American');
    const [layeredVocals, setLayeredVocals] = useState<number>(1);
    const [instrumentVariation, setInstrumentVariation] = useState<boolean>(false);
    const [songStructure, setSongStructure] = useState<string[]>(['Intro','Verse','Chorus','Bridge']);

    // Math Mode – Music Enhancements
    const [beatAlignment, setBeatAlignment] = useState<boolean>(true);
    const [tempoSync, setTempoSync] = useState<boolean>(true);
    const [keywordEmphasis, setKeywordEmphasis] = useState<boolean>(true);
    const [autoChorusBuilder, setAutoChorusBuilder] = useState<boolean>(true);
    const [backgroundChants, setBackgroundChants] = useState<boolean>(false);

    // Output/preview extras
    const [lyricSummaryMode, setLyricSummaryMode] = useState<boolean>(false);
    const [highlightKeywords, setHighlightKeywords] = useState<boolean>(false);
    const [visualizerType, setVisualizerType] = useState<'Waveform'|'Animated Text'|'Karaoke Lyrics'>('Waveform');
    const [downloadFormat, setDownloadFormat] = useState<'MP3'>('MP3');

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
                {/* Scattered study/music icons */}
                <div className="absolute inset-0">
                  <span className="absolute left-[8%] top-[18%] text-primary/25"><FaMusic size={28} /></span>
                  <span className="absolute left-[22%] top-[40%] text-primary/20"><FaBookOpen size={32} /></span>
                  <span className="absolute left-[12%] bottom-[22%] text-primary/15"><FaPenNib size={26} /></span>

                  <span className="absolute right-[10%] top-[22%] text-primary/20"><FaBookOpen size={30} /></span>
                  <span className="absolute right-[20%] top-[38%] text-primary/25"><FaMusic size={34} /></span>
                  <span className="absolute right-[14%] bottom-[18%] text-primary/15"><FaPenNib size={28} /></span>

                  <span className="absolute left-1/2 top-[12%] -translate-x-1/2 text-primary/15"><FaMusic size={40} /></span>
                  <span className="absolute left-1/2 bottom-[12%] -translate-x-1/2 text-primary/15"><FaBookOpen size={36} /></span>
                </div>
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
                <header className="mb-6 text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400">Knotes Composer</h1>
                    <p className="mt-1 text-sm text-slate-700">Customize how your AI turns study material into music</p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/80 ring-1 ring-black/10 p-1">
                      <button
                        className={`px-4 py-1.5 rounded-full text-sm ${mode==='normal' ? 'bg-blue-600 text-white' : 'text-slate-700'}`}
                        onClick={()=>setMode('normal')}
                        aria-pressed={mode==='normal'}
                        title="Normal mode: Best for summaries, concepts, and general subjects."
                      >🎶 Normal</button>
                      <button
                        className={`px-4 py-1.5 rounded-full text-sm ${mode==='math' ? 'bg-purple-600 text-white' : 'text-slate-700'}`}
                        onClick={()=>setMode('math')}
                        aria-pressed={mode==='math'}
                        title="Math mode: Optimized for formulas, equations, and rhythmic mnemonics."
                      >🧮 Math</button>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      {mode==='normal' ? 'Normal Mode → Best for summaries, concepts, and general subjects.' : 'Math Mode → Optimized for formulas, equations, and rhythmic mnemonics.'}
                    </div>
                </header>

                {/* Split view */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Note Insights */}
                    <section className="lg:col-span-1 space-y-4">
                        {/* Song Scope card */}
                        <div className="rounded-2xl bg-white/90 dark:bg-white/5 backdrop-blur p-6 shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-transform hover:-translate-y-0.5">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent] mb-1">{sessionTitle || 'Study Upload'}</h2>
                            <div className="flex flex-col gap-2 text-sm">
                                <div className="text-sm text-slate-700 dark:text-slate-300">Generate music based off this entire upload or specify key topic(s)</div>
                            </div>
                        </div>

                        {/* Lyrics Generation Settings */}
                        <div className="rounded-2xl bg-white/90 dark:bg-white/5 backdrop-blur p-6 shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-transform hover:-translate-y-0.5">
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent] mb-3">Lyrics Generation Settings</h2>
                          {/* Group 1: Lyrical Mood & Style */}
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-slate-600">Persona</label>
                              <select className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={persona} onChange={e=>setPersona(e.target.value as any)}>
                                {['Student','Narrator','Teacher','Rapper','Storyteller'].map(p=> <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-600">Creativity Level: {creativityLevel}</label>
                              <input type="range" min={0} max={100} value={creativityLevel} onChange={e=>setCreativityLevel(Number(e.target.value))} className="w-full" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-600">Complexity: {complexity}</label>
                              <input type="range" min={1} max={5} value={complexity} onChange={e=>setComplexity(Number(e.target.value))} className="w-full" />
                            </div>
                            <div className="flex items-center gap-2">
                              <input id="humor" type="checkbox" checked={addHumor} onChange={e=>setAddHumor(e.target.checked)} />
                              <label htmlFor="humor" className="text-sm">Add Humor</label>
                            </div>
                          </div>
                          {/* Group 2: Learning Emphasis */}
                          <div className="mt-4 space-y-3">
                            <div>
                              <label className="text-xs text-slate-600">Learning Intent</label>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {['Summarize','Define','Reinforce','Mnemonic','Story-based'].map(chip=>{
                                  const on = learningIntent.includes(chip);
                                  return (
                                    <button key={chip} onClick={()=> setLearningIntent(prev=> on ? prev.filter(x=>x!==chip) : [...prev, chip])} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${on? 'bg-secondary text-slate-900 ring-secondary/60':'bg-white text-slate-700 ring-black/10'}`}>{chip}</button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-slate-600">Focus Topics (comma-separated)</label>
                              <input value={focusTopicsInput} onChange={e=>setFocusTopicsInput(e.target.value)} placeholder="e.g. Chain rule, Eigenvalues" className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-600">Repetition Level: {repetitionLevel}</label>
                              <input type="range" min={0} max={100} value={repetitionLevel} onChange={e=>setRepetitionLevel(Number(e.target.value))} className="w-full" />
                            </div>
                            <div>
                              <label className="text-xs text-slate-600">Lyric Length</label>
                              <select className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={lyricLength} onChange={e=>setLyricLength(e.target.value as any)}>
                                {['short','medium','long','full'].map(x=> <option key={x} value={x}>{x}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-slate-600">Factual Accuracy: {factualAccuracy}</label>
                              <input type="range" min={0} max={100} value={factualAccuracy} onChange={e=>setFactualAccuracy(Number(e.target.value))} className="w-full" />
                            </div>
                          </div>
                          {/* Group 3: Math Mode Only */}
                          {mode==='math' && (
                            <div className="mt-5 rounded-xl border border-purple-200 p-4 bg-purple-50/40">
                              <div className="text-sm font-medium mb-2">Math Optimization Settings</div>
                              <div className="grid grid-cols-1 gap-3">
                                <div>
                                  <label className="text-xs text-slate-600">Formula Style</label>
                                  <select className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={formulaStyle} onChange={e=>setFormulaStyle(e.target.value as any)}>
                                    {['Spoken','Sung','Simplified'].map(x=> <option key={x} value={x}>{x}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs text-slate-600">Equation Frequency: {equationFrequency}</label>
                                  <input type="range" min={0} max={100} value={equationFrequency} onChange={e=>setEquationFrequency(Number(e.target.value))} className="w-full" />
                                </div>
                                <div>
                                  <label className="text-xs text-slate-600">Symbol Pronunciation</label>
                                  <select className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={symbolPronunciation} onChange={e=>setSymbolPronunciation(e.target.value as any)}>
                                    {['Phonetic','Literal'].map(x=> <option key={x} value={x}>{x}</option>)}
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={formulaMnemonics} onChange={e=>setFormulaMnemonics(e.target.checked)} />Formula Mnemonics</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={conceptRhymes} onChange={e=>setConceptRhymes(e.target.checked)} />Concept Rhymes</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={stepByStep} onChange={e=>setStepByStep(e.target.checked)} />Step-by-Step</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={callAndResponse} onChange={e=>setCallAndResponse(e.target.checked)} />Call-and-Response</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={addSimpleExamples} onChange={e=>setAddSimpleExamples(e.target.checked)} />Add Simple Examples</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={strictFormulaPreservation} onChange={e=>setStrictFormulaPreservation(e.target.checked)} />Strict Formula Preservation</label>
                                </div>
                              </div>
                            </div>
                          )}
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

                    {/* Right: Music Composition & Voice Settings */}
                    <section className="lg:col-span-1">
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
                                        {['Solo','Duet','Choir','Group','Rapper','Storyteller','Narrator','Whisper','Robotic','Operatic','Spoken Word'].map((s) => (
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

                            {/* Removed Lyrics Style and Manual Topics as requested */}

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

                            {/* Music Composition & Voice Settings */}
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs text-slate-600">Dynamic Tempo</label>
                                <div className="mt-1">
                                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={dynamicTempo} onChange={e=>setDynamicTempo(e.target.checked)} /> Enable</label>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-slate-600">Beat Type</label>
                                <select className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={beatType} onChange={e=>setBeatType(e.target.value)}>
                                  {['Boom Bap','Trap','Lo-fi','Acoustic','RnB Groove','House','Reggaeton','Drill','Afrobeat Groove','EDM Drop','Jazz Swing','Funk Bounce','Chillhop','Dancehall','Dubstep','Techno','Pop Groove','Rock Beat','Ambient Pulse'].map(x=> <option key={x} value={x}>{x}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-600">Instrument Density: {instrumentDensity}</label>
                                <input type="range" min={0} max={100} value={instrumentDensity} onChange={e=>setInstrumentDensity(Number(e.target.value))} className="w-full" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-600">Background Vocals</label>
                                <div className="mt-1">
                                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={backgroundVocals} onChange={e=>setBackgroundVocals(e.target.checked)} /> Include harmonies</label>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-slate-600">Effects</label>
                                <div className="mt-1 flex flex-wrap gap-2 text-sm">
                                  {['Reverb','Echo','Lo-fi Filter','Auto-tune'].map(eff=>{
                                    const on = effects.includes(eff);
                                    return <button key={eff} onClick={()=> setEffects(prev=> on? prev.filter(x=>x!==eff) : [...prev, eff])} className={`rounded-full px-3 py-1.5 ring-1 ${on? 'bg-secondary text-slate-900 ring-secondary/60':'bg-white text-slate-700 ring-black/10'}`}>{eff}</button>
                                  })}
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-slate-600">Vocal Type</label>
                                <select className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={vocalType} onChange={e=>setVocalType(e.target.value)}>
                                  {['Male','Female','Child','Androgynous','Deep','Soft','Energetic','Calm','Robotic','Ethereal','Vintage'].map(x=> <option key={x} value={x}>{x}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-600">Vocal Emotion</label>
                                <select className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={vocalEmotion} onChange={e=>setVocalEmotion(e.target.value)}>
                                  {['Calm','Confident','Joyful','Chill','Emotional'].map(x=> <option key={x} value={x}>{x}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-600">Vocal Accent</label>
                                <select className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={vocalAccent} onChange={e=>setVocalAccent(e.target.value)}>
                                  {['American','British','African','Asian'].map(x=> <option key={x} value={x}>{x}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-600">Layered Vocals: {layeredVocals}</label>
                                <input type="range" min={1} max={5} value={layeredVocals} onChange={e=>setLayeredVocals(Number(e.target.value))} className="w-full" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-600">Instrument Variation</label>
                                <div className="mt-1">
                                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={instrumentVariation} onChange={e=>setInstrumentVariation(e.target.checked)} /> Vary per section</label>
                                </div>
                              </div>
                              <div className="sm:col-span-2">
                                <label className="text-xs text-slate-600">Song Structure</label>
                                <div className="mt-1 flex flex-wrap gap-2 text-sm">
                                  {['Intro','Verse','Chorus','Bridge','Outro','Continuous Flow'].map(part=>{
                                    const on = songStructure.includes(part);
                                    return <button key={part} onClick={()=> setSongStructure(prev=> on? prev.filter(x=>x!==part) : [...prev, part])} className={`rounded-full px-3 py-1.5 ring-1 ${on? 'bg-secondary text-slate-900 ring-secondary/60':'bg-white text-slate-700 ring-black/10'}`}>{part}</button>
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Math Mode – Music Enhancements */}
                            {mode==='math' && (
                              <div className="mt-5 rounded-xl border border-purple-200 p-4 bg-purple-50/40">
                                <div className="text-sm font-medium mb-2">Math Mode Enhancements</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={beatAlignment} onChange={e=>setBeatAlignment(e.target.checked)} />Beat Alignment</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={tempoSync} onChange={e=>setTempoSync(e.target.checked)} />Tempo Sync</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={keywordEmphasis} onChange={e=>setKeywordEmphasis(e.target.checked)} />Keyword Emphasis</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={autoChorusBuilder} onChange={e=>setAutoChorusBuilder(e.target.checked)} />Auto-Chorus Builder</label>
                                  <label className="flex items-center gap-2"><input type="checkbox" checked={backgroundChants} onChange={e=>setBackgroundChants(e.target.checked)} />Background Chants</label>
                                </div>
                              </div>
                            )}

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
                {/* SECTION 4 — Reinforcement & Output Controls */}
                <section className="mt-6">
                  <div className="rounded-2xl bg-white/95 dark:bg-white/5 backdrop-blur p-6 shadow-md ring-1 ring-black/5 dark:ring-white/10">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent] mb-3">Learning Reinforcement & Output</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={lyricSummaryMode} onChange={e=>setLyricSummaryMode(e.target.checked)} /> Lyric Summary Mode</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={highlightKeywords} onChange={e=>setHighlightKeywords(e.target.checked)} /> Highlight Keywords</label>
                      <div>
                        <label className="text-xs text-slate-600">Visualizer Type</label>
                        <select className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={visualizerType} onChange={e=>setVisualizerType(e.target.value as any)}>
                          {['Waveform','Animated Text','Karaoke Lyrics'].map(x=> <option key={x} value={x}>{x}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-600">Download Format</label>
                        <select disabled className="mt-1 w-full rounded-lg ring-1 ring-black/10 p-2" value={downloadFormat} onChange={e=>setDownloadFormat(e.target.value as any)}>
                          <option value="MP3">MP3</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">More formats coming soon.</p>
                      </div>
                      <div className="md:col-span-2 flex items-end justify-end gap-3">
                        <button onClick={savePreset} className="rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10">Save Preset</button>
                        <button onClick={() => generateSong()} disabled={isGenerating || !isReady} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-400 to-green-400 px-5 py-2.5 text-slate-900 font-medium shadow disabled:opacity-60">
                          <FaMusic /> Generate Music
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">This may take a few seconds — your study beats are on the way 🎶</p>
                  </div>
                </section>

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
                                    <button className="rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10" onClick={regenerateLyricsOnly}>Regenerate Lyrics</button>
                                    <button className="rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10" onClick={regenerateMusicOnly}>Regenerate Music</button>
                                    <button className="rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10" onClick={handleCopyLyrics}>Copy Lyrics</button>
                                    <button className="rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white hover:bg-white/90 dark:bg-white/10 dark:ring-white/10" onClick={handleDownloadLyrics}>Download Lyrics (txt)</button>
                                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 ring-1 ring-black/10 bg-white dark:bg-white/10 dark:ring-white/10">
                                        <span className="text-sm">Adjust Tempo</span>
                                        <input type="range" min={50} max={180} value={tempo} onChange={(e)=>setTempo(Number(e.target.value))} />
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