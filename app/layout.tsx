import type { Metadata } from "next";
import "./globals.css";
import "@uiw/react-markdown-preview/markdown.css";
import "@uiw/react-md-editor/markdown-editor.css";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import NavBar from "../components/NavBar";
import Footer from "../components/Footer";
import PWA from "../components/PWA";
import AuthProvider from "@/components/AuthProvider";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  title: "Knotes — Focused AI study space",
  description:
    "Knotes helps students study smarter with focused reading, AI explanations, adaptive music, songs, and TTS — all in one tab.",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="[color-scheme:light]">
      <body className="antialiased font-sans text-slate-900 bg-white min-h-screen">
        <AuthProvider>
          <PWA />
          <NavBar isAuthenticated={false} />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
