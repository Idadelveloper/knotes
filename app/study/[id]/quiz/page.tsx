"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getGeminiModel } from "@/lib/ai";
import { incStat } from "@/lib/stats";
import { HiOutlineX } from "react-icons/hi";
import { getSession } from "@/lib/storage/sessions";
import { useRequireAuth } from "@/components/useRequireAuth";

// Lightweight types for the quiz
export type QuizQuestion = {
  id: string;
  type: "mcq" | "multi" | "free"; // mcq = single choice, multi = multiple choice, free = short/long answer
  question: string;
  options?: string[]; // for mcq/multi
};

export type Quiz = {
  title: string;
  questions: QuizQuestion[];
};

export default function QuizPage() {
  const { user, loading } = useRequireAuth();
  if (!user && !loading) return null;
  const router = useRouter();
  const params = useParams();
  const routeId = Array.isArray((params as any)?.id) ? (params as any).id[0] : ((params as any)?.id as string | undefined);

  const [quizLoading, setQuizLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    score: number;
    feedback: string;
    topics: string[];
    details: { id: string; correct: boolean; explanation?: string; correctAnswer?: string | string[] }[];
  }>(null);
  const [showResult, setShowResult] = useState(false);

  // Timer state
  const [durationSec, setDurationSec] = useState<number>(15 * 60); // default 15 minutes
  const [remainingSec, setRemainingSec] = useState<number>(15 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const tickRef = useRef<number | null>(null);
  const autoSubmittedRef = useRef<boolean>(false);

  // Read session context from sessionStorage, with robust fallback to local sessions store
  const sessionText = useMemo(() => {
    if (typeof window === "undefined") return "";
    // 1) Prefer sessionStorage (fast path)
    let text = (sessionStorage.getItem("knotes_structured_text") || sessionStorage.getItem("knotes_extracted_text") || "").trim();
    if (text) return text;
    // 2) Fallback: try to recover by route id or current session id from sessionStorage
    try {
      const sid = (Array.isArray((params as any)?.id) ? (params as any).id[0] : ((params as any)?.id as string | undefined)) || sessionStorage.getItem("knotes_current_session_id") || "";
      if (sid) {
        const sess = getSession(sid);
        if (sess && (sess.structuredText || sess.originalText)) {
          const recovered = (sess.editableText || sess.structuredText || sess.originalText || "").trim();
          // Repopulate sessionStorage for downstream consumers
          try {
            sessionStorage.setItem("knotes_current_session_id", sess.id);
            sessionStorage.setItem("knotes_extracted_text", sess.originalText || "");
            sessionStorage.setItem("knotes_structured_text", (sess.editableText || sess.structuredText || sess.originalText || ""));
            sessionStorage.setItem("knotes_title", sess.title || "Session");
          } catch {}
          return recovered;
        }
      }
    } catch {}
    return "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessionTitle = useMemo(() => {
    if (typeof window === "undefined") return "Session";
    const st = sessionStorage.getItem("knotes_title");
    if (st && st.trim()) return st;
    try {
      const sid = (Array.isArray((params as any)?.id) ? (params as any).id[0] : ((params as any)?.id as string | undefined)) || sessionStorage.getItem("knotes_current_session_id") || "";
      if (sid) {
        const sess = getSession(sid);
        if (sess?.title) {
          // ensure sessionStorage is hydrated too
          try { sessionStorage.setItem("knotes_title", sess.title); } catch {}
          return sess.title;
        }
      }
    } catch {}
    return "Session";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manage countdown timer lifecycle
  useEffect(() => {
    // Start timer when a quiz becomes available
    if (quiz) {
      setRemainingSec(durationSec);
      setTimerRunning(true);
      autoSubmittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz]);
 
  useEffect(() => {
    if (!timerRunning) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    // Create ticking interval
    tickRef.current = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          // Time up: stop and auto-submit once
          if (tickRef.current) {
            window.clearInterval(tickRef.current);
            tickRef.current = null;
          }
          setTimerRunning(false);
          if (!autoSubmittedRef.current && quiz && !submitting && !showResult) {
            autoSubmittedRef.current = true;
            // Auto-submit answers
            onSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as unknown as number;
    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [timerRunning, quiz, submitting, showResult]);

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function resetTimer(newDuration: number) {
    setDurationSec(newDuration);
    setRemainingSec(newDuration);
    // If a quiz exists, keep the current running state; otherwise paused
    if (quiz) setTimerRunning(true);
  }

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      setQuizLoading(true);
      setError(null);
      setQuiz(null);
      try {
        const notes = (sessionText || "").trim();
        if (!notes) throw new Error("No session notes found to generate the quiz.");
        const model = getGeminiModel();
        const prompt = `You are a quiz generator. Create a 6-question mixed-format quiz to assess understanding of the main subject matter in the study notes provided below.
Return STRICT JSON in this exact schema (no markdown, no commentary):\n{
  "title": string,
  "questions": [
    {"id": string, "type": "mcq"|"multi"|"free", "question": string, "options"?: string[]}
  ]
}
Guidelines:
- Focus ONLY on core learning content: concepts, definitions, theorems, formulas, processes, reasoning, examples, and applications.
- EXCLUDE administrative or meta details such as course/instructor names, assignment numbers, due dates, policies, grading, logistics, office hours, contact info, or similar.
- If the notes contain sections like "Course Info", "Instructor", "Syllabus", "Assignment", "Logistics", "Contact", "Office Hours", "Due Date", or "Grading", ignore them when creating questions.
- Mix 3 MCQs (single correct), 1 multi-select (2–3 correct), and 2 free-response conceptual or applied questions.
- MCQ/multi options should be concise and plausible.
- Cover key definitions, reasoning, and application. Avoid trivial recall only.
- Keep each question self-contained and unambiguous.
Notes (may include non-content administrative headers—ignore those):\n---\n${notes}\n---`;
        const res = await model.generateContent([{ text: prompt } as any]);
        const text = res?.response?.text?.() || "";
        let data: Quiz | null = null;
        try {
          data = JSON.parse(text);
        } catch {
          // Try to extract JSON block if model added extra text
          const m = text.match(/\{[\s\S]*\}/);
          if (m) {
            try { data = JSON.parse(m[0]); } catch {}
          }
        }
        if (!data || !Array.isArray(data.questions)) throw new Error("Failed to generate a valid quiz. Please retry.");
        if (!cancelled) {
          setQuiz(data);
          try { incStat("quizzesTaken", 1); } catch {}
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message || "Failed to generate quiz.");
      } finally {
        if (!cancelled) setQuizLoading(false);
      }
    }
    generate();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateAnswer(q: QuizQuestion, val: string | string[], checked?: boolean) {
    setAnswers(prev => {
      if (q.type === "multi") {
        const cur = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
        if (typeof val === "string") {
          if (checked) return { ...prev, [q.id]: Array.from(new Set([...cur, val])) };
          return { ...prev, [q.id]: cur.filter(v => v !== val) };
        }
        return { ...prev, [q.id]: val };
      }
      return { ...prev, [q.id]: Array.isArray(val) ? val[0] : val };
    });
  }

  async function onSubmit(auto = false) {
    if (!quiz) return;
    if (submitting) return; // guard
    setSubmitting(true);
    setError(null);
    // stop timer while grading
    setTimerRunning(false);
    try {
      const model = getGeminiModel();
      const payload = {
        quiz,
        answers,
        notes: sessionText,
      };
      const gradingPrompt = `You are a precise grader. Given a quiz, the student's answers, and the source notes, grade fairly and return STRICT JSON with per-question correctness, explanations, and study topics.
Return EXACTLY this JSON schema (no markdown):\n{
  "score": number, // 0-100
  "feedback": string,
  "topics": string[],
  "details": [
    {"id": string, "correct": boolean, "explanation"?: string, "correctAnswer"?: string | string[]}
  ]
}
Rules:
- Focus ONLY on the main learning content from the notes (concepts, definitions, theorems, formulas, processes, reasoning, examples, applications).
- IGNORE administrative/meta details (course/instructor names, assignment numbers, due dates, policies, grading schemes, logistics, office hours, contact info, etc.).
- If the notes contain sections like "Course Info", "Instructor", "Syllabus", "Assignment", "Logistics", "Contact", "Office Hours", "Due Date", or "Grading", do not use them for grading.
- For MCQ/multi, infer correct answers from the core content in the notes and question framing, and evaluate selections rigorously.
- For free-response, compare content to expected concepts. Be lenient to phrasing; focus on key ideas.
- Provide brief explanations for incorrect items and include the correct answer(s).
- Be concise but helpful in feedback and topics list.`;
      const res = await model.generateContent([
        { text: gradingPrompt } as any,
        { text: JSON.stringify(payload) } as any,
      ]);
      const text = res?.response?.text?.() || "";
      let grade: any = null;
      try { grade = JSON.parse(text); } catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) { try { grade = JSON.parse(m[0]); } catch {} }
      }
      if (!grade || typeof grade.score !== "number" || !Array.isArray(grade.details)) {
        throw new Error("Failed to grade quiz. Please try again.");
      }
      setResult({
        score: Math.max(0, Math.min(100, Math.round(grade.score))),
        feedback: grade.feedback || "",
        topics: Array.isArray(grade.topics) ? grade.topics.slice(0, 8) : [],
        details: grade.details,
      });
      setShowResult(true);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetAnswers() {
    setAnswers({});
    setShowResult(false);
  }

  function regenerate() {
    // Simply reload route to trigger new generation
    router.refresh();
    setQuizLoading(true);
    setError(null);
    setQuiz(null);
    setAnswers({});
    setSubmitting(false);
    setResult(null);
    setShowResult(false);
    // Also attempt programmatic regeneration by running effect again via a key change
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur ring-1 ring-black/5">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/study/${routeId || ""}`)}
              className="rounded-lg px-3 py-2 ring-1 ring-black/10 hover:bg-slate-50"
              aria-label="Back to session"
            >
              ← Back
            </button>
            <h1 className="text-lg font-semibold text-slate-800">{quiz?.title || `Quiz: ${sessionTitle}`}</h1>
          </div>
          <div className="flex items-center gap-3">
            {quiz && (
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 ring-1 ring-black/10" title="Time remaining. The quiz will auto-submit when time is up.">
                <span className={`text-sm font-mono ${remainingSec <= 60 ? 'text-red-600' : 'text-slate-800'}`}>{formatTime(remainingSec)}</span>
                <select
                  aria-label="Select quiz duration"
                  className="bg-transparent text-xs text-slate-600 outline-none"
                  value={durationSec}
                  onChange={(e) => resetTimer(Number(e.target.value))}
                  disabled={submitting}
                >
                  <option value={300}>5m</option>
                  <option value={600}>10m</option>
                  <option value={900}>15m</option>
                  <option value={1800}>30m</option>
                </select>
                <button
                  type="button"
                  onClick={() => setTimerRunning(v => !v)}
                  className="text-xs rounded px-2 py-1 bg-white ring-1 ring-black/10 hover:bg-slate-50"
                  aria-pressed={timerRunning}
                >
                  {timerRunning ? 'Pause' : 'Resume'}
                </button>
              </div>
            )}
            <button onClick={regenerate} className="rounded-lg px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 ring-1 ring-blue-200">Generate New</button>
            <button onClick={() => router.push(`/study/${routeId || ""}`)} className="rounded-lg px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 ring-1 ring-black/10">Terminate</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {quizLoading && (
          <div className="p-8 text-center text-slate-600">📝 Generating quiz from your session notes…</div>
        )}
        {error && (
          <div className="p-4 mb-4 rounded-lg bg-red-50 text-red-700 ring-1 ring-red-200 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold mb-1">Could not generate quiz</div>
              <div className="text-sm">{error}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg px-3 py-2 bg-red-100 hover:bg-red-200" onClick={() => router.refresh()}>Retry</button>
              <button className="rounded-lg px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => router.push(`/study/${routeId || ''}`)}>Back to Session</button>
            </div>
          </div>
        )}
        {quiz && (
          <form
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
            className="bg-white rounded-2xl shadow p-6 ring-1 ring-black/5"
          >
            <ol className="space-y-6 list-decimal pl-6">
              {quiz.questions.map((q, idx) => (
                <li key={q.id} className="space-y-3">
                  <div className="font-medium text-slate-800">{q.question}</div>
                  {q.type !== "free" && Array.isArray(q.options) && (
                    <div className="space-y-2">
                      {q.type === "mcq" && q.options.map((opt, i) => {
                        const id = `${q.id}_${i}`;
                        const val = String(i);
                        const cur = answers[q.id] as string | undefined;
                        return (
                          <label key={id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={q.id}
                              value={val}
                              checked={cur === val}
                              onChange={(e) => updateAnswer(q, e.target.value)}
                            />
                            <span className="text-slate-700">{opt}</span>
                          </label>
                        );
                      })}
                      {q.type === "multi" && q.options.map((opt, i) => {
                        const id = `${q.id}_${i}`;
                        const val = String(i);
                        const cur = (answers[q.id] as string[] | undefined) || [];
                        const checked = cur.includes(val);
                        return (
                          <label key={id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              name={`${q.id}_${i}`}
                              value={val}
                              checked={checked}
                              onChange={(e) => updateAnswer(q, val, e.target.checked)}
                            />
                            <span className="text-slate-700">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "free" && (
                    <textarea
                      className="w-full min-h-[96px] rounded-lg border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Type your answer…"
                      value={(answers[q.id] as string) || ""}
                      onChange={(e) => updateAnswer(q, e.target.value)}
                    />
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 ring-1 ring-black/10"
                onClick={resetAnswers}
              >
                Retake
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Grading…" : "Submit for Grading"}
              </button>
            </div>
          </form>
        )}
      </main>

      {showResult && result && (
        <ResultModal
          result={result}
          onClose={() => setShowResult(false)}
          onRetake={() => { setShowResult(false); resetAnswers(); }}
          onGenerateNew={() => { setShowResult(false); regenerate(); }}
          onTerminate={() => router.push(`/study/${routeId || ""}`)}
        />
      )}
    </div>
  );
}

function ResultModal({
  result,
  onClose,
  onRetake,
  onGenerateNew,
  onTerminate,
}: {
  result: { score: number; feedback: string; topics: string[]; details: { id: string; correct: boolean; explanation?: string; correctAnswer?: string | string[] }[] };
  onClose: () => void;
  onRetake: () => void;
  onGenerateNew: () => void;
  onTerminate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className="relative z-10 max-w-2xl w-full mx-4 rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="text-lg font-semibold text-slate-800">Quiz Results</div>
          <button className="p-2 rounded-lg hover:bg-slate-100" onClick={onClose} aria-label="Close results">
            <HiOutlineX />
          </button>
        </div>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold text-slate-900">{result.score}%</div>
            <div className="text-slate-600">Overall Score</div>
          </div>
          {result.feedback && (
            <div className="p-3 rounded-lg bg-blue-50 text-blue-800 ring-1 ring-blue-200 text-sm whitespace-pre-wrap">
              {result.feedback}
            </div>
          )}
          {result.topics?.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-800 mb-2">Suggested Topics to Review</div>
              <div className="flex flex-wrap gap-2">
                {result.topics.map((t, i) => (
                  <span key={i} className="rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-sm ring-1 ring-black/10">{t}</span>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-800">Breakdown</div>
            <ul className="space-y-2">
              {result.details.map((d, i) => (
                <li key={i} className={`p-3 rounded-lg ring-1 ${d.correct ? "bg-green-50 text-green-800 ring-green-200" : "bg-red-50 text-red-800 ring-red-200"}`}>
                  <div className="text-sm font-medium">Question {i + 1}: {d.correct ? "Correct" : "Incorrect"}</div>
                  {!d.correct && (
                    <div className="text-sm mt-1 space-y-1">
                      {d.correctAnswer && (
                        <div><span className="font-semibold">Correct answer:</span> {Array.isArray(d.correctAnswer) ? d.correctAnswer.join(", ") : d.correctAnswer}</div>
                      )}
                      {d.explanation && (
                        <div className="opacity-90">{d.explanation}</div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button onClick={onRetake} className="rounded-lg px-3 py-2 bg-slate-100 hover:bg-slate-200">Retake</button>
          <button onClick={onGenerateNew} className="rounded-lg px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100">Generate New</button>
          <button onClick={onTerminate} className="rounded-lg px-3 py-2 bg-slate-800 text-white hover:bg-slate-900">Terminate</button>
        </div>
      </div>
    </div>
  );
}
