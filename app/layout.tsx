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
      <body className="antialiased font-sans text-slate-900 bg-accent dark:bg-[--color-dark-bg] dark:text-[--color-accent] min-h-screen">
        <NavBar isAuthenticated={false} />
        {children}
      </body>
    </html>
  );
}
