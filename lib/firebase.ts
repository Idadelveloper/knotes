// Firebase initialization for Knotes
// Client-side only usage in Next.js app pages/components

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Read config from environment variables (client-safe NEXT_PUBLIC_*)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

console.log(firebaseConfig)

// Basic validation to help during setup
function getMissingFirebaseEnvKeys(cfg: Record<string, unknown>) {
  return Object.entries(cfg)
    .filter(([, v]) => !v)
    .map(([k]) => k);
}

const missing = getMissingFirebaseEnvKeys(firebaseConfig as unknown as Record<string, unknown>);
if (missing.length && process.env.NODE_ENV !== "production") {
  console.warn(
    `Firebase env vars missing: ${missing.join(", ")}.\n` +
      "Ensure they are defined in .env.local (NEXT_PUBLIC_FIREBASE_*) or your hosting provider's environment settings."
  );
}

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig as any);
} else {
  app = getApp();
}

const auth: Auth = getAuth(app);

export { app, auth };
export function firebaseConfigOk() { return missing.length === 0; }
export function missingFirebaseKeys() { return missing; }
