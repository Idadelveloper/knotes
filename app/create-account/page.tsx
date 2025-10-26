"use client";

import Link from "next/link";
import { useState } from "react";
import { FaUser, FaEnvelope, FaLock } from "react-icons/fa";

export default function CreateAccountPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirm) return alert("Please fill out all fields");
    if (password !== confirm) return alert("Passwords do not match");
    if (!agree) return alert("Please accept the Terms");
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      // After account creation, route to /home for now
      window.location.href = "/home";
    }, 700);
  };

  return (
    <main className="relative w-full min-h-screen">
      {/* Background like landing */}
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
            <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
            <p className="mt-1 text-sm text-slate-600">Join Knotes to study with rhythm</p>
          </header>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-800">Full name</label>
              <div className="mt-1 relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><FaUser /></span>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-white ring-1 ring-black/10 p-3 pl-9 focus:outline-none focus:ring-2 focus:ring-primary text-slate-900"
                  placeholder="Alex Johnson"
                  required
                />
              </div>
            </div>

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

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-slate-800">Confirm Password</label>
              <div className="mt-1 relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><FaLock /></span>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-xl bg-white ring-1 ring-black/10 p-3 pl-9 focus:outline-none focus:ring-2 focus:ring-primary text-slate-900"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I agree to the <a className="text-primary hover:underline" href="#">Terms</a> and <a className="text-primary hover:underline" href="#">Privacy</a>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-slate-900 font-medium shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:brightness-105 disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create Account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-700">
            Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
