"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FaPlus, FaTrash, FaChevronRight, FaChevronLeft } from "react-icons/fa";
import SelectDialog from "@/components/music/SelectDialog";
import { getCollection, addSessionToCollection, removeSessionFromCollection } from "@/lib/storage/collections";
import { getSession, listSessions } from "@/lib/storage/sessions";
import StudyWorkspace from "../../[id]/page"; // reuse the main study workspace which reads from sessionStorage

export default function CollectionStudyPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = Array.isArray((params as any)?.id) ? (params as any).id[0] : ((params as any)?.id as string | undefined);

  const [openSelect, setOpenSelect] = useState(false);
  const [working, setWorking] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [titles, setTitles] = useState<Record<string, string>>({});

  // Load collection
  useEffect(() => {
    if (!collectionId) return;
    const col = getCollection(collectionId);
    if (!col) return;
    setSessionIds(col.sessionIds || []);
  }, [collectionId]);

  // Resolve titles for sessions
  useEffect(() => {
    try {
      const all = listSessions();
      const map: Record<string, string> = {};
      for (const s of all) map[s.id] = s.title;
      setTitles(map);
    } catch {}
  }, [sessionIds.join(",")]);

  // Pick first session as active if none
  useEffect(() => {
    if (!activeSessionId && sessionIds.length > 0) {
      setActiveSessionId(sessionIds[0]);
    }
  }, [sessionIds, activeSessionId]);

  // When active session changes, sync sessionStorage for StudyWorkspace to use
  useEffect(() => {
    if (!activeSessionId) return;
    try {
      const sess = getSession(activeSessionId);
      if (sess) {
        sessionStorage.setItem("knotes_current_session_id", sess.id);
        sessionStorage.setItem("knotes_extracted_text", sess.originalText);
        sessionStorage.setItem("knotes_structured_text", (sess.editableText || sess.structuredText || sess.originalText));
        sessionStorage.setItem("knotes_title", sess.title || "Study Notes");
      }
    } catch {}
  }, [activeSessionId]);

  const handleAddSession = (sid: string) => {
    if (!collectionId) return;
    try {
      setWorking(true);
      addSessionToCollection(collectionId, sid);
      const next = getCollection(collectionId);
      setSessionIds(next?.sessionIds || []);
      if (!activeSessionId) setActiveSessionId(sid);
    } finally {
      setWorking(false);
    }
  };

  const [selectedForRemoval, setSelectedForRemoval] = useState<Record<string, boolean>>({});
  const toggleSelect = (sid: string) => setSelectedForRemoval(s => ({ ...s, [sid]: !s[sid] }));
  const clearSelection = () => setSelectedForRemoval({});

  const anySelected = useMemo(() => Object.values(selectedForRemoval).some(Boolean), [selectedForRemoval]);

  const removeSelected = () => {
    if (!collectionId) return;
    const ids = Object.keys(selectedForRemoval).filter(k => selectedForRemoval[k]);
    if (ids.length === 0) return;
    const ok = typeof window !== 'undefined' ? window.confirm(`Remove ${ids.length} session${ids.length>1?'s':''} from this collection?`) : true;
    if (!ok) return;
    for (const sid of ids) removeSessionFromCollection(collectionId, sid);
    const next = getCollection(collectionId);
    setSessionIds(next?.sessionIds || []);
    // Adjust active session if it was removed
    if (activeSessionId && ids.includes(activeSessionId)) {
      setActiveSessionId(next?.sessionIds?.[0]);
    }
    clearSelection();
  };

  if (!collectionId) return null;

  const empty = sessionIds.length === 0;

  return (
    <main className="w-full h-[calc(100vh-4rem)] px-5 pt-20 pb-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900 truncate">Collection Study</h1>
          <span className="text-slate-500 text-sm">/ {collectionId.slice(0,8)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
            onClick={() => setOpenSelect(true)}
            disabled={working}
          >
            <FaPlus /> Add session
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${anySelected? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-slate-100 text-slate-600 cursor-not-allowed'}`}
            onClick={removeSelected}
            disabled={!anySelected || working}
          >
            <FaTrash /> Remove selected
          </button>
        </div>
      </div>

      <div className="flex w-full h-full gap-4">
        {/* Sidebar */}
        <aside className={`transition-all duration-200 ${expanded? 'w-64' : 'w-10'} flex-shrink-0`}>
          <div className="h-full rounded-xl border border-black/5 bg-white shadow-sm flex flex-col">
            <button
              className="p-2 text-slate-500 hover:text-slate-700 self-end"
              onClick={() => setExpanded(e => !e)}
              title={expanded? 'Collapse' : 'Expand'}
            >
              {expanded? <FaChevronLeft /> : <FaChevronRight />}
            </button>
            {expanded && (
              <div className="px-3 pb-3 overflow-auto">
                {empty ? (
                  <div className="text-sm text-slate-600 py-6">No sessions yet. Use "Add session" to include sessions in this collection.</div>
                ) : (
                  <ul className="space-y-1">
                    {sessionIds.map((sid) => {
                      const title = titles[sid] || `Session ${sid.slice(0,6)}`;
                      const active = sid === activeSessionId;
                      const checked = !!selectedForRemoval[sid];
                      return (
                        <li key={sid} className="group">
                          <button
                            onClick={() => setActiveSessionId(sid)}
                            className={`w-full text-left px-3 py-2 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50/60 ${active? 'bg-blue-100/80 text-blue-900 font-medium' : 'text-slate-800'}`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                onChange={(e) => { e.stopPropagation(); toggleSelect(sid); }}
                                onClick={(e) => e.stopPropagation()}
                                title="Select to remove"
                              />
                              <span className="truncate">{title}</span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Content */}
        <section className="flex-1 min-w-0 rounded-xl border border-black/5 bg-white shadow-sm overflow-hidden">
          {empty || !activeSessionId ? (
            <div className="h-full flex items-center justify-center text-slate-600">
              <div className="text-center max-w-md px-6">
                <p className="mb-3">This collection has no sessions yet.</p>
                <button
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  onClick={() => setOpenSelect(true)}
                >
                  <FaPlus /> Add your first session
                </button>
              </div>
            </div>
          ) : (
            // The StudyWorkspace reads from sessionStorage and will reflect the active session
            <StudyWorkspace key={activeSessionId} />
          )}
        </section>
      </div>

      <SelectDialog
        open={openSelect}
        onClose={() => setOpenSelect(false)}
        mode="study"
        onSelectSession={(sid) => {
          handleAddSession(sid);
          setOpenSelect(false);
        }}
      />
    </main>
  );
}
