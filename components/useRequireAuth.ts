"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

/**
 * Lightweight wrapper hook that redirects to the landing page if the user is not authenticated.
 * Kept separate from the provider module to avoid any potential module evaluation edge cases.
 */
export function useRequireAuth(redirectTo: string = "/") {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isReady = !loading && !!user;

  useEffect(() => {
    if (!loading && !user) {
      try { router.replace(redirectTo); } catch {}
    }
  }, [loading, user, router, redirectTo]);

  return { user, loading, isReady } as const;
}
