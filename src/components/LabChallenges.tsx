import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ChemEngine } from '../engine/chemEngine';
import { MoleculeType, ReactionRule, PresetSystem } from '../types/chemistry';
import {
  Trophy,
  CheckCircle2,
  Circle,
  Play,
  RotateCcw,
  Sparkles,
  Flame,
  Award,
  ArrowRight,
  Zap,
  Target,
  FlaskConical,
  Dna,
  Terminal
} from 'lucide-react';
import { globalAudioSynth } from '../engine/audioSynth';

interface LabChallengesProps {
  engine: ChemEngine;
  moleculeTypes: MoleculeType[];
  onSelectPreset: (preset: PresetSystem) => void;
  onInject: (typeId: string, count: number) => void;
}

export interface Quest {
  id: string;
  title: string;
  category: 'Kinetics' | 'Oscillators' | 'Polymers' | 'Syscalls' | 'Ecology';
  description: string;
  hint: string;
  rewardPoints: number;
  isCompleted: boolean;
  checkCompletion: (engine: ChemEngine) => { completed: boolean; progressPct: number; statusText: string };
}

export const LabChallenges: React.FC<LabChallengesProps> = ({
  engine,
  moleculeTypes,
  onSelectPreset,
  onInject
}) => {
  const [completedQuestIds, setCompletedQuestIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('CHEM_LAB_QUEST_COMPLETED');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [activeQuestId, setActiveQuestId] = useState<string>('quest_catalysis');
  const [questStatuses, setQuestStatuses] = useState<Record<string, { progressPct: number; statusText: string }>>({});

  const quests: Quest[] = [
    {
      id: 'quest_catalysis',
      category: 'Kinetics',
      title: 'Mission 1: Autocatalytic Ignition',
      description: 'Trigger a sustained autocatalytic explosion where total particle count exceeds 90 and reaction flux reaches at least 8.0 rxn/sec.',
      hint: 'Load the Brusselator or Belousov-Zhabotinsky system, heat the chamber to >360K, and stir vigorously.',
      rewardPoints: 100,
      isCompleted: completedQuestIds.has('quest_catalysis'),
      checkCompletion: (eng) => {
        const pCount = eng.particles.length;
        const flux = eng.reactionFluxRate;
        const progress = Math.min(100, Math.round(((pCount / 90) * 50) + ((flux / 8.0) * 50)));
        const completed = pCount >= 90 && flux >= 8.0;
        return {
          completed,
          progressPct: progress,
          statusText: `Particles: ${pCount}/90 • Flux: ${flux.toFixed(1)}/8.0 rxn/s`
        };
      }
    },
    {
      id: 'quest_oscillation',
      category: 'Oscillators',
      title: 'Mission 2: Limit-Cycle Resonance',
      description: 'Maintain a stable chemical oscillation for at least 10 logged time-steps where concentration fluctuations stay periodic without collapsing to equilibrium.',
      hint: 'Use the Lotka-Volterra or Oregonator preset. Keep temperature around 300K and stir speed at 3-5.',
      rewardPoints: 150,
      isCompleted: completedQuestIds.has('quest_oscillation'),
      checkCompletion: (eng) => {
        const hist = eng.history;
        if (hist.length < 8) {
          return { completed: false, progressPct: 20, statusText: `Recording trajectory points: ${hist.length}/8` };
        }
        // Check entropy oscillation variance
        const entropies = hist.slice(-8).map(h => h.entropy);
        const minE = Math.min(...entropies);
        const maxE = Math.max(...entropies);
        const delta = maxE - minE;
        const progress = Math.min(100, Math.round((delta / 0.4) * 100));
        const completed = delta >= 0.25 && eng.particles.length > 30;
        return {
          completed,
          progressPct: progress,
          statusText: `Entropy Variance ΔS: ${delta.toFixed(3)} (Target: >0.25)`
        };
      }
    },
    {
      id: 'quest_polymers',
      category: 'Polymers',
      title: 'Mission 3: Macromolecular Polymerization',
      description: 'Synthesize high-order chained polymers (e.g. Oligomers P2, P3, P4 or Omega Polymer) with at least 25 macro-chain units synthesized in the vessel.',
      hint: 'Switch to the Prebiotic Polymerization preset, supply Monomer (M) and inject Energy (⚡) impulses to overcome the 35J activation barrier.',
      rewardPoints: 200,
      isCompleted: completedQuestIds.has('quest_polymers'),
      checkCompletion: (eng) => {
        // Count all particles with name containing 'Polymer' or symbol 'P'
        const polyCount = eng.particles.filter(p => {
          const m = eng.getMoleculeType(p.typeId);
          return m && (m.name.toLowerCase().includes('poly') || m.symbol.startsWith('P') || m.symbol.includes('Ω'));
        }).length;

        const progress = Math.min(100, Math.round((polyCount / 25) * 100));
        const completed = polyCount >= 25;
        return {
          completed,
          progressPct: progress,
          statusText: `Polymer Yield: ${polyCount}/25 chains in vessel`
        };
      }
    },
    {
      id: 'quest_syscalls',
      category: 'Syscalls',
      title: 'Mission 4: Kernel Syscall Cascade',
      description: 'Trigger computational rewrite reactions that execute at least 2 distinct hardware kernel system calls (e.g. SYS_MALLOC, SYS_FORK, SYS_EXEC) in the reactor.',
      hint: 'Load the System Call Virtual Machine preset. Inject Process Tokens (P_INIT) and Memory Page Request (REQ_MEM) molecules.',
      rewardPoints: 250,
      isCompleted: completedQuestIds.has('quest_syscalls'),
      checkCompletion: (eng) => {
        const syscallLogs = eng.logs.filter(l => l.ruleName.includes('SYS_') || l.ruleName.includes('Kernel'));
        const distinctCalls = new Set(syscallLogs.map(l => l.ruleName));
        const count = distinctCalls.size;
        const progress = Math.min(100, Math.round((count / 2) * 100));
        const completed = count >= 2;
        return {
          completed,
          progressPct: progress,
          statusText: `Executed Syscalls: ${count}/2 unique types`
        };
      }
    },
    {
      id: 'quest_chemostat',
      category: 'Ecology',
      title: 'Mission 5: Chemostat Non-Equilibrium Steady State',
      description: 'Activate the Continuous-Flow Chemostat pump (Inflow > 10 mol/s) with Dilution Outflow > 5% and keep the total population stable between 80 and 220 particles for 15 seconds.',
      hint: 'Toggle the Chemostat pump in the Reaction Vessel tab and balance inflow against washout dilution.',
      rewardPoints: 200,
      isCompleted: completedQuestIds.has('quest_chemostat'),
      checkCompletion: (eng) => {
        const active = eng.chemostatEnabled && eng.inflowRate >= 5 && eng.outflowDilutionRate > 0.02;
        const count = eng.particles.length;
        const inRange = count >= 60 && count <= 250;
        const completed = active && inRange && eng.simTime > 10;
        const progress = active && inRange ? 100 : active ? 60 : 20;
        return {
          completed,
          progressPct: progress,
          statusText: active ? `Pumps Active • Vessel Count: ${count}` : 'Chemostat pumps inactive'
        };
      }
    }
  ];

  // Periodic evaluation of quests against live engine state
  useEffect(() => {
    const interval = setInterval(() => {
      const statuses: Record<string, { progressPct: number; statusText: string }> = {};
      const newCompleted = new Set(completedQuestIds);
      let didCompleteAnyNew = false;

      quests.forEach(q => {
        const res = q.checkCompletion(engine);
        statuses[q.id] = { progressPct: res.progressPct, statusText: res.statusText };

        if (res.completed && !completedQuestIds.has(q.id)) {
          newCompleted.add(q.id);
          didCompleteAnyNew = true;
        }
      });

      setQuestStatuses(statuses);

      if (didCompleteAnyNew) {
        setCompletedQuestIds(newCompleted);
        localStorage.setItem('CHEM_LAB_QUEST_COMPLETED', JSON.stringify(Array.from(newCompleted)));
        globalAudioSynth.playFanfare();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [completedQuestIds, engine]);

  const totalPoints = Array.from(completedQuestIds).reduce<number>((acc, qId) => {
    const q = quests.find(item => item.id === qId);
    return acc + (q ? q.rewardPoints : 0);
  }, 0);

  const activeQuest = quests.find(q => q.id === activeQuestId) || quests[0];

  const handleResetProgress = () => {
    setCompletedQuestIds(new Set());
    localStorage.removeItem('CHEM_LAB_QUEST_COMPLETED');
  };

  return (
    <div id="lab-challenges-view" className="flex flex-col gap-3 p-3 bg-zinc-950/60 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
            Experimental Laboratory Challenges & Missions
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            Scientific Mastery Quests
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-zinc-400">Completed: <b className="text-emerald-400">{completedQuestIds.size} / {quests.length}</b></span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400">Score: <b className="text-amber-300">{totalPoints} pts</b></span>
          <span className="text-zinc-600">•</span>
          <button
            onClick={handleResetProgress}
            className="text-[10px] text-zinc-500 hover:text-rose-400 underline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: Quest List */}
        <div className="lg:col-span-6 flex flex-col gap-2 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
          <div className="text-xs font-mono text-zinc-400 font-bold flex items-center justify-between">
            <span>CHAMBER OBJECTIVES</span>
            <span className="text-[10px] text-zinc-500">Select mission to view criteria</span>
          </div>

          <div className="flex flex-col gap-2">
            {quests.map(q => {
              const isSelected = activeQuestId === q.id;
              const isDone = completedQuestIds.has(q.id);
              const status = questStatuses[q.id] || { progressPct: 0, statusText: 'Evaluating...' };

              return (
                <div
                  key={q.id}
                  onClick={() => setActiveQuestId(q.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-zinc-800/90 border-amber-400/80 shadow-md shadow-amber-950/40'
                      : isDone
                      ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/70'
                      : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-zinc-500" />
                      )}
                      <span className={`font-mono text-xs font-bold ${isDone ? 'text-emerald-300' : 'text-zinc-200'}`}>
                        {q.title}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                      +{q.rewardPoints} XP
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-snug">
                    {q.description}
                  </p>

                  {/* Progress bar */}
                  <div className="flex flex-col gap-1">
                    <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isDone ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, status.progressPct))}%` }}
                      />
                    </div>
                    <div className="flex justify-between font-mono text-[9px] text-zinc-500">
                      <span>{status.statusText}</span>
                      <span>{status.progressPct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Active Mission Briefing & Guidance */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {activeQuest && (
            <div className="p-4 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3.5">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono font-bold text-zinc-200 uppercase">
                    Mission Dossier: {activeQuest.category}
                  </span>
                </div>
                {completedQuestIds.has(activeQuest.id) ? (
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-emerald-500 text-zinc-950 font-bold">
                    COMPLETED ✓
                  </span>
                ) : (
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    IN PROGRESS
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-zinc-100 font-mono mb-1">
                  {activeQuest.title}
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {activeQuest.description}
                </p>
              </div>

              {/* Scientific Briefing */}
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs flex flex-col gap-2">
                <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Experimental Protocol & Hint:</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  {activeQuest.hint}
                </p>
              </div>

              {/* Quick Pipette Injection Assistance */}
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80 font-mono text-xs">
                <span className="text-zinc-400 font-bold">Quick Inoculation Assistance:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {moleculeTypes.slice(0, 6).map(m => (
                    <button
                      key={m.id}
                      onClick={() => onInject(m.id, 20)}
                      className="p-2 rounded bg-zinc-950 border border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-zinc-300 text-left text-[11px] transition-all flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: m.color }} />
                        <span>+{m.symbol}</span>
                      </span>
                      <span className="text-[9px] text-zinc-500">+20</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
