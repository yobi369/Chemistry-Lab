import React, { useState } from 'react';
import { ChemEngine } from '../engine/chemEngine';
import { MoleculeType, ReactionEvent } from '../types/chemistry';
import {
  Terminal,
  Cpu,
  Layers,
  Flame,
  Play,
  RotateCcw,
  Zap,
  Activity,
  Code2,
  HardDrive
} from 'lucide-react';

interface SystemCallInspectorProps {
  engine: ChemEngine;
  moleculeTypes: MoleculeType[];
  logs: ReactionEvent[];
  onDispatchSyscall: (syscallName: string) => void;
}

export const SystemCallInspector: React.FC<SystemCallInspectorProps> = ({
  engine,
  moleculeTypes,
  logs,
  onDispatchSyscall
}) => {
  const [filterSyscall, setFilterSyscall] = useState<string>('ALL');

  // Count syscalls by type
  const syscallCounts: Record<string, number> = {};
  logs.forEach(l => {
    const sc = l.syscall || 'SYS_GENERIC';
    syscallCounts[sc] = (syscallCounts[sc] || 0) + 1;
  });

  const filteredLogs = filterSyscall === 'ALL'
    ? logs
    : logs.filter(l => l.syscall === filterSyscall);

  // Generate simulated VM memory blocks based on current particles
  const totalParticles = engine.particles.length;
  const memoryCells = Array.from({ length: 64 }, (_, idx) => {
    const particle = engine.particles[idx % Math.max(1, totalParticles)];
    return {
      address: `0x${(idx * 4).toString(16).padStart(4, '0').toUpperCase()}`,
      occupied: !!particle && idx < totalParticles,
      type: particle?.symbol || '0x00',
      color: particle?.color || '#27272a',
      energy: particle?.energy || 0
    };
  });

  return (
    <div id="syscall-inspector-view" className="flex flex-col gap-3 p-3 bg-zinc-950/60">
      {/* Top Banner: Virtual Machine Overview & Syscall Dispatchers */}
      <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-2">
                <span>Computational Molecular VM & Syscall Kernel</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ACTIVE KERNEL
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">
                System calls executed automatically upon molecular rewrite rule satisfaction.
              </p>
            </div>
          </div>

          {/* Quick Syscall Dispatcher Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="text-zinc-400 mr-1 hidden sm:inline">Manual Syscall:</span>
            <button
              onClick={() => onDispatchSyscall('SYS_EXEC')}
              className="px-2.5 py-1 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition-colors flex items-center gap-1"
            >
              <Cpu className="w-3 h-3" />
              <span>SYS_EXEC</span>
            </button>
            <button
              onClick={() => onDispatchSyscall('SYS_FORK')}
              className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              <span>SYS_FORK</span>
            </button>
            <button
              onClick={() => onDispatchSyscall('SYS_MUTATE')}
              className="px-2.5 py-1 rounded bg-pink-500/15 text-pink-300 border border-pink-500/30 hover:bg-pink-500/25 transition-colors flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              <span>SYS_MUTATE</span>
            </button>
            <button
              onClick={() => onDispatchSyscall('SYS_RECYCLE')}
              className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>SYS_RECYCLE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Memory Matrix & Streaming Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left 5 Cols: VM Memory Pool Grid */}
        <div className="lg:col-span-5 p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                Molecular Heap Memory Space (64 Words)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              {engine.particles.length} / 64 Blocks Allocated
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1 p-2 bg-zinc-950 rounded-lg border border-zinc-800/80">
            {memoryCells.map((cell, idx) => (
              <div
                key={idx}
                title={`${cell.address}: ${cell.occupied ? cell.type : 'FREE'}`}
                className={`h-8 rounded flex items-center justify-center font-mono text-[10px] font-bold border transition-all cursor-default ${
                  cell.occupied
                    ? 'border-zinc-700 shadow-sm'
                    : 'bg-zinc-900/30 border-zinc-900 text-zinc-700'
                }`}
                style={{
                  backgroundColor: cell.occupied ? `${cell.color}22` : undefined,
                  borderColor: cell.occupied ? `${cell.color}66` : undefined,
                  color: cell.occupied ? '#f4f4f5' : undefined
                }}
              >
                {cell.occupied ? cell.type : '·'}
              </div>
            ))}
          </div>

          {/* Opcode Frequency Metrics */}
          <div className="flex flex-col gap-1.5 text-xs font-mono">
            <div className="text-zinc-400 text-[11px] uppercase tracking-wider">Syscall Dispatch Frequencies:</div>
            <div className="grid grid-cols-2 gap-1.5">
              {['SYS_EXEC', 'SYS_FORK', 'SYS_MUTATE', 'SYS_RECYCLE', 'SYS_FUSE', 'SYS_ALLOC'].map(sc => (
                <div key={sc} className="flex items-center justify-between p-1.5 rounded bg-zinc-950 border border-zinc-800 text-[11px]">
                  <span className="text-zinc-400">{sc}</span>
                  <span className="font-bold text-emerald-400">{syscallCounts[sc] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Real-Time Syscall Terminal Stream */}
        <div className="lg:col-span-7 p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                Syscall Event Stream & Execution Log
              </h3>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 text-xs font-mono">
              <span className="text-zinc-400 text-[11px]">Filter:</span>
              <select
                value={filterSyscall}
                onChange={e => setFilterSyscall(e.target.value)}
                className="bg-zinc-950 text-zinc-200 px-2 py-0.5 rounded border border-zinc-800 text-[11px] focus:outline-none"
              >
                <option value="ALL">ALL SYSCALLS</option>
                <option value="SYS_EXEC">SYS_EXEC</option>
                <option value="SYS_FORK">SYS_FORK</option>
                <option value="SYS_MUTATE">SYS_MUTATE</option>
                <option value="SYS_RECYCLE">SYS_RECYCLE</option>
                <option value="SYS_FUSE">SYS_FUSE</option>
                <option value="SYS_ALLOC">SYS_ALLOC</option>
              </select>
            </div>
          </div>

          {/* Terminal Console Output */}
          <div className="flex-1 min-h-[300px] max-h-[380px] overflow-y-auto bg-zinc-950 rounded-lg border border-zinc-800 p-3 font-mono text-xs flex flex-col gap-1.5">
            {filteredLogs.length === 0 ? (
              <div className="text-zinc-500 text-center py-10">
                [KERNEL]: Awaiting molecular reaction collisions... Run the engine to dispatch system calls.
              </div>
            ) : (
              filteredLogs.map(log => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 p-1.5 rounded hover:bg-zinc-900/60 transition-colors border-b border-zinc-900/60"
                >
                  <span className="text-zinc-500 shrink-0 text-[10px]">
                    t={log.tick.toString().padStart(4, '0')}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                      log.syscall === 'SYS_EXEC'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : log.syscall === 'SYS_FORK'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : log.syscall === 'SYS_MUTATE'
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                        : log.syscall === 'SYS_ALLOC'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {log.syscall || 'SYS_TRANSFORM'}
                  </span>

                  <div className="flex-1 text-[11px] leading-relaxed text-zinc-300">
                    <span className="text-zinc-400">
                      [{log.reactantNames.join(' + ')}]
                    </span>
                    <span className="text-emerald-400 font-bold mx-1">→</span>
                    <span className="text-cyan-300 font-semibold">
                      [{log.productNames.join(' + ')}]
                    </span>
                    <span className="text-zinc-500 text-[10px] ml-2">
                      ({log.energyDelta < 0 ? `${Math.abs(log.energyDelta)}J emitted` : `${log.energyDelta}J absorbed`})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
