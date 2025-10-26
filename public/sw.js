/* Knotes Service Worker powered by Serwist */
/* eslint-disable no-undef */

// Load Serwist UMD bundle at runtime.
// This keeps our Next.js build simple without extra bundling steps.
importScripts("https://unpkg.com/serwist@9.2.1/dist/serwist.umd.js");

(function () {
  if (!self.serwist || !self.serwist.Serwist) {
    // Fallback: no Serwist available; bail out gracefully.
    // The app will continue to work online without SW features.
    console.warn("Serwist UMD failed to load in Service Worker.");
    return;
  }

  const { Serwist } = self.serwist;

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
    // You can register custom routes at runtime (see below) if needed.
  });

  // Hook Serwist event listeners (install/activate/fetch/message)
  serwist.addEventListeners();

  // Example of interop with native SW API — keep minimal but ready for future.
  self.addEventListener("message", (event) => {
    // Allow pages to ask SW to skip waiting immediately
    if (event && event.data === "SKIP_WAITING") self.skipWaiting();
  });
})();
