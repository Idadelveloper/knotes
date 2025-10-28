"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MusicGuard() {
  const router = useRouter();
  useEffect(() => {
    const sid = typeof window !== 'undefined' ? sessionStorage.getItem('knotes_current_session_id') : null;
    if (sid) {
      router.replace(`/music/${sid}`);
    } else {
      router.replace(`/library?intent=music`);
    }
  }, [router]);
  return null;
}
