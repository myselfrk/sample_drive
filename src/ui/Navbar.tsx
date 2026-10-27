import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight">
      <span className="relative flex h-3.5 w-3.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 opacity-60 animate-ping" />
        <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-gradient-to-br from-indigo-400 via-cyan-400 to-purple-400" />
      </span>
      <span>Signal<span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">Drive</span></span>
    </Link>
  );
}

export function Navbar({ minimal = false }: { minimal?: boolean }) {
  return (
    <nav className="fixed w-full z-50 border-b border-white/5 bg-[#050510]/60 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        <Wordmark />
        {!minimal && (
          <div className="flex items-center gap-4 sm:gap-8">
            <a href="/#how" className="hidden md:block text-sm text-slate-400 hover:text-white transition-colors">How it works</a>
            <Link to="/drive" className="group px-5 sm:px-6 py-2 bg-indigo-600 rounded-full text-sm font-semibold hover:bg-indigo-500 transition-all">
              Start Driving <ArrowRight className="inline w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
