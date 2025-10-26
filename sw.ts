/* Knotes Service Worker powered by Serwist (TypeScript) */

// We use the UMD build of Serwist via importScripts to avoid bundling.
// This file is compiled to public/sw.js during build.

export {};

// Serwist type helpers (optional)
declare global {
  interface WorkerGlobalScope {
    __SW_MANIFEST: (any | string)[] | undefined;
    serwist: any;
  }
}

declare const self: ServiceWorkerGlobalScope & WorkerGlobalScope;

// Load Serwist UMD bundle at runtime (from CDN)
// You can self-host this later if preferred.
self.importScripts("https://unpkg.com/serwist@9.2.1/dist/serwist.umd.js");

(function () {
  if (!self.serwist || !self.serwist.Serwist) {
    // Fallback: no Serwist available; bail out gracefully.
    // The app will continue to work online without SW features.
    // eslint-disable-next-line no-console
    console.warn("Serwist UMD failed to load in Service Worker.");
    return;
  }

  const { Serwist } = self.serwist as { Serwist: new (opts: any) => any };

  // Optional global manifest injected by build tools. Not used here, but
  // we keep the declaration to be compatible with Serwist's precache.
  // In our setup, this will be undefined and that's okay.
  self.__SW_MANIFEST = self.__SW_MANIFEST || undefined;

  // Initialize Serwist per docs with sensible defaults for a PWA.
  const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    precacheOptions: {
      cleanupOutdatedCaches: true,
      concurrency: 10,
      ignoreURLParametersMatching: [],
    },
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: false,
    disableDevLogs: true,
    // No explicit runtimeCaching here to keep things minimal.
    // You can register custom routes at runtime if needed.
  });

  // Hook Serwist event listeners (install/activate/fetch/message)
  serwist.addEventListeners();

  // Interop with native SW API — minimal example
  self.addEventListener("message", (event: ExtendableMessageEvent) => {
    // Allow pages to ask SW to skip waiting immediately
    if (event && (event as any).data === "SKIP_WAITING") self.skipWaiting();
  });
})();
