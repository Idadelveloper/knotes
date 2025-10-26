"use client";
import { useEffect } from "react";

export default function PWA() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const swUrl = "/sw.ts";
        const reg = await navigator.serviceWorker.register(swUrl, { scope: "/" });

        // Listen for updates and activate the new SW immediately.
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Tell the waiting SW to skip waiting so it becomes active.
              reg.waiting?.postMessage?.("SKIP_WAITING");
            }
          });
        });

        // If there's already a waiting worker (e.g., page is reloaded), nudge it.
        reg.waiting?.postMessage?.("SKIP_WAITING");
      } catch (e) {
        // Silent fail in dev environments.
        console.warn("SW registration failed", e);
      }
    };

    register();

    // Optional: re-register on visibility to catch updates after long inactivity
    const onFocus = () => navigator.serviceWorker.getRegistration().then(r => r?.update());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return null;
}
