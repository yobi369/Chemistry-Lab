import React, { useState } from 'react';
import { ChemEngine } from '../engine/chemEngine';
import { MoleculeType, ReactionRule, MoleculeCategory } from '../types/chemistry';
import {
  Sliders,
  Plus,
  Trash2,
  Check,
  Zap,
  ArrowRight,
  Flame,
  Cpu,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface RuleEditorProps {
  engine: ChemEngine;
  moleculeTypes: MoleculeType[];
  setMoleculeTypes: React.Dispatch<React.SetStateAction<MoleculeType[]>>;
  reactionRules: ReactionRule[];
  setReactionRules: React.Dispatch<React.SetStateAction<ReactionRule[]>>;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  engine,
  moleculeTypes,
  setMoleculeTypes,
  reactionRules,
  setReactionRules
}) => {
  // New Molecule state
  const [newMolName, setNewMolName] = useState('');
  const [newMolSymbol, setNewMolSymbol] = useState('');
  const [newMolColor, setNewMolColor] = useState('#10b981');
  const [newMolMass, setNewMolMass] = useState(1.0);
  const [newMolEnergy, setNewMolEnergy] = useState(20);
  const [newMolCategory, setNewMolCategory] = useState<MoleculeCategory>('substrate');

  // New Rule state
  const [newRuleName, setNewRuleName] = useState('');
  const [reactantA, setReactantA] = useState(moleculeTypes[0]?.id || '');
  const [reactantB, setReactantB] = useState(moleculeTypes[1]?.id || moleculeTypes[0]?.id || '');
  const [productA, setProductA] = useState(moleculeTypes[0]?.id || '');
  const [productB, setProductB] = useState('');
  const [activationEa, setActivationEa] = useState(10);
  const [rateConstantK, setRateConstantK] = useState(0.7);
  const [energyDelta, setEnergyDelta] = useState(-15);
  const [syscallOpcode, setSyscallOpcode] = useState('SYS_FUSE');

  // Test Runner state
  const [testMol1, setTestMol1] = useState(moleculeTypes[0]?.id || '');
  const [testMol2, setTestMol2] = useState(moleculeTypes[1]?.id || moleculeTypes[0]?.id || '');
  const [testResult, setTestResult] = useState<string | null>(null);

  // Toggle Rule Enable/Disable
  const toggleRule = (ruleId: string) => {
    setReactionRules(prev =>
      prev.map(r => {
        if (r.id === ruleId) {
          const updated = { ...r, enabled: !r.enabled };
          const engineRule = engine.reactionRules.find(er => er.id === ruleId);
          if (engineRule) engineRule.enabled = updated.enabled;
          return updated;
        }
        return r;
      })
    );
  };

  // Delete Rule
  const deleteRule = (ruleId: string) => {
    setReactionRules(prev => prev.filter(r => r.id !== ruleId));
    engine.reactionRules = engine.reactionRules.filter(r => r.id !== ruleId);
  };

  // Add New Molecule
  const handleAddMolecule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMolName.trim() || !newMolSymbol.trim()) return;

    const newId = `M_CUSTOM_${Date.now().toString().slice(-4)}`;
    const newMol: MoleculeType = {
      id: newId,
      name: newMolName.trim(),
      symbol: newMolSymbol.trim(),
      color: newMolColor,
      mass: newMolMass,
      radius: Math.max(10, Math.min(22, 10 + newMolMass * 3)),
      energyState: newMolEnergy,
      category: newMolCategory,
      description: `Custom defined digital molecule ${newMolSymbol}.`
    };

    setMoleculeTypes(prev => [...prev, newMol]);
    engine.moleculeTypes.push(newMol);

    setNewMolName('');
    setNewMolSymbol('');
  };

  // Add New Reaction Rule
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactantA) return;

    const reactants = [{ moleculeId: reactantA, count: 1 }];
    if (reactantB) reactants.push({ moleculeId: reactantB, count: 1 });

    const products = [{ moleculeId: productA, count: 1 }];
    if (productB) products.push({ moleculeId: productB, count: 1 });

    const newRuleId = `R_CUSTOM_${Date.now().toString().slice(-4)}`;
    const rule: ReactionRule = {
      id: newRuleId,
      name: newRuleName.trim() || `${reactants.map(r => r.moleculeId).join('+')} → ${products.map(p => p.moleculeId).join('+')}`,
      reactants,
      products,
      catalysts: [],
      activationEnergy: activationEa,
      rateConstant: rateConstantK,
      energyDelta: energyDelta,
      syscallType: syscallOpcode === 'NONE' ? undefined : syscallOpcode,
      description: 'Custom laboratory rewrite rule.',
      enabled: true
    };

    setReactionRules(prev => [...prev, rule]);
    engine.reactionRules.push(rule);
    setNewRuleName('');
  };

  // Test collision
  const handleTestCollision = () => {
    const totalEffectiveEnergy = 15 + engine.temperature / 30;
    // Check matching rules
    const matches: ReactionRule[] = [];
    reactionRules.forEach(r => {
      if (!r.enabled) return;
      const rIds = r.reactants.map(x => x.moleculeId);
      const isMatch = (rIds.length === 2 && ((rIds[0] === testMol1 && rIds[1] === testMol2) || (rIds[0] === testMol2 && rIds[1] === testMol1))) ||
                      (rIds.length === 1 && rIds[0] === testMol1 && testMol1 === testMol2);
      if (isMatch) matches.push(r);
    });

    if (matches.length === 0) {
      setTestResult(`No rewrite rule matches collision pair [${testMol1}] + [${testMol2}]. Standard elastic bounce.`);
    } else {
      const rule = matches[0];
      if (totalEffectiveEnergy < rule.activationEnergy) {
        setTestResult(`Rule matched: "${rule.name}", but collision energy (${totalEffectiveEnergy.toFixed(1)} kJ) was below activation barrier (${rule.activationEnergy} kJ). Reagents bounced without reacting.`);
      } else {
        setTestResult(`SUCCESS: Rule "${rule.name}" fired! Products synthesized: [${rule.products.map(p => p.moleculeId).join(', ')}]. ΔE = ${rule.energyDelta}kJ (${rule.syscallType || 'SYS_TRANSFORM'}).`);
      }
    }
  };

  return (
    <div id="rule-editor-view" className="flex flex-col gap-3 p-3 bg-zinc-950/60">
      {/* Top Banner */}
      <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
            Reaction Rewrite Rules & Molecular Type Matrix
          </h3>
        </div>
        <span className="text-xs font-mono text-zinc-400">
          {reactionRules.length} Active Rules • {moleculeTypes.length} Molecule Types
        </span>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Active Rules List & Rule Creator */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Active Rules List */}
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Active Reaction Rewrite Rules</span>
            </h4>

            <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
              {reactionRules.map(rule => (
                <div
                  key={rule.id}
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
                    rule.enabled
                      ? 'bg-zinc-950/80 border-zinc-800'
                      : 'bg-zinc-950/40 border-zinc-900 opacity-50'
                  }`}
                >
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-bold text-zinc-200">{rule.name}</span>
                      {rule.syscallType && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {rule.syscallType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
                      <span>Ea: <b className="text-rose-300">{rule.activationEnergy}kJ</b></span>
                      <span>k: <b className="text-cyan-300">{rule.rateConstant}</b></span>
                      <span>ΔE: <b className={rule.energyDelta < 0 ? 'text-emerald-300' : 'text-amber-300'}>{rule.energyDelta}kJ</b></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className="p-1 rounded text-zinc-400 hover:text-emerald-400 transition-colors"
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Delete rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Rewrite Rule Form */}
          <form onSubmit={handleAddRule} className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-3 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Define New Rewrite Rule</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Reactants (Inputs):</label>
                <div className="flex items-center gap-1">
                  <select
                    value={reactantA}
                    onChange={e => setReactantA(e.target.value)}
                    className="flex-1 bg-zinc-950 text-zinc-200 p-1.5 rounded border border-zinc-800 font-mono"
                  >
                    {moleculeTypes.map(m => (
                      <option key={m.id} value={m.id}>{m.symbol} ({m.name})</option>
                    ))}
                  </select>
                  <span className="text-zinc-500">+</span>
                  <select
                    value={reactantB}
                    onChange={e => setReactantB(e.target.value)}
                    className="flex-1 bg-zinc-950 text-zinc-200 p-1.5 rounded border border-zinc-800 font-mono"
                  >
                    <option value="">[None]</option>
                    {moleculeTypes.map(m => (
                      <option key={m.id} value={m.id}>{m.symbol} ({m.name})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">Products (Outputs):</label>
                <div className="flex items-center gap-1">
                  <select
                    value={productA}
                    onChange={e => setProductA(e.target.value)}
                    className="flex-1 bg-zinc-950 text-zinc-200 p-1.5 rounded border border-zinc-800 font-mono"
                  >
                    {moleculeTypes.map(m => (
                      <option key={m.id} value={m.id}>{m.symbol} ({m.name})</option>
                    ))}
                  </select>
                  <span className="text-zinc-500">+</span>
                  <select
                    value={productB}
                    onChange={e => setProductB(e.target.value)}
                    className="flex-1 bg-zinc-950 text-zinc-200 p-1.5 rounded border border-zinc-800 font-mono"
                  >
                    <option value="">[None]</option>
                    {moleculeTypes.map(m => (
                      <option key={m.id} value={m.id}>{m.symbol} ({m.name})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-mono text-zinc-400 block">Activation Ea (kJ):</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={activationEa}
                  onChange={e => setActivationEa(Number(e.target.value))}
                  className="w-full bg-zinc-950 text-zinc-200 p-1 rounded border border-zinc-800 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 block">Rate Constant k:</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="1.0"
                  value={rateConstantK}
                  onChange={e => setRateConstantK(Number(e.target.value))}
                  className="w-full bg-zinc-950 text-zinc-200 p-1 rounded border border-zinc-800 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 block">Energy ΔE (kJ):</label>
                <input
                  type="number"
                  min="-50"
                  max="50"
                  value={energyDelta}
                  onChange={e => setEnergyDelta(Number(e.target.value))}
                  className="w-full bg-zinc-950 text-zinc-200 p-1 rounded border border-zinc-800 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 block">Syscall Opcode:</label>
                <select
                  value={syscallOpcode}
                  onChange={e => setSyscallOpcode(e.target.value)}
                  className="w-full bg-zinc-950 text-zinc-200 p-1 rounded border border-zinc-800 font-mono"
                >
                  <option value="NONE">[None]</option>
                  <option value="SYS_EXEC">SYS_EXEC</option>
                  <option value="SYS_FORK">SYS_FORK</option>
                  <option value="SYS_MUTATE">SYS_MUTATE</option>
                  <option value="SYS_ALLOC">SYS_ALLOC</option>
                  <option value="SYS_FUSE">SYS_FUSE</option>
                  <option value="SYS_RECYCLE">SYS_RECYCLE</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Compile & Register Rewrite Rule</span>
            </button>
          </form>
        </div>

        {/* Right Column: Custom Molecule Creator & Collision Test Runner */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Custom Molecule Creator */}
          <form onSubmit={handleAddMolecule} className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Create New Molecule Type</span>
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-zinc-400 block mb-0.5">Molecule Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Gamma Radical"
                  value={newMolName}
                  onChange={e => setNewMolName(e.target.value)}
                  className="w-full bg-zinc-950 text-zinc-200 p-1.5 rounded border border-zinc-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 block mb-0.5">Symbol:</label>
                <input
                  type="text"
                  placeholder="e.g. γ"
                  value={newMolSymbol}
                  onChange={e => setNewMolSymbol(e.target.value)}
                  className="w-full bg-zinc-950 text-zinc-200 p-1.5 rounded border border-zinc-800 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-mono text-zinc-400 block mb-0.5">Color:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={newMolColor}
                    onChange={e => setNewMolColor(e.target.value)}
                    className="w-7 h-7 rounded border border-zinc-800 bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-zinc-400">{newMolColor}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 block mb-0.5">Mass (amu):</label>
                <input
                  type="number"
                  step="0.2"
                  min="0.2"
                  max="10"
                  value={newMolMass}
                  onChange={e => setNewMolMass(Number(e.target.value))}
                  className="w-full bg-zinc-950 text-zinc-200 p-1 rounded border border-zinc-800 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-400 block mb-0.5">Category:</label>
                <select
                  value={newMolCategory}
                  onChange={e => setNewMolCategory(e.target.value as MoleculeCategory)}
                  className="w-full bg-zinc-950 text-zinc-200 p-1 rounded border border-zinc-800 font-mono text-[10px]"
                >
                  <option value="substrate">Substrate</option>
                  <option value="catalyst">Catalyst</option>
                  <option value="product">Product</option>
                  <option value="system_call">Syscall</option>
                  <option value="polymer">Polymer</option>
                  <option value="waste">Waste</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-1.5 rounded-lg bg-cyan-500 text-zinc-950 font-bold hover:bg-cyan-400 transition-colors flex items-center justify-center gap-1 mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Instantiate Molecule Type</span>
            </button>
          </form>

          {/* Live Collision & Rewrite Test Sandbox */}
          <div className="p-3 bg-zinc-900/70 rounded-xl border border-zinc-800/80 flex flex-col gap-2.5 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Collision Rewrite Sandbox & Verifier</span>
            </h4>

            <div className="flex items-center gap-2">
              <select
                value={testMol1}
                onChange={e => setTestMol1(e.target.value)}
                className="flex-1 bg-zinc-950 text-zinc-200 p-1.5 rounded border border-zinc-800 font-mono"
              >
                {moleculeTypes.map(m => (
                  <option key={m.id} value={m.id}>{m.symbol} ({m.name})</option>
                ))}
              </select>
              <span className="font-mono text-zinc-500 font-bold">⚡</span>
              <select
                value={testMol2}
                onChange={e => setTestMol2(e.target.value)}
                className="flex-1 bg-zinc-950 text-zinc-200 p-1.5 rounded border border-zinc-800 font-mono"
              >
                {moleculeTypes.map(m => (
                  <option key={m.id} value={m.id}>{m.symbol} ({m.name})</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleTestCollision}
              className="py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors font-mono font-semibold"
            >
              Simulate Test Collision
            </button>

            {testResult && (
              <div className="p-2 rounded bg-zinc-950 border border-zinc-800 font-mono text-[11px] text-zinc-300 leading-relaxed">
                {testResult}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
