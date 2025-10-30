"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";
import { useAuth } from "@/components/AuthProvider";

type NavBarProps = {
  isAuthenticated?: boolean;
};

export default function NavBar({ isAuthenticated = false }: NavBarProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const isAuth = Boolean(isAuthenticated || user);

  const NavCenter = () => (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
      <Link href="/study" className="hover:text-slate-900">Study</Link>
      <Link href="/music" className="hover:text-slate-900">Music</Link>
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/knoteslogo.png"
            alt="Knotes logo"
            width={32}
            height={32}
            className="rounded-md"
            priority
          />
          <span className="hidden sm:inline text-base font-semibold text-slate-900">
            Knotes
          </span>
        </Link>

        {/* Center (desktop only when authenticated) */}
        {isAuth ? <NavCenter /> : <div className="hidden md:block" />}

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuth ? (
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                <FaUserCircle className="text-slate-600" />
                <span>Account</span>
              </Link>
            ) : (
              <Link
                title="Login"
                href="/login"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-slate-900 dark:text-[--color-accent] ring-1 ring-black/10 dark:ring-white/10 hover:bg-white/80 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              >
                <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 20a7.966 7.966 0 0 1-5.002-1.756v-.683c0-1.794 1.492-3.25 3.333-3.25h3.334c1.84 0 3.333 1.456 3.333 3.25v.683A7.966 7.966 0 0 1 12 20ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10c0 5.5-4.44 9.963-9.932 10h-.138C6.438 21.962 2 17.5 2 12Zm10-5c-1.84 0-3.333 1.455-3.333 3.25S10.159 13.5 12 13.5c1.84 0 3.333-1.455 3.333-3.25S13.841 7 12 7Z" clipRule="evenodd"/>
                </svg>
                <span>Login</span>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            aria-label="Toggle menu"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-black/10 bg-white/80 text-slate-700"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <HiOutlineX size={20} /> : <HiOutlineMenu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3">
            {isAuth ? (
              <div className="flex flex-col gap-2">
                <Link href="/study" className="py-2 text-slate-800">Study</Link>
                <Link href="/music" className="py-2 text-slate-800">Music</Link>
                <Link
                  href="/settings"
                  className="mt-2 inline-flex w-max items-center gap-2 rounded-lg px-3 py-2 text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  <FaUserCircle className="text-slate-600" />
                  <span>Account</span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-700 font-medium">Welcome</span>
                <Link
                  href="/login"
                  title="Login"
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-slate-900 dark:text-[--color-accent] ring-1 ring-black/10 dark:ring-white/10 hover:bg-white/80 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                >
                  <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 20a7.966 7.966 0 0 1-5.002-1.756v-.683c0-1.794 1.492-3.25 3.333-3.25h3.334c1.84 0 3.333 1.456 3.333 3.25v.683A7.966 7.966 0 0 1 12 20ZM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10c0 5.5-4.44 9.963-9.932 10h-.138C6.438 21.962 2 17.5 2 12Zm10-5c-1.84 0-3.333 1.455-3.333 3.25S10.159 13.5 12 13.5c1.84 0 3.333-1.455 3.333-3.25S13.841 7 12 7Z" clipRule="evenodd"/>
                  </svg>
                  <span>Login</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
