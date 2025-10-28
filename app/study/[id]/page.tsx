"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession } from "@/lib/storage/sessions";

// Bridge dynamic session route to existing /study workspace that relies on sessionStorage keys.
export default function StudySessionLoader() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);

  useEffect(() => {
    if (!id) return;
    const sess = getSession(id);
    if (!sess) {
      // No session found; go to /study fallback
      router.replace("/study");
      return;
    }
    // Populate sessionStorage for legacy StudyWorkspace
    try {
      sessionStorage.setItem("knotes_current_session_id", sess.id);
      sessionStorage.setItem("knotes_extracted_text", sess.originalText);
      sessionStorage.setItem("knotes_structured_text", (sess.editableText || sess.structuredText || sess.originalText));
      sessionStorage.setItem("knotes_title", sess.title || "Study Notes");
    } catch {}
    // Navigate to main study page
    router.replace("/study");
  }, [id, router]);

  return null;
}
