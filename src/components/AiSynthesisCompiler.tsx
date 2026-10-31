import React, { useState } from 'react';
import { MoleculeType, ReactionRule, PresetSystem } from '../types/chemistry';
import { ChemEngine } from '../engine/chemEngine';
import {
  Wand2,
  Sparkles,
  Zap,
  Flame,
  Plus,
  Play,
  ArrowRight,
  Code2,
  Check,
  Cpu,
  Layers,
  FlaskConical,
  BookOpen
} from 'lucide-react';
import { globalAudioSynth } from '../engine/audioSynth';

interface AiSynthesisCompilerProps {
  engine: ChemEngine;
  onApplyCustomSystem: (system: PresetSystem) => void;
}

interface SynthesisTemplate {
  name: string;
  tagline: string;
  description: string;
  molecules: MoleculeType[];
  rules: ReactionRule[];
  initialCounts: Record<string, number>;
  temp: number;
}

const TEMPLATES: SynthesisTemplate[] = [
  {
    name: 'Photochemical Solar Battery',
    tagline: 'Light-Harvesting Energy Storage',
    description: 'Ground-state chromophores absorb energy packets into high-energy excited states, which react with catalysts to store potential chemical energy.',
    temp: 310,
    molecules: [
      { id: 'm_chr', symbol: 'Chr', name: 'Chromophore (Ground)', color: '#06b6d4', radius: 7, mass: 1.0, energyState: 10, category: 'substrate', description: 'Ground state light-absorbing molecule' },
      { id: 'm_chrex', symbol: 'Chr*', name: 'Excited Chromophore', color: '#38bdf8', radius: 8, mass: 1.0, energyState: 60, category: 'catalyst', description: 'High-energy photo-excited state' },
      { id: 'm_acc', symbol: 'Acc', name: 'Electron Acceptor', color: '#a855f7', radius: 6, mass: 0.8, energyState: 20, category: 'substrate', description: 'Electron acceptor redox mediator' },
      { id: 'm_fuel', symbol: 'Fuel', name: 'High-Density Solar Fuel', color: '#10b981', radius: 9, mass: 1.8, energyState: 90, category: 'product', description: 'Energy storage chemical fuel' }
    ],
    rules: [
      {
        id: 'r_excite',
        name: 'Photo-Excitation',
        reactants: [{ moleculeId: 'm_chr', count: 2 }],
        products: [{ moleculeId: 'm_chr', count: 1 }, { moleculeId: 'm_chrex', count: 1 }],
        catalysts: [],
        activationEnergy: 10,
        energyDelta: 30,
        rateConstant: 0.8,
        description: 'Absorption of energy flips molecule to excited state',
        enabled: true
      },
      {
        id: 'r_store',
        name: 'Charge Transfer Fuel Synthesis',
        reactants: [{ moleculeId: 'm_chrex', count: 1 }, { moleculeId: 'm_acc', count: 1 }],
        products: [{ moleculeId: 'm_chr', count: 1 }, { moleculeId: 'm_fuel', count: 1 }],
        catalysts: [],
        activationEnergy: 15,
        energyDelta: -20,
        rateConstant: 0.7,
        description: 'Exothermic reduction stores energy in fuel',
        enabled: true
      }
    ],
    initialCounts: { m_chr: 40, m_acc: 30, m_chrex: 5 }
  },
  {
    name: 'Prion Protein Misfolding Cascade',
    tagline: 'Template-Directed Pathological Conversion',
    description: 'A healthy cellular protein PrP-C undergoes irreversible conformational change when colliding with an infectious beta-sheet rich PrP-Sc aggregate.',
    temp: 310,
    molecules: [
      { id: 'm_prpc', symbol: 'PrPᶜ', name: 'Normal Cellular Prion', color: '#10b981', radius: 7, mass: 1.2, energyState: 40, category: 'substrate', description: 'Alpha-helical physiological prion protein' },
      { id: 'm_prpsc', symbol: 'PrPˢᶜ', name: 'Infectious Scrapie Prion', color: '#f43f5e', radius: 8, mass: 1.4, energyState: 15, category: 'catalyst', description: 'Beta-sheet aggregated pathological isomer' },
      { id: 'm_agg', symbol: 'Amyloid', name: 'Amyloid Fibril Plaque', color: '#9333ea', radius: 11, mass: 3.0, energyState: 5, category: 'polymer', description: 'Insoluble neurotoxic amyloid precipitate' }
    ],
    rules: [
      {
        id: 'r_convert',
        name: 'Template-Induced Misfolding',
        reactants: [{ moleculeId: 'm_prpc', count: 1 }, { moleculeId: 'm_prpsc', count: 1 }],
        products: [{ moleculeId: 'm_prpsc', count: 2 }],
        catalysts: [],
        activationEnergy: 8,
        energyDelta: -25,
        rateConstant: 0.85,
        description: 'Auto-catalytic conformational conversion',
        enabled: true
      },
      {
        id: 'r_fibril',
        name: 'Fibrillization Nucleation',
        reactants: [{ moleculeId: 'm_prpsc', count: 2 }],
        products: [{ moleculeId: 'm_agg', count: 1 }],
        catalysts: [],
        activationEnergy: 20,
        energyDelta: -40,
        rateConstant: 0.4,
        description: 'High-order oligomerization into plaque',
        enabled: true
      }
    ],
    initialCounts: { m_prpc: 60, m_prpsc: 2 }
  },
  {
    name: 'Quantum Logic Gate Inverter',
    tagline: 'Chemical Computing Boolean NOT/AND',
    description: 'Binary state carrier particles (Q0, Q1) execute conditional state flips upon entering contact with a Control Gate (GATE) molecule.',
    temp: 290,
    molecules: [
      { id: 'm_q0', symbol: '|0⟩', name: 'Qubit State Zero', color: '#3b82f6', radius: 6, mass: 1.0, energyState: 0, category: 'substrate', description: 'Ground logical state' },
      { id: 'm_q1', symbol: '|1⟩', name: 'Qubit State One', color: '#ec4899', radius: 6, mass: 1.0, energyState: 50, category: 'product', description: 'Excited logical state' },
      { id: 'm_gate', symbol: 'NOT', name: 'Inverter Logic Gate', color: '#eab308', radius: 8, mass: 2.0, energyState: 25, category: 'catalyst', description: 'Catalytic Pauli-X bit flip operator' },
      { id: 'm_out', symbol: 'CLK', name: 'Clock Sync Pulse', color: '#06b6d4', radius: 5, mass: 0.5, energyState: 10, category: 'system_call', description: 'Synchronous clock signal' }
    ],
    rules: [
      {
        id: 'r_flip0',
        name: 'NOT Gate Flip: |0> -> |1>',
        reactants: [{ moleculeId: 'm_q0', count: 1 }, { moleculeId: 'm_gate', count: 1 }],
        products: [{ moleculeId: 'm_q1', count: 1 }, { moleculeId: 'm_gate', count: 1 }],
        catalysts: [],
        activationEnergy: 5,
        energyDelta: 10,
        rateConstant: 0.9,
        description: 'Bit flip 0 to 1 catalyzed by gate',
        enabled: true
      },
      {
        id: 'r_flip1',
        name: 'NOT Gate Flip: |1> -> |0>',
        reactants: [{ moleculeId: 'm_q1', count: 1 }, { moleculeId: 'm_gate', count: 1 }],
        products: [{ moleculeId: 'm_q0', count: 1 }, { moleculeId: 'm_gate', count: 1 }],
        catalysts: [],
        activationEnergy: 5,
        energyDelta: -10,
        rateConstant: 0.9,
        description: 'Bit flip 1 to 0 catalyzed by gate',
        enabled: true
      }
    ],
    initialCounts: { m_q0: 35, m_q1: 5, m_gate: 6, m_out: 15 }
  }
];

export const AiSynthesisCompiler: React.FC<AiSynthesisCompilerProps> = ({
  engine,
  onApplyCustomSystem
}) => {
  const [promptInput, setPromptInput] = useState<string>('');
  const [grammarInput, setGrammarInput] = useState<string>(
    'SPECIES A [color=#06b6d4, mass=1.0]\nSPECIES B [color=#ec4899, mass=1.2]\nSPECIES C [color=#10b981, mass=2.0]\n\nRULE Synthesis: A + B -> C [Ea=12, dE=-25, k=0.85]\nRULE Dissociation: C + A -> 2A + B [Ea=28, dE=15, k=0.6]'
  );
  const [compileStatus, setCompileStatus] = useState<{ success: boolean; msg: string } | null>(null);

  // Compile manual grammar text into PresetSystem
  const handleCompileGrammar = () => {
    try {
      const lines = grammarInput.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
      const speciesList: MoleculeType[] = [];
      const rulesList: ReactionRule[] = [];
      const initialCounts: Record<string, number> = {};

      for (const line of lines) {
        if (line.startsWith('SPECIES')) {
          // Format: SPECIES Name [key=val, ...]
          const match = line.match(/^SPECIES\s+([A-Za-z0-9_]+)(?:\s+\[(.*)\])?$/);
          if (match) {
            const sym = match[1];
            const metaStr = match[2] || '';
            const meta: Record<string, string> = {};
            metaStr.split(',').forEach(kv => {
              const [k, v] = kv.split('=').map(s => s?.trim());
              if (k && v) meta[k] = v;
            });

            const id = `m_${sym.toLowerCase()}`;
            speciesList.push({
              id,
              symbol: sym,
              name: meta.name || `${sym} Molecule`,
              color: meta.color || `hsl(${Math.floor(Math.random() * 360)}, 85%, 60%)`,
              radius: meta.radius ? Number(meta.radius) : 7,
              mass: meta.mass ? Number(meta.mass) : 1.0,
              energyState: meta.energy ? Number(meta.energy) : 20,
              category: 'substrate',
              description: `Custom synthesized ${sym} molecule`
            });
            initialCounts[id] = 25;
          }
        } else if (line.startsWith('RULE')) {
          // Format: RULE Name: R1 + R2 -> P1 + P2 [key=val, ...]
          const match = line.match(/^RULE\s+([^:]+):\s+(.+?)\s*->\s*(.+?)(?:\s+\[(.*)\])?$/);
          if (match) {
            const ruleName = match[1].trim();
            const rRaw = match[2].trim().split('+').map(s => s.trim());
            const pRaw = match[3].trim().split('+').map(s => s.trim());
            const metaStr = match[4] || '';

            const meta: Record<string, string> = {};
            metaStr.split(',').forEach(kv => {
              const [k, v] = kv.split('=').map(s => s?.trim());
              if (k && v) meta[k] = v;
            });

            // Expand coefficients (e.g. 2A -> { moleculeId: 'm_a', count: 2 })
            const parseComponents = (arr: string[]) => {
              const resMap: Record<string, number> = {};
              arr.forEach(item => {
                const countMatch = item.match(/^(\d+)?\s*([A-Za-z0-9_]+)$/);
                if (countMatch) {
                  const count = countMatch[1] ? parseInt(countMatch[1]) : 1;
                  const sym = countMatch[2];
                  const id = `m_${sym.toLowerCase()}`;
                  resMap[id] = (resMap[id] || 0) + count;
                }
              });
              return Object.entries(resMap).map(([mId, count]) => ({ moleculeId: mId, count }));
            };

            const reactants = parseComponents(rRaw);
            const products = parseComponents(pRaw);

            rulesList.push({
              id: `r_${rulesList.length + 1}`,
              name: ruleName,
              reactants,
              products,
              catalysts: [],
              activationEnergy: meta.Ea ? Number(meta.Ea) : 10,
              energyDelta: meta.dE ? Number(meta.dE) : -15,
              rateConstant: meta.k ? Number(meta.k) : 0.75,
              description: `Rewrite rule: ${ruleName}`,
              enabled: true
            });
          }
        }
      }

      if (speciesList.length === 0) {
        throw new Error('No valid SPECIES declarations found. Declare with `SPECIES A [color=#...]`.');
      }

      const newSystem: PresetSystem = {
        id: `SYS_${Date.now()}`,
        name: 'Compiled Synthetic Grammar',
        category: 'Custom User Experiments',
        description: 'Dynamically compiled artificial chemistry rule system.',
        moleculeTypes: speciesList,
        reactionRules: rulesList,
        initialCounts,
        initialEnergy: 600,
        defaultTemp: 300,
        defaultStirSpeed: 3
      };

      onApplyCustomSystem(newSystem);
      setCompileStatus({ success: true, msg: `Successfully compiled ${speciesList.length} species and ${rulesList.length} reaction rewrite rules!` });
      globalAudioSynth.playEnergyZap();
    } catch (err: unknown) {
      setCompileStatus({ success: false, msg: (err as Error).message || 'Compilation error' });
    }
  };

  const handleApplyTemplate = (tmpl: SynthesisTemplate) => {
    const newSystem: PresetSystem = {
      id: `TMPL_${Date.now()}`,
      name: tmpl.name,
      category: 'Fringe Artificial Chemistry',
      description: tmpl.description,
      moleculeTypes: tmpl.molecules,
      reactionRules: tmpl.rules,
      initialCounts: tmpl.initialCounts,
      initialEnergy: 550,
      defaultTemp: tmpl.temp,
      defaultStirSpeed: 4
    };
    onApplyCustomSystem(newSystem);
    setCompileStatus({ success: true, msg: `Loaded synthesis template: ${tmpl.name}` });
  };

  return (
    <div id="ai-synthesis-compiler-view" className="flex flex-col gap-3 p-3 bg-zinc-950/60 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 font-mono">
            AI Molecular Synthesis & Rule Grammar Compiler
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
            Chemical DSL & Natural Language Synthesis
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span>Target Engine: <b className="text-emerald-400">Live Reactor Chamber</b></span>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left: Domain Specific Grammar Editor */}
        <div className="lg:col-span-7 flex flex-col gap-2.5 bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between font-mono text-xs text-zinc-300">
            <span className="font-bold flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Declarative Chemical DSL Editor</span>
            </span>
            <span className="text-[10px] text-zinc-500">
              Grammar format: SPECIES ... / RULE ...
            </span>
          </div>

          <textarea
            rows={10}
            value={grammarInput}
            onChange={e => setGrammarInput(e.target.value)}
            className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200 focus:border-purple-500 focus:outline-none leading-relaxed"
            placeholder="Define SPECIES and RULE statements..."
          />

          {compileStatus && (
            <div
              className={`p-2.5 rounded-lg border font-mono text-xs flex items-center gap-2 ${
                compileStatus.success
                  ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500 text-rose-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{compileStatus.msg}</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleCompileGrammar}
              className="flex-1 py-2.5 rounded-lg bg-purple-500 text-zinc-950 font-bold hover:bg-purple-400 transition-colors flex items-center justify-center gap-1.5 font-mono text-xs shadow-[0_0_12px_rgba(168,85,247,0.3)]"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Compile & Instantiate into Vessel</span>
            </button>
          </div>
        </div>

        {/* Right: Synthesis Templates & Inspiration */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exotic Synthesis Archetypes</span>
            </h4>

            <div className="flex flex-col gap-2">
              {TEMPLATES.map(tmpl => (
                <div
                  key={tmpl.name}
                  className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 hover:border-purple-500/50 transition-all flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-zinc-200">{tmpl.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      {tmpl.molecules.length} Sp / {tmpl.rules.length} Rules
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-snug">
                    {tmpl.description}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-zinc-500">{tmpl.tagline}</span>
                    <button
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 text-[11px] font-mono font-semibold transition-colors flex items-center gap-1"
                    >
                      <span>Load Archetype</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
