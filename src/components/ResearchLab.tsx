import React, { useMemo, useState } from 'react';
import { simulateGillespie, validateNetwork } from '../research';
import type { ReactionNetwork, SimulationResult } from '../research';

const DISSOCIATION_NETWORK: ReactionNetwork = {
  species: [
    { id: 'H2', label: 'Hydrogen molecule (H₂)', composition: { H: 2 }, charge: 0 },
    { id: 'H', label: 'Hydrogen atom (H)', composition: { H: 1 }, charge: 0 },
  ],
  reactions: [
    {
      id: 'dissociation',
      label: 'H₂ → 2 H',
      reactants: [{ speciesId: 'H2', coefficient: 1 }],
      products: [{ speciesId: 'H', coefficient: 2 }],
      // Illustrative parameter only; not an experimental rate constant.
      stochasticRateConstant: 0.08,
    },
  ],
};

const format = (value: number, digits = 4) =>
  Number(value.toFixed(digits)).toLocaleString(undefined, { maximumFractionDigits: digits });

export const ResearchLab: React.FC = () => {
  const [initialH2, setInitialH2] = useState('80');
  const [duration, setDuration] = useState('10');
  const [rate, setRate] = useState('0.08');
  const [seed, setSeed] = useState('42');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const network = useMemo<ReactionNetwork>(() => ({
    ...DISSOCIATION_NETWORK,
    reactions: [{
      ...DISSOCIATION_NETWORK.reactions[0],
      stochasticRateConstant: Number(rate),
    }],
  }), [rate]);

  const validationIssues = useMemo(() => validateNetwork(network), [network]);

  const run = () => {
    setError(null);
    setResult(null);
    try {
      const count = Number(initialH2);
      const seconds = Number(duration);
      const randomSeed = Number(seed);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('Initial H₂ count must be a non-negative integer.');
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 1_000_000) throw new Error('Duration must be greater than zero and no more than 1,000,000 seconds.');
      if (!Number.isSafeInteger(randomSeed) || randomSeed < 0 || randomSeed > 4_294_967_295) throw new Error('Seed must be an integer between 0 and 4,294,967,295.');
      if (!Number.isFinite(Number(rate)) || Number(rate) < 0) throw new Error('Stochastic rate constant must be finite and non-negative.');
      setResult(simulateGillespie(network, { H2: count, H: 0 }, {
        durationSeconds: seconds,
        seed: randomSeed,
        maxEvents: 100_000,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Simulation could not be completed.');
    }
  };

  const maxCount = result
    ? Math.max(1, result.initialCounts.H2, result.initialCounts.H, result.finalCounts.H2, result.finalCounts.H)
    : 80;

  return (
    <section className="mx-auto max-w-7xl space-y-4 text-zinc-100">
      <div className="rounded-2xl border border-cyan-900/60 bg-gradient-to-br from-zinc-900 via-zinc-950 to-cyan-950/30 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-300">Research workspace / 01</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Stochastic reaction laboratory</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Run reproducible, event-driven simulations of well-mixed reaction networks using the Gillespie direct method.
              This research kernel is independent of the visual particle sandbox.
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Experiment parameters</h3>
            <span className="font-mono text-[10px] text-emerald-300">MODEL INPUT</span>
          </div>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs text-zinc-400">Initial H₂ population (molecules)</span>
              <input type="number" min="0" step="1" value={initialH2} onChange={e => setInitialH2(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Simulation horizon (seconds)</span>
              <input type="number" min="0.001" step="0.1" value={duration} onChange={e => setDuration(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-400">Stochastic rate constant c (s⁻¹ per available molecule)</span>
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
            <p className="text-xs font-semibold text-zinc-300">Reaction network</p>
            <div className="mt-2 rounded-lg bg-black/30 p-3 font-mono text-sm text-cyan-200">H₂ → 2 H</div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Elemental and formal-charge balance are checked before simulation. Both species contain hydrogen only and have zero formal charge.</p>
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
                <p className="mt-1 text-xs text-zinc-600">Run the model to calculate populations and event history.</p>
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-500">Reaction events</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{result.events.length.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-500">Elapsed simulated time</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{format(result.elapsedSeconds, 3)} s</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    { id: 'H2', label: 'H₂ molecules', start: result.initialCounts.H2, end: result.finalCounts.H2 },
                    { id: 'H', label: 'H atoms', start: result.initialCounts.H, end: result.finalCounts.H },
                  ].map(item => (
                    <div key={item.id}>
                      <div className="mb-1 flex justify-between text-xs"><span className="text-zinc-400">{item.label}</span><span className="font-mono text-zinc-200">{item.start} → {item.end}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${(item.end / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
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
          This preset is a software verification example, not a calibrated hydrogen dissociation model. The rate constant is illustrative,
          and no temperature, pressure, radiation field, molecular energy surface, volume conversion or transport process is modelled.
          Do not interpret these outputs as experimental predictions.
        </p>
      </div>
    </section>
  );
};
