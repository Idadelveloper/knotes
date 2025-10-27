import FeatureCard from "../../components/FeatureCard";
import { FaMusic, FaBookOpen, FaPenNib, FaBrain, FaRobot } from "react-icons/fa6";

export default function Landing() {
  return (
    <main className="relative w-full min-h-screen overflow-hidden">
      {/* Decorative background gradients */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              // Top-left baby blue to lighter diagonal + Bottom-right light green to lighter towards blue
              "radial-gradient(50% 50% at 0% 0%, rgba(139,198,236,0.35) 0%, rgba(139,198,236,0.08) 55%, rgba(139,198,236,0.03) 100%), " +
              "radial-gradient(55% 55% at 100% 100%, rgba(179,255,171,0.35) 0%, rgba(179,255,171,0.08) 55%, rgba(179,255,171,0.02) 100%)",
          }}
        />
        {/* Scattered study/music icons */}
        <div className="absolute inset-0">
          <span className="absolute left-[8%] top-[18%] text-primary/25"><FaMusic size={28} /></span>
          <span className="absolute left-[22%] top-[40%] text-primary/20"><FaBookOpen size={32} /></span>
          <span className="absolute left-[12%] bottom-[22%] text-primary/15"><FaPenNib size={26} /></span>

          <span className="absolute right-[10%] top-[22%] text-primary/20"><FaBookOpen size={30} /></span>
          <span className="absolute right-[20%] top-[38%] text-primary/25"><FaMusic size={34} /></span>
          <span className="absolute right-[14%] bottom-[18%] text-primary/15"><FaPenNib size={28} /></span>

          <span className="absolute left-1/2 top-[12%] -translate-x-1/2 text-primary/15"><FaMusic size={40} /></span>
          <span className="absolute left-1/2 bottom-[12%] -translate-x-1/2 text-primary/15"><FaBookOpen size={36} /></span>
        </div>
      </div>

      {/* Hero Section */}
      <section className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center px-6 pt-20 pb-16 text-center">
    <h1 className="max-w-4xl text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight text-slate-900 dark:text-[--color-accent] text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-blue-600"
        >
          Where knowledge meets notes, in perfect harmony.
        </h1>
        <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-700 dark:text-slate-300">
          A clever fusion of study notes and music notes. Get AI-powered explanations, focus music, and turn your learning into rhythm.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <a
            href="#"
            className="inline-flex items-center justify-center rounded-full bg-primary px-7 py-3 text-slate-900 shadow-[0_6px_0_rgba(0,0,0,0.08)] hover:shadow-[0_8px_0_rgba(0,0,0,0.1)] hover:brightness-105 active:translate-y-px"
          >
            Upload Notes
          </a>
          <a
            href="#"
            className="inline-flex items-center justify-center rounded-full px-7 py-3 text-primary ring-2 ring-primary hover:bg-primary/10 active:translate-y-px"
          >
            Start Studying
          </a>
        </div>
      </section>

      {/* HOW IT WORKS Section */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <h2 className="mb-8 text-center text-xs tracking-[0.35em] text-slate-700 dark:text-slate-300">HOW IT WORKS</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<FaBrain size={24} />}
            title="AI Assistance"
            description="Simply upload your documents, lecture notes, or text books."
          />
          <FeatureCard
            icon={<FaMusic size={24} />}
            title="Focus Music"
            description="Lo-fi, clasical, and ambient tracks to boost concentration."
          />
          <FeatureCard
            icon={<FaRobot size={24} />}
            title="Smart Features"
            description="Voice reader, music generation, and Pomodoro timer"
          />
        </div>
      </section>
    </main>
  );
}
