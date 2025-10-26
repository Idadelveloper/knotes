"use client";

import Link from "next/link";
import { useState } from "react";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { app } from "@/lib/firebase";
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence, getAuth } from "firebase/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) return setError("Please enter email and password");
    setSubmitting(true);

    // Set persistence, then sign in (promise chain per docs style)
    setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
      .then(() => signInWithEmailAndPassword(auth, email.trim(), password))
      .then((userCredential) => {
        // Signed in
        void userCredential; // not used directly here
        setSuccess("Signed in successfully.");
        setTimeout(() => { window.location.href = "/home"; }, 900);
      })
      .catch((err: any) => {
        console.error(err);
        const code = err?.code as string | undefined;
        if (code === "auth/configuration-not-found") {
          setError(
            "Authentication is not fully configured. Ensure Firebase env vars are set and Email/Password sign-in is enabled in Firebase Console."
          );
        } else if (code === "auth/invalid-email") {
          setError("Please enter a valid email address.");
        } else if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
          setError("Incorrect email or password.");
        } else if (code === "auth/user-not-found") {
          setError("No user found with this email. Try creating an account.");
        } else {
          setError(err?.message || "Failed to sign in. Please try again.");
        }
        setSubmitting(false);
      });
  };

  return (
    <main className="relative w-full min-h-screen">
      {/* Page background (like landing) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 50% at 0% 0%, rgba(139,198,236,0.35) 0%, rgba(139,198,236,0.08) 55%, rgba(139,198,236,0.03) 100%), " +
              "radial-gradient(55% 55% at 100% 100%, rgba(179,255,171,0.35) 0%, rgba(179,255,171,0.08) 55%, rgba(179,255,171,0.02) 100%)",
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-md px-5 pt-24 pb-16">
        <div className="rounded-3xl bg-white/95 backdrop-blur ring-1 ring-black/10 shadow-xl p-6 sm:p-8">
          <header className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-600">Log in to continue your study session</p>
          </header>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-800">Email</label>
              <div className="mt-1 relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><FaEnvelope /></span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-white ring-1 ring-black/10 p-3 pl-9 focus:outline-none focus:ring-2 focus:ring-primary text-slate-900"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-800">Password</label>
              <div className="mt-1 relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><FaLock /></span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-white ring-1 ring-black/10 p-3 pl-9 focus:outline-none focus:ring-2 focus:ring-primary text-slate-900"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <Link href="#" className="text-primary hover:underline">Forgot password?</Link>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-slate-900 font-medium shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:brightness-105 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-700">
            New here? <Link href="/create-account" className="text-primary hover:underline">Create an account</Link>
          </p>
        </div>
      </div>

      {/* Success toast */}
      {success && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="rounded-lg bg-emerald-600 text-white text-sm px-4 py-2 shadow-lg ring-1 ring-black/10">
            {success}
          </div>
        </div>
      )}
    </main>
  );
}
