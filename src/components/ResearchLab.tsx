import React, { useMemo, useState } from 'react';
import {
  equationToNetwork,
  parseReactionEquation,
  simulateGillespie,
  validateNetwork,
  createExperimentRecord,
  serializeExperiment,
  simulationEventsToCsv,
} from '../research';
import type { ReactionNetwork, SimulationResult, SpeciesCounts } from '../research';

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

function createInitialCounts(network: ReactionNetwork, populationPerCoefficient: number): SpeciesCounts {
  const counts: Record<string, number> = Object.fromEntries(
    network.species.map((species) => [species.id, 0]),
  );
  for (const reaction of network.reactions) {
    for (const term of reaction.reactants) {
      counts[term.speciesId] += term.coefficient * populationPerCoefficient;
    }
  }
  return counts;
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
  const [populationPerCoefficient, setPopulationPerCoefficient] = useState('80');
  const [duration, setDuration] = useState('10');
  const [rate, setRate] = useState('0.08');
  const [seed, setSeed] = useState('42');
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
  const population = Number(populationPerCoefficient);
  const initialCounts = useMemo(
    () => createInitialCounts(network, Number.isSafeInteger(population) && population >= 0 ? population : 0),
    [network, population],
  );
  const maxCount = result
    ? Math.max(1, ...(Object.values(result.initialCounts) as number[]), ...(Object.values(result.finalCounts) as number[]))
    : Math.max(1, ...(Object.values(initialCounts) as number[]));

  const validateAndLoadEquation = () => {
    setEquationFeedback(null);
    setError(null);
    try {
      const parsed = parseReactionEquation(equationInput);
      const candidate = equationToNetwork(parsed, Number(rate));
      const issues = validateNetwork(candidate);
      if (issues.length) {
        setEquationFeedback({ valid: false, message: issues.map((issue) => issue.message).join(' ') });
        return;
      }

      setActiveNetwork(candidate);
      setActiveEquation(parsed.source);
      setResult(null);
      const directionNote = parsed.arrow === 'reversible'
        ? ' The reversible arrow is retained as metadata; this simulator currently runs only the written forward direction.'
        : '';
      setEquationFeedback({
        valid: true,
        message: `Balanced neutral equation loaded. Initial populations will be assigned to reactants using the experiment input below.${directionNote}`,
      });
    } catch (cause) {
      setEquationFeedback({
        valid: false,
        message: cause instanceof Error ? cause.message : 'Could not parse equation.',
      });
    }
  };

  const run = () => {
    setError(null);
    setResult(null);
    try {
      if (!Number.isSafeInteger(population) || population < 0) {
        throw new Error('Initial population per reactant coefficient must be a non-negative integer.');
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
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={equationInput} onChange={e => { setEquationInput(e.target.value); setEquationFeedback(null); }}
            aria-label="Chemical reaction equation" placeholder="2 H2 + O2 -> 2 H2O"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-500" />
          <button onClick={validateAndLoadEquation} className="rounded-lg border border-cyan-700 bg-cyan-950/60 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-900/70">Validate & load network</button>
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
            <label className="block">
              <span className="text-xs text-zinc-400">Initial population per reactant coefficient</span>
              <input type="number" min="0" step="1" value={populationPerCoefficient} onChange={e => setPopulationPerCoefficient(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
              <span className="mt-1 block text-[11px] text-zinc-600">Each reactant starts with this number multiplied by its stoichiometric coefficient. Product-only species start at zero.</span>
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Simulation horizon (seconds)</span>
              <input type="number" min="0.001" step="0.1" value={duration} onChange={e => setDuration(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Stochastic rate constant c (s⁻¹ per available reactant combination)</span>
              <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Random seed (uint32)</span>
              <input type="number" min="0" max="4294967295" step="1" value={seed} onChange={e => setSeed(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-500" />
            </label>
            <button onClick={run} disabled={validationIssues.length > 0}
              className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40">
              Run stochastic experiment
            </button>
            {error && <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-300">{error}</p>}
          </div>
          <div className="mt-5 border-t border-zinc-800 pt-4">
            <p className="text-xs font-semibold text-zinc-300">Active reaction network</p>
            <div className="mt-2 break-words rounded-lg bg-black/30 p-3 font-mono text-sm text-cyan-200">{activeEquation}</div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Network balance is validated before a run. Initial populations are derived from the reactant coefficients and the population input.</p>
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
