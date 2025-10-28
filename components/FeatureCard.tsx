"use client";
import { ReactNode } from "react";

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative flex flex-col items-center rounded-3xl bg-white/70 backdrop-blur-sm p-6 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/5 ">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-primary ring-1 ring-primary/30">
       
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 ">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 ">{description}</p>
      {/* Soft glow on hover */}
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{
        background:'color(display-p3 0.86 0.892 0.905 / 0.18)',
        border: '1px color(display-p3 0.156 0.499 0.665 / 0.38) solid'
      }} />
    </div>
  );
}
