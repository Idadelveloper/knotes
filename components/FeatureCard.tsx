"use client";
import { ReactNode } from "react";

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative flex flex-col items-center rounded-3xl bg-white/70 dark:bg-white/5 backdrop-blur-sm p-6 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/5 dark:ring-white/10">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary ring-1 ring-primary/30">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-[--color-accent]">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
      {/* Soft glow on hover */}
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
        background:
          "radial-gradient(40% 40% at 50% 0%, rgba(139,198,236,0.25) 0%, rgba(139,198,236,0) 100%)",
      }} />
    </div>
  );
}
