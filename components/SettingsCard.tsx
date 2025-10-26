import { ReactNode } from "react";

export default function SettingsCard({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white shadow-lg rounded-2xl p-6 ring-1 ring-black/5 ${className}`}>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
      <div>{children}</div>
    </section>
  );
}
