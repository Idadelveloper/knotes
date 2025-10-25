"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FaUserCircle } from "react-icons/fa";
import { HiOutlineMenu, HiOutlineX } from "react-icons/hi";

type NavBarProps = {
  isAuthenticated?: boolean;
};

export default function NavBar({ isAuthenticated = false }: NavBarProps) {
  const [open, setOpen] = useState(false);

  const NavCenter = () => (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700 dark:text-[--color-accent]">
      <Link href="#" className="hover:text-slate-900 dark:hover:text-white">Study</Link>
      <Link href="#" className="hover:text-slate-900 dark:hover:text-white">Music</Link>
      <Link href="#" className="hover:text-slate-900 dark:hover:text-white">History</Link>
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-transparent dark:bg-transparent backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="Knotes logo"
            width={32}
            height={32}
            className="rounded-md"
            priority
          />
          <span className="hidden sm:inline text-base font-semibold text-slate-900 dark:text-[--color-accent]">
            Knotes
          </span>
        </Link>

        {/* Center (desktop only when authenticated) */}
        {isAuthenticated ? <NavCenter /> : <div className="hidden md:block" />}

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="#"
                className="inline-flex items-center gap-2 rounded-xl bg-secondary/70 px-3 py-2 text-slate-900 shadow-[0_3px_0_rgba(0,0,0,0.06)] hover:shadow-[0_4px_0_rgba(0,0,0,0.08)] hover:brightness-105 active:translate-y-px active:shadow-[0_2px_0_rgba(0,0,0,0.1)]"
              >
                <FaUserCircle className="text-slate-700" />
                <span className="font-medium">Profile</span>
              </Link>
            ) : (
              <Link
                href="#"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-slate-900 font-medium shadow-[0_4px_0_rgba(0,0,0,0.08)] transition hover:shadow-[0_6px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px active:shadow-[0_3px_0_rgba(0,0,0,0.1)]"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            aria-label="Toggle menu"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-black/10 dark:ring-white/15 bg-white/70 dark:bg-white/5 text-slate-700 dark:text-[--color-accent]"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <HiOutlineX size={20} /> : <HiOutlineMenu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden border-t border-black/5 dark:border-white/10 bg-accent/90 dark:bg-[--color-dark-bg]/80 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3">
            {isAuthenticated ? (
              <div className="flex flex-col gap-2">
                <Link href="#" className="py-2 text-slate-800 dark:text-[--color-accent]">Study</Link>
                <Link href="#" className="py-2 text-slate-800 dark:text-[--color-accent]">Music</Link>
                <Link href="#" className="py-2 text-slate-800 dark:text-[--color-accent]">History</Link>
                <Link
                  href="#"
                  className="mt-2 inline-flex w-max items-center gap-2 rounded-xl bg-secondary/70 px-3 py-2 text-slate-900 shadow-[0_3px_0_rgba(0,0,0,0.06)]"
                >
                  <FaUserCircle className="text-slate-700" />
                  <span className="font-medium">Profile</span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-700 dark:text-[--color-accent] font-medium">Welcome</span>
                <Link
                  href="#"
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-slate-900 font-medium shadow-[0_4px_0_rgba(0,0,0,0.08)]"
                >
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
