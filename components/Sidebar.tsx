"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { FaMusic, FaThLarge, FaCog } from "react-icons/fa";
import { useAuth } from "@/components/AuthProvider";

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/settings" && pathname?.startsWith(href));
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center gap-3 p-2 rounded-lg transition text-sm ${
          active
            ? "bg-blue-100 text-blue-700"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Icon className="text-base" />
        <span className="font-medium">{label}</span>
      </Link>
    </li>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const displayName = user?.displayName || (user?.email ? user.email.split("@")[0] : "Guest");
  const email = user?.email || "Not signed in";

  return (
    <aside className="fixed left-0 top-16 md:top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 p-4 flex flex-col z-30">
      {/* Top: Logo */}
      <div className="flex items-center gap-2 px-1 pb-3">
        <Image src="/images/logo.png" alt="Knotes logo" width={28} height={28} className="rounded-md" />
        <span className="text-2xl font-bold text-slate-900">Knotes</span>
      </div>

      {/* Nav */}
      <nav aria-label="Sidebar navigation" className="mt-1">
        <ul className="space-y-1">
          <NavItem href="/study" label="My Notes" icon={FaThLarge} />
          <NavItem href="/music" label="My Music" icon={FaMusic} />
          <NavItem href="/settings" label="Settings" icon={FaCog} />
        </ul>
      </nav>

      {/* Bottom authUser section */}
      <div className="mt-auto">
        <div className="flex items-center gap-3 p-2">
          <div className="h-10 w-10 rounded-full overflow-hidden ring-1 ring-black/10 bg-white">
            {/* Use logo as placeholder avatar */}
            <Image src="/images/logo.png" alt="Avatar" width={40} height={40} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{displayName}</div>
            <div className="text-xs text-slate-500 truncate">{email}</div>
          </div>
        </div>
        <Link
          href="#"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-blue-500 text-white py-2 font-medium shadow hover:brightness-105"
        >
          Upgrade to Pro
        </Link>
      </div>
    </aside>
  );
}
