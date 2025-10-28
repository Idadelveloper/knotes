"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "@/lib/storage/sessions";
import dynamic from "next/dynamic";

const MusicGenerator = dynamic(() => import("@/components/music/MusicGenerator"), { ssr: false });

// Loader that seeds sessionStorage then shows the music UI bound to that session
export default function MusicSessionPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);

  useEffect(() => {
    if (!id) return;
    const sess = getSession(id);
    if (!sess) {
      router.replace("/library?intent=music");
      return;
    }
    try {
      sessionStorage.setItem("knotes_current_session_id", sess.id);
      // Seed notes as context for music if needed later
      sessionStorage.setItem("knotes_extracted_text", sess.originalText);
      sessionStorage.setItem("knotes_structured_text", (sess.editableText || sess.structuredText || sess.originalText));
      sessionStorage.setItem("knotes_title", sess.title || "Study Notes");
    } catch {}
  }, [id, router]);

  // Render the music generator/player
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pt-24 pb-20">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-[--color-accent] mb-6">Music</h1>
      <p className="text-slate-700 dark:text-slate-300 mb-4">Generated based on your selected upload/session.</p>
      <MusicGenerator showLauncher={true} />
    </main>
  );
}
