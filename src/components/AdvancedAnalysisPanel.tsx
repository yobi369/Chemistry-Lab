import React, { useEffect, useMemo, useState } from 'react';
import { MolecularToolkitPanel } from './MolecularToolkitPanel';
import { MechanismFittingPanel } from './MechanismFittingPanel';
import {
  fitFirstOrderDecay,
  estimateLocalSensitivity,
  propagateFirstOrderRateUncertainty,
  analyzeReactionThermodynamics,
  validateMolecularStructure,
} from '../research';
import type { ReactionNetwork, FirstOrderFit, FirstOrderUncertaintyResult, LocalSensitivity, ReactionThermodynamicAnalysis, MolecularStructureValidation } from '../research';

interface Props { network: ReactionNetwork }

const pretty = (value: number, digits = 5) =>
  Number(value.toFixed(digits)).toLocaleString(undefined, { maximumFractionDigits: digits });

function parseObservationCsv(source: string) {
  const rows = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return rows.map((line, index) => {
    const parts = line.split(/[;,\t]/).map(part => part.trim());
    if (parts.length < 2 || parts.length > 3) throw new Error(`Line ${index + 1}: use time,value or time,value,standard-deviation.`);
    const [timeSeconds, value, standardDeviation] = parts.map(Number);
    if (!Number.isFinite(timeSeconds) || !Number.isFinite(value) ||
        (parts.length === 3 && !Number.isFinite(standardDeviation))) {
      throw new Error(`Line ${index + 1}: every field must be a finite number.`);
    }
    return { timeSeconds, value, ...(parts.length === 3 ? { standardDeviation } : {}) };
  });
}

export const AdvancedAnalysisPanel: React.FC<Props> = ({ network }) => {
  const [observations, setObservations] = useState('0,100\n1,74.08\n2,54.88\n3,40.66\n4,30.12');
  const [fit, setFit] = useState<FirstOrderFit | null>(null);
  const [fitError, setFitError] = useState<string | null>(null);
  const [rate, setRate] = useState('0.3');
  const [rateSd, setRateSd] = useState('0.03');
  const [time, setTime] = useState('3');
  const [initial, setInitial] = useState('100');
  const [uncertainty, setUncertainty] = useState<FirstOrderUncertaintyResult | null>(null);
  const [sensitivity, setSensitivity] = useState<LocalSensitivity | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [formationData, setFormationData] = useState(() =>
    JSON.stringify(Object.fromEntries(network.species.map(item => [item.id, 0])), null, 2));
  const [activityData, setActivityData] = useState(() =>
    JSON.stringify(Object.fromEntries(network.species.map(item => [item.id, 1])), null, 2));
  const [thermo, setThermo] = useState<ReactionThermodynamicAnalysis | null>(null);
  const [thermoReaction, setThermoReaction] = useState(network.reactions[0]?.id ?? '');
  const [thermoTemperature, setThermoTemperature] = useState('298.15');
  const [thermoError, setThermoError] = useState<string | null>(null);
  const [structureJson, setStructureJson] = useState(JSON.stringify({
    structureId: 'water-example',
    source: 'manual example graph',
    atoms: [
      { id: 'O1', element: 'O' },
      { id: 'H1', element: 'H' },
      { id: 'H2', element: 'H' },
    ],
    bonds: [
      { atomA: 'O1', atomB: 'H1', order: 1 },
      { atomA: 'O1', atomB: 'H2', order: 1 },
    ],
  }, null, 2));
  const [expectedFormula, setExpectedFormula] = useState('H2O');
  const [expectedCharge, setExpectedCharge] = useState('0');
  const [structureResult, setStructureResult] = useState<MolecularStructureValidation | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);

  const reactionOptions = useMemo(() => network.reactions, [network]);
  const speciesSignature = network.species.map(item => item.id).join('|');
  const reactionSignature = network.reactions.map(item => item.id).join('|');
  useEffect(() => {
    setFormationData(JSON.stringify(Object.fromEntries(network.species.map(item => [item.id, 0])), null, 2));
    setActivityData(JSON.stringify(Object.fromEntries(network.species.map(item => [item.id, 1])), null, 2));
    setThermoReaction(network.reactions[0]?.id ?? '');
  }, [network]);
  const runFit = () => {
    try {
      setFit(fitFirstOrderDecay(parseObservationCsv(observations)));
      setFitError(null);
    } catch (cause) {
      setFit(null);
      setFitError(cause instanceof Error ? cause.message : 'Could not fit observations.');
    }
  };
  const runSensitivity = () => {
    try {
      const k = Number(rate), t = Number(time), n0 = Number(initial), sd = Number(rateSd);
      if (![k, t, n0, sd].every(Number.isFinite) || n0 < 0) throw new Error('Enter finite values; initial population must be non-negative.');
      setSensitivity(estimateLocalSensitivity(value => n0 * Math.exp(-value * t), k));
      setUncertainty(propagateFirstOrderRateUncertainty({
        meanRatePerSecond: k, standardDeviationRatePerSecond: sd,
        timeSeconds: t, initialValue: n0, samples: 5000, seed: 20261031,
      }));
      setAnalysisError(null);
    } catch (cause) {
      setSensitivity(null); setUncertainty(null);
      setAnalysisError(cause instanceof Error ? cause.message : 'Analysis failed.');
    }
  };
  const runThermodynamics = () => {
    try {
      const formation = JSON.parse(formationData) as Record<string, number>;
      const activities = JSON.parse(activityData) as Record<string, number>;
      const result = analyzeReactionThermodynamics({
        network, reactionId: thermoReaction,
        standardGibbsFormationJPerMol: formation,
        activities, temperatureKelvin: Number(thermoTemperature),
      });
      setThermo(result); setThermoError(null);
    } catch (cause) {
      setThermo(null); setThermoError(cause instanceof Error ? cause.message : 'Thermodynamic analysis failed.');
    }
  };
  const runStructureValidation = () => {
    try {
      const parsed = JSON.parse(structureJson);
      const charge = expectedCharge.trim() === '' ? undefined : Number(expectedCharge);
      if (charge !== undefined && !Number.isSafeInteger(charge)) throw new Error('Expected charge must be an integer.');
      setStructureResult(validateMolecularStructure(parsed, expectedFormula.trim() || undefined, charge));
      setStructureError(null);
    } catch (cause) {
      setStructureResult(null); setStructureError(cause instanceof Error ? cause.message : 'Structure validation failed.');
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-violet-900/60 bg-gradient-to-br from-zinc-950 via-zinc-950 to-violet-950/20 p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-violet-300">Research workspace / 02</p>
        <h3 className="mt-2 text-xl font-semibold">Advanced analysis & molecular methods</h3>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">
          Fit first-order observations, quantify local sensitivity and rate uncertainty, evaluate reaction thermodynamics,
          and validate explicit atom/bond graphs. Each tool reports only what its stated model supports.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <h4 className="text-sm font-semibold">Kinetic parameter estimation</h4>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500">Fit y(t) = y₀ exp(−kt). Enter one observation per line: time, value[, standard deviation]. Values must be positive.</p>
          <textarea aria-label="Kinetic observation data" rows={6} value={observations} onChange={event => setObservations(event.target.value)}
            className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 font-mono text-xs text-zinc-200 focus:border-violet-500 focus:outline-none" />
          <button onClick={runFit} className="mt-3 rounded-lg border border-violet-700 bg-violet-950/50 px-4 py-2 text-xs font-medium text-violet-200 hover:bg-violet-900/50">Fit first-order model</button>
          {fitError && <p role="alert" className="mt-2 text-xs text-rose-300">{fitError}</p>}
          {fit && <div className="mt-3 rounded-xl bg-black/30 p-3">
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div><p className="text-zinc-500">Estimated k</p><p className="mt-1 font-mono text-violet-200">{pretty(fit.rateConstantPerSecond)} s⁻¹</p></div>
              <div><p className="text-zinc-500">Initial value</p><p className="mt-1 font-mono text-zinc-200">{pretty(fit.initialValue)}</p></div>
              <div><p className="text-zinc-500">R²</p><p className="mt-1 font-mono text-zinc-200">{pretty(fit.coefficientOfDetermination, 6)}</p></div>
              <div><p className="text-zinc-500">Rate SE</p><p className="mt-1 font-mono text-zinc-200">{pretty(fit.rateConstantStandardErrorPerSecond)}</p></div>
              <div><p className="text-zinc-500">Approx. 95% interval</p><p className="mt-1 font-mono text-zinc-200">[{pretty(fit.approximateConfidenceInterval95PerSecond[0])}, {pretty(fit.approximateConfidenceInterval95PerSecond[1])}]</p></div>
              <div><p className="text-zinc-500">Fit method</p><p className="mt-1 font-mono text-zinc-200">{fit.weightedLeastSquares ? 'Weighted LS' : 'Ordinary LS'}</p></div>
            </div>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[360px] text-left text-[10px]">
              <thead className="text-zinc-500"><tr><th className="py-1">Time</th><th>Observed</th><th>Fitted</th><th>Log residual</th></tr></thead>
              <tbody>{fit.fitted.map((row, index) => <tr key={index} className="border-t border-zinc-800 text-zinc-300"><td className="py-1">{row.timeSeconds}</td><td>{pretty(row.observed)}</td><td>{pretty(row.predicted)}</td><td>{pretty(row.residualLog)}</td></tr>)}</tbody>
            </table></div>
          </div>}
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <h4 className="text-sm font-semibold">Sensitivity & uncertainty propagation</h4>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500">First-order prediction with uncertain positive rate. Monte Carlo samples a moment-matched lognormal rate distribution.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              ['Mean rate k (s⁻¹)', rate, setRate],
              ['Rate SD (s⁻¹)', rateSd, setRateSd],
              ['Time (s)', time, setTime],
              ['Initial value', initial, setInitial],
            ].map(([label, value, setter]) => <label key={String(label)} className="text-[11px] text-zinc-400">{label}
              <input type="number" step="any" value={String(value)} onChange={event => (setter as (value: string) => void)(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100" />
            </label>)}
          </div>
          <button onClick={runSensitivity} className="mt-3 rounded-lg border border-violet-700 bg-violet-950/50 px-4 py-2 text-xs font-medium text-violet-200 hover:bg-violet-900/50">Run sensitivity & uncertainty</button>
          {analysisError && <p role="alert" className="mt-2 text-xs text-rose-300">{analysisError}</p>}
          {sensitivity && uncertainty && <div className="mt-3 rounded-xl bg-black/30 p-3 text-xs">
            <p className="text-zinc-500">Local derivative / normalized elasticity</p>
            <p className="mt-1 font-mono text-violet-200">{pretty(sensitivity.absoluteSensitivity)} / {sensitivity.normalizedElasticity === null ? 'n/a' : pretty(sensitivity.normalizedElasticity)}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><p className="text-zinc-500">MC mean ± SD</p><p className="mt-1 font-mono text-zinc-200">{pretty(uncertainty.monteCarloMean)} ± {pretty(uncertainty.monteCarloStandardDeviation)}</p></div>
              <div><p className="text-zinc-500">95% prediction interval</p><p className="mt-1 font-mono text-zinc-200">[{pretty(uncertainty.predictionInterval95[0])}, {pretty(uncertainty.predictionInterval95[1])}]</p></div>
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">5,000 seeded samples · parameter uncertainty only; no observation noise or model discrepancy.</p>
          </div>}
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <h4 className="text-sm font-semibold">Reaction-network thermodynamics</h4>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500">Supply standard Gibbs formation energies (J/mol) and dimensionless activities as JSON objects keyed by species ID.</p>
          <label className="mt-3 block text-[11px] text-zinc-400">Reaction channel
            <select value={thermoReaction} onChange={event => setThermoReaction(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100">
              {reactionOptions.map(item => <option key={item.id} value={item.id}>{item.id} · {item.label}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-[11px] text-zinc-400">Temperature (K)
            <input type="number" step="any" value={thermoTemperature} onChange={event => setThermoTemperature(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100" />
          </label>
          <label className="mt-3 block text-[11px] text-zinc-400">Species standard Gibbs formation energies (J/mol)
            <textarea rows={3} value={formationData} onChange={event => setFormationData(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200" />
          </label>
          <label className="mt-3 block text-[11px] text-zinc-400">Dimensionless activities
            <textarea rows={3} value={activityData} onChange={event => setActivityData(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200" />
          </label>
          <button onClick={runThermodynamics} disabled={!reactionOptions.length} className="mt-3 rounded-lg border border-violet-700 bg-violet-950/50 px-4 py-2 text-xs font-medium text-violet-200 disabled:opacity-40">Analyse reaction thermodynamics</button>
          {thermoError && <p role="alert" className="mt-2 text-xs text-rose-300">{thermoError}</p>}
          {thermo && <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-black/30 p-3 text-xs">
            <div><p className="text-zinc-500">ΔG° (J/mol)</p><p className="mt-1 font-mono text-zinc-200">{pretty(thermo.standardGibbsEnergyJPerMol)}</p></div>
            <div><p className="text-zinc-500">ln K°</p><p className="mt-1 font-mono text-zinc-200">{pretty(thermo.logEquilibriumConstant)}</p></div>
            <div><p className="text-zinc-500">Q</p><p className="mt-1 font-mono text-zinc-200">{thermo.reactionQuotient === null ? 'Out of numeric range' : pretty(thermo.reactionQuotient)}</p></div>
            <div><p className="text-zinc-500">ΔG at activities</p><p className="mt-1 font-mono text-zinc-200">{thermo.reactionGibbsEnergyJPerMol === null ? 'n/a' : `${pretty(thermo.reactionGibbsEnergyJPerMol)} J/mol`}</p></div>
            <div className="col-span-2"><p className="text-zinc-500">Thermodynamic direction</p><p className="mt-1 font-semibold text-violet-200">{thermo.directionAtSuppliedActivities}</p></div>
          </div>}
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
          <h4 className="text-sm font-semibold">Molecular atom/bond graph validation</h4>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500">Validate an explicit molecular graph against a formula and formal charge. This does not canonicalise structures or infer chemical valence.</p>
          <label className="mt-3 block text-[11px] text-zinc-400">Structure JSON
            <textarea rows={8} value={structureJson} onChange={event => setStructureJson(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200" />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-[11px] text-zinc-400">Expected formula
              <input value={expectedFormula} onChange={event => setExpectedFormula(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100" />
            </label>
            <label className="text-[11px] text-zinc-400">Expected charge
              <input value={expectedCharge} onChange={event => setExpectedCharge(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100" />
            </label>
          </div>
          <button onClick={runStructureValidation} className="mt-3 rounded-lg border border-violet-700 bg-violet-950/50 px-4 py-2 text-xs font-medium text-violet-200">Validate molecular graph</button>
          {structureError && <p role="alert" className="mt-2 text-xs text-rose-300">{structureError}</p>}
          {structureResult && <div className="mt-3 rounded-xl bg-black/30 p-3 text-xs">
            <p className={structureResult.valid ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>{structureResult.valid ? 'Graph checks passed' : 'Graph checks failed'}</p>
            <p className="mt-1 text-zinc-400">Formula {structureResult.computedFormula || '—'} · Charge {structureResult.formalCharge} · Components {structureResult.connectedComponents}</p>
            {[...structureResult.errors, ...structureResult.warnings].map((message, index) => <p key={index} className="mt-1 text-[10px] text-amber-200">{message}</p>)}
          </div>}
        </article>
      </div>
      <MechanismFittingPanel />
      <MolecularToolkitPanel />
      <p className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-[10px] leading-5 text-amber-100/70">
        Model boundaries: the single-species estimator is limited to positive first-order decay; the multi-step fitter uses fixed initial concentrations, local bounded optimisation and fixed-step RK4 with local linear covariance; thermodynamics assumes consistent standard states and ideal dimensionless activities; the graph checker is not a replacement for the separately identified RDKit toolkit.
      </p>
    </section>
  );
};
