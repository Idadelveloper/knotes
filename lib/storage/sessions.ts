// Local persistent storage for study sessions.
// Stores original (immutable) and structured notes, plus an editable copy.
import { stripWrappingCodeFence } from "@/lib/utils/markdown";

export type StoredSession = {
  id: string;
  title: string;
  createdAt: string; // ISO string
  originalText: string; // raw extracted text
  structuredText: string; // rewritten/structured text (markdown preferred)
  editableText?: string; // authUser's working copy (markdown)
};

const SESSIONS_KEY = "knotes_sessions_index"; // array of {id,title,createdAt}
const SESSION_PREFIX = "knotes_session_"; // + id -> StoredSession

function safeParse<T>(val: string | null, fallback: T): T {
  try { return val ? (JSON.parse(val) as T) : fallback; } catch { return fallback; }
}

export function listSessions(): Pick<StoredSession, 'id' | 'title' | 'createdAt'>[] {
  if (typeof window === 'undefined') return [];
  return safeParse(localStorage.getItem(SESSIONS_KEY), [] as any[]);
}

export function getSession(id: string): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_PREFIX + id);
  return safeParse<StoredSession | null>(raw, null);
}

export function saveSession(sess: StoredSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_PREFIX + sess.id, JSON.stringify(sess));
  const idx = listSessions();
  const filtered = idx.filter((s) => s.id !== sess.id);
  const next = [{ id: sess.id, title: sess.title, createdAt: sess.createdAt }, ...filtered];
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
}

export function createSession(title: string, originalText: string, structuredText: string): StoredSession {
  const id = generateId();
  const createdAt = new Date().toISOString();
  const orig = stripWrappingCodeFence(originalText || "");
  const struct = stripWrappingCodeFence(structuredText || "");
  const sess: StoredSession = { id, title, createdAt, originalText: orig, structuredText: struct, editableText: struct };
  saveSession(sess);
  return sess;
}

export function updateEditableText(id: string, editableText: string) {
  const sess = getSession(id);
  if (!sess) return;
  sess.editableText = stripWrappingCodeFence(editableText || "");
  saveSession(sess);
}

export function resetToOriginal(id: string) {
  const sess = getSession(id);
  if (!sess) return;
  sess.editableText = sess.structuredText || sess.originalText;
  saveSession(sess);
}

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 's_' + Math.random().toString(36).slice(2, 10);
}
