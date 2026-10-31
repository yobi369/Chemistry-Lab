import React, { useState, useEffect, useRef } from 'react';
import { StringChemEngine, StringOrganism, INSTRUCTION_SET, Instruction } from '../engine/stringChemEngine';
import {
  Binary,
  Sparkles,
  RotateCcw,
  Play,
  Pause,
  Plus,
  GitBranch,
  Dna,
  Sliders,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';

export const GeneticStringSoup: React.FC = () => {
  const engineRef = useRef<StringChemEngine | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [population, setPopulation] = useState<StringOrganism[]>([]);
  const [mutationRate, setMutationRate] = useState<number>(0.08);
  const [presetType, setPresetType] = useState<'replicator' | 'hypercycle' | 'random'>('replicator');
  const [selectedOrganism, setSelectedOrganism] = useState<StringOrganism | null>(null);
  const [customInstructions, setCustomInstructions] = useState<Instruction[]>(['DUP', 'SWAP', 'BIND', 'EMIT']);
  const [stats, setStats] = useState({
    totalCollisions: 0,
    totalReplications: 0,
    speciesCount: 0,
    diversity: 0,
    avgLength: 0
  });

  // Initialize engine
  useEffect(() => {
    const engine = new StringChemEngine();
    engineRef.current = engine;
    engine.seedInitialSoup(presetType);
    setPopulation([...engine.population]);
  }, []);

  // Loop
  useEffect(() => {
    let animId: number;

    const loop = () => {
      const engine = engineRef.current;
      if (engine && isRunning) {
        engine.step(4);
        setPopulation([...engine.population]);

        const species = engine.getSpeciesDistribution();
        const latestDiversity = engine.historyDiversity[engine.historyDiversity.length - 1] || 0;
        const latestLength = engine.historyAvgLength[engine.historyAvgLength.length - 1] || 0;

        setStats({
          totalCollisions: engine.totalCollisions,
          totalReplications: engine.totalReplications,
          speciesCount: species.length,
          diversity: latestDiversity,
          avgLength: latestLength
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning]);

  const handleSelectPreset = (type: 'replicator' | 'hypercycle' | 'random') => {
    setPresetType(type);
    if (engineRef.current) {
      engineRef.current.seedInitialSoup(type);
      setPopulation([...engineRef.current.population]);
      setSelectedOrganism(null);
    }
  };

  const handleMutationChange = (rate: number) => {
    setMutationRate(rate);
    if (engineRef.current) {
      engineRef.current.mutationRate = rate;
    }
  };

  const handleInjectCustom = () => {
    if (!engineRef.current || customInstructions.length === 0) return;
    const sig = customInstructions.join('-');
    const newOrg: StringOrganism = {
      id: `CUST_${Date.now().toString().slice(-4)}`,
      code: [...customInstructions],
      generation: 0,
      parentId: null,
      replicationCount: 0,
      fitness: 1.2,
      energy: 70,
      length: customInstructions.length,
      color: `hsl(${Math.floor(Math.random() * 360)}, 85%, 65%)`,
      signature: sig,
      timestamp: Date.now()
    };

    engineRef.current.population.push(newOrg);
    setPopulation([...engineRef.current.population]);
  };

  const speciesList = engineRef.current ? engineRef.current.getSpeciesDistribution() : [];

  return (
    <div id="genetic-soup-view" className="flex flex-col gap-3 p-3 bg-zinc-950/60 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Dna className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
            Genetic String-Rewriting Soup (AlChemy & Tierra-style Program Evolution)
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            Algorithmic Chemistry VM
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-zinc-400">Organisms: <b className="text-emerald-400">{population.length}</b></span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400">Species: <b className="text-cyan-400">{stats.speciesCount}</b></span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-400">Shannon Diversity: <b className="text-purple-300">{stats.diversity} bits</b></span>
        </div>
      </div>

      {/* Preset Selector & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/80 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">Soup Initializer:</span>
          {(['replicator', 'hypercycle', 'random'] as const).map(p => (
            <button
              key={p}
              onClick={() => handleSelectPreset(p)}
              className={`px-2.5 py-1 rounded capitalize border transition-all ${
                presetType === p
                  ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {p === 'replicator' ? 'Self-Replicators' : p === 'hypercycle' ? '3-Species Hypercycle' : 'Random Emergence'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            className={`px-3 py-1 rounded font-bold flex items-center gap-1.5 transition-colors ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
            }`}
          >
            {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isRunning ? 'Pause VM' : 'Run Soup'}</span>
          </button>

          <button
            onClick={() => handleSelectPreset(presetType)}
            className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            title="Reset soup"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Digital Soup Reactor (Molecules Floating & Colliding) */}
        <div className="lg:col-span-5 flex flex-col gap-2.5 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Living Instruction Strings in Well-Stirred Soup</span>
            </span>
            <span className="text-[10px] text-zinc-500">Click string to inspect</span>
          </div>

          {/* Grid of Living Organisms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[460px] overflow-y-auto pr-1">
            {population.map(org => {
              const isSelected = selectedOrganism?.id === org.id;
              return (
                <div
                  key={org.id}
                  onClick={() => setSelectedOrganism(org)}
                  className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-zinc-800/90 border-emerald-400 shadow-md shadow-emerald-950/50 scale-[1.02]'
                      : 'bg-zinc-950/80 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: org.color }} />
                      {org.id.slice(0, 10)}
                    </span>
                    <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-300">
                      Gen {org.generation}
                    </span>
                  </div>

                  {/* Code sequence pills */}
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {org.code.map((op, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-200"
                      >
                        {op}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 pt-0.5">
                    <span>Replications: <b className="text-emerald-400">{org.replicationCount}</b></span>
                    <span>Energy: <b className="text-amber-400">{org.energy}J</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle Column: Genotype Distribution & Lineage */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Dominant Genotypes / Species */}
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dominant Evolved Genotypes</span>
            </h4>

            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {speciesList.map((sp, idx) => {
                const pct = ((sp.count / (population.length || 1)) * 100).toFixed(0);
                return (
                  <div key={sp.signature} className="p-2 rounded bg-zinc-950 border border-zinc-800/80 text-xs flex flex-col gap-1">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: sp.color }} />
                        <span>Rank #{idx + 1}</span>
                      </span>
                      <span className="text-emerald-400 font-bold">{sp.count} units ({pct}%)</span>
                    </div>

                    <div className="font-mono text-[10px] text-zinc-300 bg-zinc-900/80 p-1 rounded border border-zinc-800">
                      <code>{sp.code}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mutation & Evolution Controls */}
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Darwinian Selection Pressures</span>
            </h4>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-400">Point & Indel Mutation Rate:</span>
                <span className="text-purple-300 font-bold">{(mutationRate * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.35"
                step="0.01"
                value={mutationRate}
                onChange={e => handleMutationChange(Number(e.target.value))}
                className="w-full accent-purple-400"
              />
              <span className="text-[10px] text-zinc-500 font-mono">Higher mutation rates drive rapid speciation or error-catastrophe extinction</span>
            </div>
          </div>
        </div>

        {/* Right Column: Code Crafting & Organism Inspector */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Custom String Program Injector */}
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Craft & Inject String Organism</span>
            </h4>

            {/* Instruction Palette */}
            <div className="flex flex-wrap gap-1">
              {INSTRUCTION_SET.map(op => (
                <button
                  key={op}
                  onClick={() => {
                    if (customInstructions.length < 10) {
                      setCustomInstructions([...customInstructions, op]);
                    }
                  }}
                  className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40"
                >
                  +{op}
                </button>
              ))}
            </div>

            {/* Current Custom Sequence */}
            <div className="p-2 rounded bg-zinc-950 border border-zinc-800 flex flex-wrap items-center gap-1 min-h-[34px]">
              {customInstructions.map((op, idx) => (
                <span
                  key={idx}
                  onClick={() => setCustomInstructions(customInstructions.filter((_, i) => i !== idx))}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-pointer hover:bg-rose-500/20 hover:text-rose-300"
                  title="Click to remove"
                >
                  {op} ×
                </span>
              ))}
            </div>

            <button
              onClick={handleInjectCustom}
              className="w-full py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1 font-mono"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Inject into Soup</span>
            </button>
          </div>

          {/* Selected Organism Inspector */}
          {selectedOrganism && (
            <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2 text-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                <span>Organism Inspector</span>
              </h4>

              <div className="font-mono text-[11px] flex flex-col gap-1 text-zinc-300">
                <div>ID: <b className="text-zinc-100">{selectedOrganism.id}</b></div>
                <div>Generation: <b className="text-cyan-300">Gen {selectedOrganism.generation}</b></div>
                <div>Offspring count: <b className="text-emerald-300">{selectedOrganism.replicationCount}</b></div>
                <div>Length: <b className="text-zinc-200">{selectedOrganism.length} instructions</b></div>
                <div className="mt-1">
                  <span className="text-zinc-400 block mb-0.5">Program Code:</span>
                  <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800 text-emerald-300 text-[10px]">
                    {selectedOrganism.code.join(' → ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
