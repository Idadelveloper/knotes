import type { Metadata } from "next";
import "./globals.css";
import NavBar from "../components/NavBar";

export const metadata: Metadata = {
  title: "Knotes — Focused AI study space",
  description:
    "Knotes helps students study smarter with focused reading, AI explanations, adaptive music, songs, and TTS — all in one tab.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark:[color-scheme:dark] [color-scheme:light]">
      <body className="antialiased font-sans text-slate-900 bg-accent dark:bg-[--color-dark-bg] dark:text-[--color-accent] min-h-screen relative">
        {/* Decorative calm gradient background */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
        >
          <div
            className="absolute -inset-32 opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(40% 40% at 20% 20%, rgba(139,198,236,0.45) 0%, rgba(139,198,236,0.05) 100%), radial-gradient(35% 35% at 80% 30%, rgba(179,255,171,0.45) 0%, rgba(179,255,171,0.05) 100%)",
              animation: "subtleShift 16s ease-in-out infinite",
            }}
          />
        </div>
        <NavBar isAuthenticated={false} />
        {children}
      </body>
    </html>
  );
}
