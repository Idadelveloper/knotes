// Local persistent storage for study collections (groups of sessions)
// A collection groups related study sessions by their IDs.

export type Collection = {
  id: string;
  name: string;
  createdAt: string;
  sessionIds: string[];
};

const COLLECTIONS_KEY = 'knotes_collections_index';
const COLLECTION_PREFIX = 'knotes_collection_';

function safeParse<T>(val: string | null, fallback: T): T {
  try { return val ? (JSON.parse(val) as T) : fallback; } catch { return fallback; }
}

function saveIndex(arr: any[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(arr));
}

export function listCollections(): Pick<Collection, 'id'|'name'|'createdAt'>[] {
  if (typeof window === 'undefined') return [];
  return safeParse(localStorage.getItem(COLLECTIONS_KEY), [] as any[]);
}

export function getCollection(id: string): Collection | null {
  if (typeof window === 'undefined') return null;
  return safeParse(localStorage.getItem(COLLECTION_PREFIX + id), null as any);
}

export function saveCollection(c: Collection) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COLLECTION_PREFIX + c.id, JSON.stringify(c));
  const idx = listCollections();
  const filtered = idx.filter(x => x.id !== c.id);
  const minimal = { id: c.id, name: c.name, createdAt: c.createdAt };
  saveIndex([minimal, ...filtered]);
}

export function createCollection(name: string): Collection {
  const c: Collection = { id: generateId(), name, createdAt: new Date().toISOString(), sessionIds: [] };
  saveCollection(c);
  return c;
}

export function deleteCollection(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(COLLECTION_PREFIX + id);
  const idx = listCollections().filter(c => c.id !== id);
  saveIndex(idx);
}

export function addSessionToCollection(collectionId: string, sessionId: string) {
  const c = getCollection(collectionId);
  if (!c) return;
  if (!c.sessionIds.includes(sessionId)) c.sessionIds.unshift(sessionId);
  saveCollection(c);
}

export function removeSessionFromCollection(collectionId: string, sessionId: string) {
  const c = getCollection(collectionId);
  if (!c) return;
  c.sessionIds = c.sessionIds.filter(id => id !== sessionId);
  saveCollection(c);
}

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'c_' + Math.random().toString(36).slice(2, 10);
}
