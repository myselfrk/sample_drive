import { ArrowRight, AreaChart, Target, TrendingUp, Zap } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DriveSim } from "../sim/DriveSim.ts";
import { Background } from "../ui/Background.tsx";
import { Badge, GlassCard } from "../ui/Glass.tsx";
import { LiveGraph } from "../ui/LiveGraph.tsx";
import { Navbar } from "../ui/Navbar.tsx";

const HeroCanvas = lazy(() => import("../scene/HeroCanvas.tsx"));

export default function Landing() {
  const sim = useMemo(() => new DriveSim(1), []);
  const heroRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(true);
  useEffect(() => { // stop rendering the 3D hero once it has scrolled out of view
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.05 });
    if (heroRef.current) io.observe(heroRef.current);
    return () => io.disconnect();
  }, []);
  const source = useMemo(() => () => ({ samples: sim.samples, t: sim.t, events: sim.events }), [sim]);

  return (
    <div className="min-h-screen bg-[#050510] text-white selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
      <Background />
      <Navbar />

      <main className="relative z-10">
        {/* Hero: the accelerating car is the page */}
        <section ref={heroRef} className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden">
          <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_80%,transparent)]">
            <div className="absolute inset-0 opacity-45 md:opacity-100 md:[mask-image:linear-gradient(to_right,transparent_5%,black_48%)]">
              <Suspense fallback={null}><HeroCanvas sim={sim} active={active} /></Suspense>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#050510] via-transparent to-[#050510]/40 md:hidden" />
          </div>

          <div className="relative max-w-7xl mx-auto w-full px-5 sm:px-6 pt-28 pb-8 md:pb-28">
            <div className="max-w-2xl">
              <div className="mb-8"><Badge>Physics in motion</Badge></div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] mb-7">
                <span className="block mb-2">Every drive draws a graph.</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400">Can you read yours?</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-300/90 max-w-xl mb-10">
                Hit the gas — well, the car does. You control the brake. Beat the signals, then decode the speed–time graph your drive leaves behind.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/drive" className="px-8 py-5 bg-white text-black rounded-xl font-bold hover:scale-105 transition-all flex items-center justify-center gap-3">
                  <Zap className="w-5 h-5" /> Start Driving
                </Link>
                <a href="#how" className="px-8 py-5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all">
                  How it works <ArrowRight className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          {/* the hero car's live v–t line, in sync with the loop */}
          <div className="relative z-10 mx-5 mb-10 md:m-0 md:absolute md:bottom-8 md:right-8 w-[min(calc(100vw-2.5rem),21rem)]">
            <GlassCard className="p-3 rounded-2xl !bg-[#050510]/70">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                <span>This car · live</span><span className="font-mono normal-case">a = +2 m/s²</span>
              </div>
              <div className="h-32 sm:h-40"><LiveGraph getSource={source} windowSec={26} /></div>
            </GlassCard>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="max-w-7xl mx-auto px-5 sm:px-6 py-24 sm:py-32">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                A drive is just physics.
                <span className="block text-indigo-400">The graph shows all of it.</span>
              </h2>
              <p className="text-lg text-slate-400 mb-6">The car speeds up by itself at a steady rate. At every signal you decide when to brake. Each choice leaves a mark on the graph.</p>
              <p className="text-lg text-slate-400 mb-8">Then the questions begin — and they’re about <em>your</em> drive, not a textbook’s.</p>
              <div className="flex items-center gap-3 text-indigo-300"><Zap className="w-5 h-5" />No guessing. Only the graph you drew.</div>
            </div>
            <GlassCard className="p-8 sm:p-10">
              <Step title="1. Accelerate" desc="The car does it for you: steady, +2 m/s² up to its top speed." />
              <Step title="2. Brake" desc="Hold Space (or the button) when a signal turns amber or red." />
              <Step title="3. Watch the graph" desc="Speed against time, drawn live as you drive." />
              <Step title="4. Analyze" desc="Answer ten questions built from your own numbers." last />
            </GlassCard>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-24">
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            <Card icon={<TrendingUp className="w-8 h-8 text-cyan-400" />} title="Slope = acceleration" desc="Steeper line, bigger change in speed every second. Flat means cruising." />
            <Card icon={<AreaChart className="w-8 h-8 text-purple-400" />} title="Area = distance" desc="The space under your line is how far you travelled. Shade it, measure it." />
            <Card icon={<Target className="w-8 h-8 text-emerald-400" />} title="Your data, your questions" desc="Every round asks about the stretches you actually drove." />
          </div>
          <div className="mt-16 text-center">
            <Link to="/drive" className="inline-flex px-8 py-5 bg-white text-black rounded-xl font-bold hover:scale-105 transition-all items-center gap-3"><Zap className="w-5 h-5" />Start Driving</Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-10 text-center text-slate-500 px-4">
        © {new Date().getFullYear()} SignalDrive — every drive draws a graph.
      </footer>
    </div>
  );
}

function Step({ title, desc, last }: { title: string; desc: string; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-7"}>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="text-slate-400">{desc}</p>
    </div>
  );
}

function Card({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <GlassCard hover className="p-8">
      <div className="mb-6">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-400">{desc}</p>
    </GlassCard>
  );
}
