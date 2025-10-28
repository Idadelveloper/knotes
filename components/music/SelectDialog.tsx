"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listSessions } from "@/lib/storage/sessions";
import { HiOutlineX } from "react-icons/hi";

export type SelectDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function SelectDialog({ open, onClose }: SelectDialogProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState<{ id: string; title: string; createdAt: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    try {
      setSessions(listSessions());
    } catch {}
  }, [open]);

  if (!open) return null;

  const handleNewUpload = () => {
    onClose?.();
    router.push("/home");
  };

  const handleSelect = (id: string) => {
    try { sessionStorage.setItem("knotes_current_session_id", id); } catch {}
    onClose?.();
    router.push(`/music/${id}`);
  };

  const empty = sessions.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Dialog */}
      <div className="relative z-10 w-[92vw] max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <h3 className="text-lg font-semibold text-slate-900">Select a Study Upload</h3>
          <button aria-label="Close" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5">
            <HiOutlineX />
          </button>
        </div>
        <div className="px-5 pt-4 pb-5">
          <p className="text-sm text-slate-600 mb-3">Choose an existing upload to generate a new track from, or create a new upload.</p>

          <div className="mb-4">
            <button
              onClick={handleNewUpload}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-white shadow-[0_4px_0_rgba(0,0,0,0.08)] hover:bg-purple-700 hover:shadow-[0_6px_0_rgba(0,0,0,0.12)] active:translate-y-px active:shadow-[0_3px_0_rgba(0,0,0,0.12)]"
              title="Create a new upload"
            >
              New Upload
            </button>
          </div>

          {empty ? (
            <div className="rounded-xl border border-dashed border-black/10 p-6 text-center text-slate-600">
              <div className="mb-2">No uploads found.</div>
              <button onClick={handleNewUpload} className="text-purple-700 hover:underline">Create one now</button>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-black/5 rounded-xl border border-black/5">
              {sessions.map((s) => (
                <li key={s.id} className="p-4 hover:bg-purple-50 cursor-pointer flex items-center justify-between gap-3" onClick={() => handleSelect(s.id)}>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{s.title}</div>
                    <div className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-purple-700">Use</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
