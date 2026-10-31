import React, { useMemo, useState } from 'react';
import {
  parseReactionNetwork,
  simulateEnsemble,
  simulateGillespie,
  convertMacroscopicRateConstant,
  calculateArrheniusRate,
  validateNetwork,
  validateInitialCounts,
  createExperimentRecord,
  serializeExperiment,
  simulationEventsToCsv,
} from '../research';
import type { EnsembleResult, ReactionNetwork, SimulationResult, SpeciesCounts } from '../research';

const DISSOCIATION_NETWORK: ReactionNetwork = {
  species: [
    { id: 'H2', label: 'Hydrogen molecule (H₂)', composition: { H: 2 }, charge: 0 },
    { id: 'H', label: 'Hydrogen atom (H)', composition: { H: 1 }, charge: 0 },
  ],
  reactions: [{
    id: 'dissociation',
    label: 'H₂ → 2 H',
    reactants: [{ speciesId: 'H2', coefficient: 1 }],
    products: [{ speciesId: 'H', coefficient: 2 }],
    stochasticRateConstant: 0.08,
  }],
};

const format = (value: number, digits = 4) =>
  Number(value.toFixed(digits)).toLocaleString(undefined, { maximumFractionDigits: digits });

function createDefaultInitialCounts(network: ReactionNetwork): Record<string, string> {
  const counts: Record<string, string> = Object.fromEntries(
    network.species.map((species) => [species.id, '0']),
  );
  // The first reaction's reactants provide a sensible starting condition.
  // Every species remains individually editable in the experiment panel.
  for (const term of network.reactions[0]?.reactants ?? []) {
    counts[term.speciesId] = String(term.coefficient * 80);
  }
  return counts;
}

function parseInitialCounts(network: ReactionNetwork, values: Record<string, string>): SpeciesCounts {
  return Object.fromEntries(network.species.map((species) => [
    species.id,
    values[species.id] === '' ? Number.NaN : Number(values[species.id] ?? '0'),
  ]));
}

function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ResearchLab: React.FC = () => {
  const [activeNetwork, setActiveNetwork] = useState<ReactionNetwork>(DISSOCIATION_NETWORK);
  const [activeEquation, setActiveEquation] = useState('H₂ → 2 H');
  const [initialPopulationValues, setInitialPopulationValues] = useState<Record<string, string>>(() => createDefaultInitialCounts(DISSOCIATION_NETWORK));
  const [duration, setDuration] = useState('10');
  const [rate, setRate] = useState('0.08');
  const [macroscopicRate, setMacroscopicRate] = useState('1');
  const [preExponential, setPreExponential] = useState('1e7');
  const [activationEnergy, setActivationEnergy] = useState('50000');
  const [temperatureKelvin, setTemperatureKelvin] = useState('298.15');
  const [arrheniusFeedback, setArrheniusFeedback] = useState<string | null>(null);
  const [volumeLiters, setVolumeLiters] = useState('1e-15');
  const [conversionFeedback, setConversionFeedback] = useState<string | null>(null);
  const [seed, setSeed] = useState('42');
  const [replicates, setReplicates] = useState('200');
  const [ensembleResult, setEnsembleResult] = useState<EnsembleResult | null>(null);
  const [equationInput, setEquationInput] = useState('2 H2 + O2 -> 2 H2O');
  const [equationFeedback, setEquationFeedback] = useState<{ valid: boolean; message: string } | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const network = useMemo<ReactionNetwork>(() => ({
    ...activeNetwork,
    reactions: activeNetwork.reactions.map((reaction) => ({
      ...reaction,
      stochasticRateConstant: Number(rate),
    })),
  }), [activeNetwork, rate]);

  const validationIssues = useMemo(() => validateNetwork(network), [network]);
  const initialCounts = useMemo(
    () => parseInitialCounts(network, initialPopulationValues),
    [network, initialPopulationValues],
  );
  const initialCountIssues = useMemo(
    () => validateInitialCounts(network, initialCounts),
    [network, initialCounts],
  );
  const maxCount = result
    ? Math.max(1, ...(Object.values(result.initialCounts) as number[]), ...(Object.values(result.finalCounts) as number[]))
    : Math.max(1, ...(Object.values(initialCounts) as number[]));

  const validateAndLoadEquation = () => {
    setEquationFeedback(null);
    setError(null);
    try {
      const parsed = parseReactionNetwork(equationInput, Number(rate));
      const candidate = parsed.network;
      const issues = validateNetwork(candidate);
      if (issues.length) {
        setEquationFeedback({ valid: false, message: issues.map((issue) => issue.message).join(' ') });
        return;
      }

      setActiveNetwork(candidate);
      setActiveEquation(parsed.equations.map((equation) => equation.source).join('\\n'));
      setInitialPopulationValues(createDefaultInitialCounts(candidate));
      setRate('0.08');
      setConversionFeedback(null);
      setResult(null);
      setEnsembleResult(null);
      const reversibleCount = parsed.equations.filter((equation) => equation.arrow === 'reversible').length;
      const directionNote = reversibleCount > 0
        ? ` ${reversibleCount} reversible arrow(s) were recognized, but the SSA currently models only the written forward direction; no reverse rates are inferred.`
        : '';
      setEquationFeedback({
        valid: true,
        message: `Loaded ${candidate.reactions.length} balanced reaction channel(s). The same stochastic c is assigned to every channel; edit initial populations species by species below.${directionNote}`,
      });
    } catch (cause) {
      setEquationFeedback({
        valid: false,
        message: cause instanceof Error ? cause.message : 'Could not parse equation.',
      });
    }
  };

  const applyArrheniusRate = () => {
    setArrheniusFeedback(null);
    try {
      const calculated = calculateArrheniusRate(
        Number(preExponential),
        Number(activationEnergy),
        Number(temperatureKelvin),
      );
      setMacroscopicRate(String(calculated.rateConstant));
      setArrheniusFeedback(
        `k(T) = ${calculated.rateConstant.toExponential(6)}; exponential factor = ${calculated.exponentialFactor.toExponential(6)}. A's units are carried through unchanged.`,
      );
    } catch (cause) {
      setArrheniusFeedback(cause instanceof Error ? cause.message : 'Arrhenius calculation failed.');
    }
  };

  const convertRateConstant = () => {
    setConversionFeedback(null);
    try {
      if (network.reactions.length !== 1) {
        throw new Error('The current converter requires exactly one reaction channel.');
      }
      const converted = convertMacroscopicRateConstant(
        network.reactions[0],
        Number(macroscopicRate),
        Number(volumeLiters),
      );
      setRate(String(converted.stochasticRateConstant));
      setResult(null);
      setEnsembleResult(null);
      setConversionFeedback(
        `Converted ${converted.macroscopicUnits} to c = ${converted.stochasticRateConstant.toExponential(6)} ${converted.stochasticUnits}. ${converted.formula}`,
      );
    } catch (cause) {
      setConversionFeedback(cause instanceof Error ? cause.message : 'Rate conversion failed.');
    }
  };

  const runEnsemble = () => {
    setError(null);
    setEnsembleResult(null);
    try {
      if (initialCountIssues.length) {
        throw new Error(initialCountIssues.map((issue) => issue.message).join(' '));
      }
      const seconds = Number(duration);
      const randomSeed = Number(seed);
      const replicateCount = Number(replicates);
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1_000_000) {
        throw new Error('Duration must be greater than zero and no more than 1,000,000 seconds.');
      }
      if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 4_294_967_295) {
        throw new Error('Seed must be an integer between 0 and 4,294,967,295.');
      }
      if (!Number.isSafeInteger(replicateCount) || replicateCount < 2 || replicateCount > 1000) {
        throw new Error('Ensemble size must be an integer between 2 and 1,000.');
      }
      if (validationIssues.length) {
        throw new Error(validationIssues.map((issue) => issue.message).join(' '));
      }
      setEnsembleResult(simulateEnsemble(network, initialCounts, {
        durationSeconds: seconds,
        seed: randomSeed,
        replicates: replicateCount,
        maxEvents: 100_000,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ensemble could not be completed.');
    }
  };

  const run = () => {
    setError(null);
    setResult(null);
    setEnsembleResult(null);
    try {
      if (initialCountIssues.length) {
        throw new Error(initialCountIssues.map((issue) => issue.message).join(' '));
      }
      const seconds = Number(duration);
      const randomSeed = Number(seed);
      const rateConstant = Number(rate);
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1_000_000) {
        throw new Error('Duration must be greater than zero and no more than 1,000,000 seconds.');
      }
      if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 4_294_967_295) {
        throw new Error('Seed must be an integer between 0 and 4,294,967,295.');
      }
      if (!Number.isFinite(rateConstant) || rateConstant < 0) {
        throw new Error('Stochastic rate constant must be finite and non-negative.');
      }
      if (validationIssues.length) {
        throw new Error(validationIssues.map((issue) => issue.message).join(' '));
      }

      setResult(simulateGillespie(network, initialCounts, {
        durationSeconds: seconds,
        seed: randomSeed,
        maxEvents: 100_000,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Simulation could not be completed.');
    }
  };

  return (
    <section className="mx-auto max-w-7xl space-y-4 text-zinc-100">
      <div className="rounded-2xl border border-cyan-900/60 bg-gradient-to-br from-zinc-900 via-zinc-950 to-cyan-950/30 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">Research workspace / 01</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Stochastic reaction laboratory</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Build a neutral reaction network, verify its stoichiometry and run reproducible event-driven simulations
              using the Gillespie direct method. This kernel is independent of the visual particle sandbox.
            </p>
          </div>
          <span className="rounded-full border border-cyan-800 bg-cyan-950/60 px-3 py-1 font-mono text-xs text-cyan-200">SSA · deterministic seed</span>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ['MODEL', 'Well-mixed continuous-time'],
            ['PROPENSITY', 'c × reactant combinations'],
            ['REPRODUCIBILITY', 'Seeded event trajectory'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-black/20 p-3">
              <p className="font-mono text-[10px] tracking-widest text-zinc-500">{label}</p>
              <p className="mt-1 text-sm text-zinc-200">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Chemical equation parser & balance checker</h3>
            <p className="mt-1 text-xs text-zinc-500">Enter a neutral formula equation. Nested groups and hydrate notation are expanded before atom and formal-charge checks.</p>
          </div>
          <span className="font-mono text-[10px] text-cyan-300">FORMULA VALIDATION</span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <textarea value={equationInput} onChange={e => { setEquationInput(e.target.value); setEquationFeedback(null); }}
            aria-label="Chemical reaction network equations" rows={4} placeholder={'2 H2 + O2 -> 2 H2O\\n2 H2O -> 2 H2 + O2'}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-500" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-zinc-600">One reaction per line. Blank lines and # comments are ignored.</span>
            <button onClick={validateAndLoadEquation} className="rounded-lg border border-cyan-700 bg-cyan-950/60 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-900/70">Validate & load network</button>
          </div>
        </div>
        {equationFeedback && (
          <p role="status" className={`mt-3 rounded-lg border p-3 text-xs leading-5 ${equationFeedback.valid ? 'border-emerald-900 bg-emerald-950/30 text-emerald-200' : 'border-rose-900 bg-rose-950/30 text-rose-200'}`}>
            {equationFeedback.valid ? '✓ ' : 'Check required: '}{equationFeedback.message}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-5 text-zinc-600">Supported: element symbols, integer coefficients, nested () and [] groups, hydrate separators (· or .), and forward/reversible arrows. Ionic charge notation and phase labels are not yet parsed; formulas are treated as neutral formula units.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Experiment parameters</h3>
            <span className="font-mono text-[10px] text-emerald-300">MODEL INPUT</span>
          </div>
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
              <p className="text-xs font-semibold text-zinc-300">Initial species populations</p>
              <p className="mt-1 text-[11px] text-zinc-500">Set each species count explicitly. The first reaction's reactants are prefilled as a starting point; review them before running.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {network.species.map(species => (
                  <label key={species.id} className="block min-w-0">
                    <span className="block truncate text-[11px] text-zinc-400">{species.label}</span>
                    <input type="number" min="0" step="1" value={initialPopulationValues[species.id] ?? '0'}
                      onChange={e => { setInitialPopulationValues(current => ({ ...current, [species.id]: e.target.value })); setResult(null); setEnsembleResult(null); }}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs outline-none focus:border-cyan-500" />
                  </label>
                ))}
              </div>
              {initialCountIssues.length > 0 && <p className="mt-2 text-[11px] text-rose-300">{initialCountIssues.map(issue => issue.message).join(' ')}</p>}
            </div>
            <label className="block">
              <span className="text-xs text-zinc-400">Simulation horizon (seconds)</span>
              <input type="number" min="0.001" step="0.1" value={duration} onChange={e => { setDuration(e.target.value); setResult(null); setEnsembleResult(null); }}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Stochastic rate constant c (s⁻¹ per available reactant combination)</span>
              <input type="number" min="0" step="0.01" value={rate} onChange={e => { setRate(e.target.value); setResult(null); setEnsembleResult(null); }}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </label>
            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
              <p className="text-xs font-semibold text-zinc-300">Arrhenius temperature model</p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">Calculate k(T) = A exp(−Ea/RT). A carries the same units as k for the selected reaction order.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <label className="block min-w-0">
                  <span className="text-[10px] text-zinc-400">A (same units as k)</span>
                  <input type="number" min="0" step="any" value={preExponential} onChange={e => setPreExponential(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs outline-none focus:border-cyan-500" />
                </label>
                <label className="block min-w-0">
                  <span className="text-[10px] text-zinc-400">Ea (J/mol)</span>
                  <input type="number" min="0" step="any" value={activationEnergy} onChange={e => setActivationEnergy(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs outline-none focus:border-cyan-500" />
                </label>
                <label className="block min-w-0">
                  <span className="text-[10px] text-zinc-400">T (K)</span>
                  <input type="number" min="0" step="any" value={temperatureKelvin} onChange={e => setTemperatureKelvin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs outline-none focus:border-cyan-500" />
                </label>
              </div>
              <button onClick={applyArrheniusRate} className="mt-3 w-full rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-900/40">Calculate k(T) and use in rate converter</button>
              {arrheniusFeedback && <p role="status" className="mt-2 break-words text-[11px] leading-5 text-emerald-200">{arrheniusFeedback}</p>}
              <p className="mt-2 text-[10px] leading-4 text-zinc-600">Ea is molar activation energy; R = 8.314462618 J mol⁻¹ K⁻¹. This is a parameter calculation, not a reaction-mechanism or transition-state prediction.</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
              <p className="text-xs font-semibold text-zinc-300">Macroscopic kinetic constant converter</p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">Convert k from concentration-based mass-action units to the SSA stochastic constant using reaction order and volume.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[11px] text-zinc-400">Macroscopic k ({activeNetwork.reactions[0]?.reactants.reduce((sum, term) => sum + term.coefficient, 0) === 1 ? 's⁻¹' : `M⁻${Math.max(1, (activeNetwork.reactions[0]?.reactants.reduce((sum, term) => sum + term.coefficient, 0) ?? 1) - 1)} s⁻¹`})</span>
                  <input type="number" min="0" step="any" value={macroscopicRate} onChange={e => setMacroscopicRate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs outline-none focus:border-cyan-500" />
                </label>
                <label className="block">
                  <span className="text-[11px] text-zinc-400">Volume (litres)</span>
                  <input type="number" min="0" step="any" value={volumeLiters} onChange={e => setVolumeLiters(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs outline-none focus:border-cyan-500" />
                </label>
              </div>
              <button onClick={convertRateConstant} disabled={network.reactions.length !== 1} className="mt-3 w-full rounded-lg border border-cyan-800 bg-cyan-950/40 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-40">{network.reactions.length === 1 ? 'Convert and apply stochastic c' : 'Rate conversion requires one reaction channel'}</button>
              {conversionFeedback && <p role="status" className="mt-2 break-words text-[11px] leading-5 text-cyan-200">{conversionFeedback}</p>}
              <p className="mt-2 text-[10px] leading-4 text-zinc-600">Assumes an elementary mass-action step, ideal well-mixed solution, constant volume and the standard large-population rate-law convention. Finite-population stochastic trajectories may differ from deterministic concentration equations.</p>
            </div>
            <label className="block">
              <span className="text-xs text-zinc-400">Ensemble replicates (2–1,000)</span>
              <input type="number" min="2" max="1000" step="1" value={replicates} onChange={e => { setReplicates(e.target.value); setEnsembleResult(null); }}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Random seed (uint32)</span>
              <input type="number" min="0" max="4294967295" step="1" value={seed} onChange={e => { setSeed(e.target.value); setResult(null); setEnsembleResult(null); }}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-500" />
            </label>
            <button onClick={run} disabled={validationIssues.length > 0 || initialCountIssues.length > 0}
              className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
              Run stochastic experiment
            </button>
            <button onClick={runEnsemble} disabled={validationIssues.length > 0}
              className="w-full rounded-lg border border-cyan-700 bg-cyan-950/50 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-900/60 disabled:cursor-not-allowed disabled:opacity-40">
              Run stochastic ensemble
            </button>
            {error && <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p>}
          </div>
          <div className="mt-5 border-t border-zinc-800 pt-4">
            <p className="text-xs font-semibold text-zinc-300">Active reaction network</p>
            <div className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 font-mono text-sm text-cyan-200">{activeEquation}</div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Each channel is balanced independently. Every species population is an explicit model input; the first channel's reactants are only prefilled defaults.</p>
            {validationIssues.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-300">
                {validationIssues.map((issue, index) => <li key={index}>{issue.message}</li>)}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">Simulation output</h3>
              <span className="font-mono text-[10px] text-zinc-500">{result ? `SEED ${result.seed}` : 'AWAITING RUN'}</span>
            </div>
            {!result ? (
              <div className="mt-5 rounded-xl border border-dashed border-zinc-800 p-8 text-center">
                <p className="text-sm text-zinc-400">Your event trajectory will appear here.</p>
                <p className="mt-1 text-xs text-zinc-600">Load a balanced equation and run the model to calculate species populations and reaction events.</p>
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-500">Reaction events</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{result.events.length.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-500">Observation horizon</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{format(result.elapsedSeconds, 3)} s</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {network.species.map((species) => {
                    const start = result.initialCounts[species.id] ?? 0;
                    const end = result.finalCounts[species.id] ?? 0;
                    return (
                      <div key={species.id}>
                        <div className="mb-1 flex justify-between gap-2 text-xs">
                          <span className="text-zinc-400">{species.label}</span>
                          <span className="shrink-0 font-mono text-zinc-200">{start} → {end}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                          <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${(end / maxCount) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                  <button onClick={() => {
                    const record = createExperimentRecord(network, initialCounts, {
                      durationSeconds: Number(duration),
                      seed: Number(seed),
                      maxEvents: 100_000,
                    }, result);
                    downloadTextFile(`chemistry-lab-experiment-${Date.now()}.json`, serializeExperiment(record), 'application/json');
                  }} className="rounded-lg border border-cyan-800 bg-cyan-950/40 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-900/50">
                    Export reproducibility record (.json)
                  </button>
                  <button onClick={() => downloadTextFile(
                    `chemistry-lab-events-${Date.now()}.csv`,
                    simulationEventsToCsv(result, network),
                    'text/csv',
                  )} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800">
                    Export event data (.csv)
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-400">Termination: {result.terminatedBy.replaceAll('_', ' ')}</span>
                  <span className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-400">Events: {result.events.length}</span>
                </div>
              </>
            )}
          </div>

          {ensembleResult && (
            <div className="rounded-2xl border border-cyan-900/60 bg-zinc-950/90 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Ensemble statistics</h3>
                <span className="font-mono text-[10px] text-cyan-300">{ensembleResult.replicateCount} REPLICATES · BASE SEED {ensembleResult.baseSeed}</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">Final population mean, sample standard deviation and normal-approximation 95% confidence interval for the mean.</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr><th className="py-2 pr-3 font-medium">Species</th><th className="py-2 pr-3 font-medium">Mean</th><th className="py-2 pr-3 font-medium">SD</th><th className="py-2 font-medium">95% CI of mean</th></tr>
                  </thead>
                  <tbody>
                    {ensembleResult.species.map(item => {
                      const label = network.species.find(species => species.id === item.speciesId)?.label ?? item.speciesId;
                      return <tr key={item.speciesId} className="border-t border-zinc-800">
                        <td className="py-2 pr-3 text-zinc-300">{label}</td>
                        <td className="py-2 pr-3 font-mono text-cyan-200">{format(item.mean, 3)}</td>
                        <td className="py-2 pr-3 font-mono text-zinc-400">{format(item.standardDeviation, 3)}</td>
                        <td className="py-2 font-mono text-zinc-400">[{format(item.confidenceInterval95[0], 3)}, {format(item.confidenceInterval95[1], 3)}]</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {result && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
              <h3 className="text-sm font-semibold">Recent reaction events</h3>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {result.events.slice(-12).reverse().map((event, index) => (
                  <div key={`${event.reactionId}-${event.timeSeconds}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900/70 px-3 py-2 text-xs">
                    <span className="font-mono text-cyan-200">{event.reactionLabel}</span>
                    <span className="shrink-0 text-zinc-500">{format(event.timeSeconds, 4)} s</span>
                  </div>
                ))}
                {result.events.length === 0 && <p className="text-xs text-zinc-500">No reaction events occurred within this time horizon.</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
        <p className="text-xs font-semibold text-amber-200">Scientific interpretation boundary</p>
        <p className="mt-1 text-xs leading-5 text-amber-100/70">
          The default hydrogen dissociation preset is a software verification example, not a calibrated hydrogen dissociation model.
          Its rate constant is illustrative. No temperature, pressure, radiation field, molecular energy surface, volume conversion
          or transport process is modelled. Parsed custom equations are neutral formula-unit networks; do not interpret their outputs
          as experimental predictions without validated parameters and appropriate physical assumptions.
        </p>
      </div>
    </section>
  );
};
