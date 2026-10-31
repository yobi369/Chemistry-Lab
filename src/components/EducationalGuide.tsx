import React from 'react';
import {
  BookOpen,
  Code2,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Globe,
  Compass,
  ArrowRight,
  Flame,
  Binary
} from 'lucide-react';

export const EducationalGuide: React.FC = () => {
  return (
    <div id="educational-guide-view" className="flex flex-col gap-4 p-3 bg-zinc-950/60 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              01 FRINGE CODING
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
              BEYOND CODE. BEYOND LIMITS.
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight">
            ARTIFICIAL CHEMISTRY ENGINES
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Simulate digital molecules that react, combine, reproduce, and compete. Study emergence, evolution, computational system calls, and self-organization.
          </p>
        </div>

        <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          By Tuchii Hunnid
        </div>
      </div>

      {/* 5 Core Concepts Grid */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
          <Layers className="w-4 h-4" />
          <span>Core Concepts (The 5 Pillars)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Pillar 1 */}
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-2 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold">
              <Binary className="w-4 h-4" />
              <span>1. Molecules = Data Structures</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Digital molecules are discrete state objects (tuples of mass, valence, charge, energy state, and program bytecode / syscall opcodes) undergoing dynamic transformations.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-2 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold">
              <Code2 className="w-4 h-4" />
              <span>2. Reactions = Rewrite Rules</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Rules specify syntactic substitutions: when reactant structures collide with kinetic energy $\ge E_a$, the engine rewrites them into product structures ($A + B \rightarrow C$).
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-2 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold">
              <Zap className="w-4 h-4" />
              <span>3. Energy = Computational Resources</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Thermodynamic energy and CPU cycles act as the currency of the system. Exothermic reactions liberate energy packets, fueling endothermic synthesis and mutations.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-2 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center gap-2 text-purple-400 font-mono text-xs font-bold">
              <Globe className="w-4 h-4" />
              <span>4. Environments = Reaction Spaces</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Whether a 2D continuous physics vessel, a well-stirred Gillespie reactor, or a discrete spatial lattice, the reaction space dictates diffusion, mixing, and localized crowding.
            </p>
          </div>

          {/* Pillar 5 */}
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-2 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>5. Evolution = Selection & Replication</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Autocatalytic hypercycles and self-replicating programs compete for finite raw substrates, demonstrating the spontaneous emergence of Darwinian natural selection.
            </p>
          </div>

          {/* System Call VM */}
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-2 hover:border-blue-500/40 transition-colors">
            <div className="flex items-center gap-2 text-blue-400 font-mono text-xs font-bold">
              <Cpu className="w-4 h-4" />
              <span>Computational Syscall Kernel</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Operating system system calls (<code className="text-blue-300 font-mono">SYS_ALLOC</code>, <code className="text-blue-300 font-mono">SYS_FORK</code>, <code className="text-blue-300 font-mono">SYS_EXEC</code>) executed natively via molecular interactions.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works & Canonical Example */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Step-by-step workflow */}
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            <span>How It Works (5-Step Execution)</span>
          </h3>

          <ol className="flex flex-col gap-2 text-xs font-mono text-zinc-300 list-decimal list-inside leading-relaxed">
            <li><b className="text-zinc-100">Define molecule types & properties</b> (Mass, energy state, color, category, valence).</li>
            <li><b className="text-zinc-100">Create reaction rewrite rules</b> (<code className="text-emerald-400">if-match → transform</code> pattern matching).</li>
            <li><b className="text-zinc-100">Set energy / cost for reactions</b> (Activation energy barrier $E_a$ and $\Delta E$).</li>
            <li><b className="text-zinc-100">Seed the environment</b> (Inject initial concentrations into reaction space).</li>
            <li><b className="text-zinc-100">Run, observe, evolve</b> (Watch self-organization and phase-space limit cycles).</li>
          </ol>
        </div>

        {/* Canonical Example from Infographic */}
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            <span>Canonical Example: A + B → C + ⚡</span>
          </h3>

          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center gap-3 text-xs font-mono font-bold">
            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">A</span>
            <span className="text-zinc-500">+</span>
            <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">B</span>
            <ArrowRight className="w-4 h-4 text-emerald-400" />
            <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">C</span>
            <span className="text-zinc-500">+</span>
            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">⚡ ENERGY</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Monomer A and monomer B undergo exothermic fusion into stable complex C, liberating an energy quantum (⚡) that can overcome the activation barrier of higher-order polymer synthesis ($2C + ⚡ \rightarrow \Omega$).
          </p>
        </div>
      </div>

      {/* Possible Applications & Tech Stack */}
      <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 font-mono flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          <span>Possible Real-World Applications</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-300 text-center">
            🌌 Origin of Life Simulations
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-300 text-center">
            🧪 Material Discovery
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-300 text-center">
            ⚗️ Chemical Optimization
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-300 text-center">
            🕸️ Complex Systems Research
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-300 text-center">
            🎮 Game AI & Living Worlds
          </div>
        </div>
      </div>
    </div>
  );
};
