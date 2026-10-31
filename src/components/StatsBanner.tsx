import React from 'react';
import { Activity, Flame, Zap, Compass, Cpu, Layers } from 'lucide-react';

interface StatsBannerProps {
  particleCount: number;
  reactionRate: number;
  energyPool: number;
  temperature: number;
  entropy: number;
  totalReactions: number;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
  particleCount,
  reactionRate,
  energyPool,
  temperature,
  entropy,
  totalReactions
}) => {
  return (
    <div id="stats-banner-container" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 p-3 bg-zinc-950/80 border-b border-zinc-800/80 backdrop-blur-md">
      <div id="stat-particles" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
        <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Molecules</div>
          <div className="text-base font-mono font-bold text-zinc-100">{particleCount}</div>
        </div>
      </div>

      <div id="stat-flux" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
        <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Activity className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Flux Rate</div>
          <div className="text-base font-mono font-bold text-cyan-300">{reactionRate} <span className="text-xs text-zinc-400 font-normal">rxn/s</span></div>
        </div>
      </div>

      <div id="stat-energy" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
        <div className="p-2 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Energy Pool</div>
          <div className="text-base font-mono font-bold text-amber-300">{energyPool} <span className="text-xs text-zinc-400 font-normal">kJ</span></div>
        </div>
      </div>

      <div id="stat-temperature" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
        <div className="p-2 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <Flame className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Thermal Bath</div>
          <div className="text-base font-mono font-bold text-rose-300">{temperature} <span className="text-xs text-zinc-400 font-normal">K</span></div>
        </div>
      </div>

      <div id="stat-entropy" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
        <div className="p-2 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Compass className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Entropy S</div>
          <div className="text-base font-mono font-bold text-purple-300">{entropy.toFixed(2)} <span className="text-xs text-zinc-400 font-normal">bits</span></div>
        </div>
      </div>

      <div id="stat-reactions" className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
        <div className="p-2 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Cpu className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Total Rewrites</div>
          <div className="text-base font-mono font-bold text-blue-300">{totalReactions}</div>
        </div>
      </div>
    </div>
  );
};
