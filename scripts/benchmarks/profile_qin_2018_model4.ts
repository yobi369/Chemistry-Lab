import { readFileSync } from 'node:fs';
import { importQinTratnyek2018Csv } from '../../src/research/experimentalCsv';
import { fitQinModel4, inferQinIronType, QinExperimentSeries, QinModel4Variant } from '../../src/research/qinHydrogenModel';

const csvPath = process.argv[2];
if (!csvPath) throw new Error('Usage: bun run scripts/benchmarks/profile_qin_2018_model4.ts <csv-path> [grid-points=41]');
const gridPoints = Number(process.argv[3] ?? 41);
if (!Number.isSafeInteger(gridPoints) || gridPoints < 21 || gridPoints > 101 || gridPoints % 2 === 0)
  throw new Error('Grid points must be an odd integer from 21 to 101.');

const imported = importQinTratnyek2018Csv(readFileSync(csvPath, 'utf8'));
const grouped = new Map<string, { experimentId: string; label: string; ironType: ReturnType<typeof inferQinIronType>; observations: { timeHours: number; hydrogenMicromoles: number; standardDeviationMicromoles: number }[] }>();
for (const measurement of imported.measurements) {
  let group = grouped.get(measurement.experimentId);
  if (!group) {
    group = { experimentId: measurement.experimentId, label: measurement.experimentLabel,
      ironType: inferQinIronType(measurement.experimentLabel), observations: [] };
    grouped.set(measurement.experimentId, group);
  }
  group.observations.push({ timeHours: measurement.timeHours,
    hydrogenMicromoles: measurement.hydrogenMicromoles,
    standardDeviationMicromoles: measurement.standardDeviationMicromoles });
}
const series = [...grouped.values()].map(s => ({
  ...s, observations: s.observations.filter(o => o.timeHours > 0 || s.ironType === 'CMC-nZVI'),
})) as QinExperimentSeries[];
if (series.length !== 35 || series.reduce((n, s) => n + s.observations.length, 0) !== 287)
  throw new Error('Expected the documented candidate fit set of 35 series and 287 observations.');

const starts = {
  Alfa: { k1PerHour: 0.4113, k2PerHour: 0.0076 },
  Beijing: { k1PerHour: 0.1338, k2PerHour: 0.0008 },
  Hepure: { k1PerHour: 0.4575, k2PerHour: 0.0010 },
  Toda: { k1PerHour: 0.0358, k2PerHour: 0.0054 },
  'CMC-nZVI': { k1PerHour: 0.4838, k2PerHour: 0.0117 },
};
const starts4G = {
  Alfa: { k1PerHour: 0.4719, k2PerHour: 0.0081 },
  Beijing: { k1PerHour: 0.4719, k2PerHour: 0.0032 },
  Hepure: { k1PerHour: 0.4719, k2PerHour: 0.0009 },
  Toda: { k1PerHour: 0.4719, k2PerHour: 0.0170 },
  'CMC-nZVI': { k1PerHour: 0.4719, k2PerHour: 0.0114 },
};
const options = (model: QinModel4Variant, rates = model === '4L' ? starts : starts4G) => ({
  weighting: 'unweighted' as const, zeroStandardDeviation: 'unweighted' as const,
  initialRatesByIronType: rates, ...(model === '4G' ? { initialSharedK1PerHour: 0.4719 } : {}),
  maxIterations: 240, tolerance: 1e-8, calculateUncertainty: false,
});
const targets = [
  { model: '4L' as const, parameter: 'Beijing.k2PerHour' },
  { model: '4L' as const, parameter: 'Hepure.k2PerHour' },
  { model: '4G' as const, parameter: 'Beijing.k2PerHour' },
  { model: '4G' as const, parameter: 'Hepure.k2PerHour' },
];
function startsFromFit(fit: ReturnType<typeof fitQinModel4>) {
  return Object.fromEntries(Object.entries(fit.rateConstantsPerHour).map(([type, r]) => [type, r])) as typeof starts;
}
function profile(model: QinModel4Variant, parameter: string) {
  const baseline = fitQinModel4(model, series, options(model));
  if (!baseline.converged) throw new Error(model + ' baseline did not converge: ' + baseline.warnings.join('; '));
  const [group, parameterName] = parameter.split('.');
  const estimate = group === 'GLOBAL'
    ? baseline.rateConstantsPerHour.Alfa.k1PerHour
    : baseline.rateConstantsPerHour[group]?.[parameterName === 'k1PerHour' ? 'k1PerHour' : 'k2PerHour'];
  if (!Number.isFinite(estimate)) throw new Error('Could not resolve baseline parameter ' + parameter);
  const n = baseline.includedObservationCount;
  const cutoff = 3.841458820694124;
  const rates = startsFromFit(baseline);
  const points = Array.from({ length: gridPoints }, (_, i) => {
    const logRate = Math.log(1e-8) + i * (Math.log(10) - Math.log(1e-8)) / (gridPoints - 1);
    return Math.exp(logRate);
  });
  const evaluations = points.map(rate => {
    const fit = fitQinModel4(model, series, {
      ...options(model, rates),
      fixedRateConstantsPerHour: { [parameter]: rate },
    });
    return { ratePerHour: rate, objective: fit.sumSquaredResiduals, converged: fit.converged,
      iterations: fit.iterations, warnings: fit.warnings };
  });
  const minObjective = baseline.sumSquaredResiduals;
  const withLikelihood = evaluations.map(p => ({
    ...p,
    likelihoodRatioStatistic: minObjective > 0 && p.objective > 0 ? n * Math.log(p.objective / minObjective) : null,
  }));
  const accepted = withLikelihood.filter(p => p.likelihoodRatioStatistic !== null &&
    p.likelihoodRatioStatistic! <= cutoff);
  const lower = accepted.length ? accepted[0].ratePerHour : null;
  const upper = accepted.length ? accepted[accepted.length - 1].ratePerHour : null;
  const boundaryLimited = {
    lower: lower === points[0],
    upper: upper === points[points.length - 1],
  };
  return {
    model, parameter, estimatePerHour: estimate, baselineObjective: minObjective,
    likelihoodRatioCutoff95: cutoff, observationCount: n,
    interval95GridApproximation: { lowerPerHour: lower, upperPerHour: upper, boundaryLimited },
    convergedProfilePoints: withLikelihood.filter(p => p.converged).length,
    failedProfilePoints: withLikelihood.filter(p => !p.converged).length,
    points: withLikelihood,
  };
}
const results = targets.map(t => profile(t.model, t.parameter));
console.log(JSON.stringify({
  source: 'Qin and Tratnyek 2018; Zenodo 10.5281/zenodo.1979080',
  fitSet: { selection: 'candidate-inferred: t>0 except all CMC-nZVI times', series: series.length,
    observations: 287, selectionConfirmedByAuthors: false },
  method: 'Conditional profile objective: fix one log-rate over a log-spaced grid and refit every other rate plus all per-series amplitudes.',
  intervalCalibration: 'Approximate Gaussian likelihood-ratio cutoff: n*ln(SSE_profile/SSE_min) <= chi-square(1, 0.95) = 3.84146, profiling an unknown common residual variance.',
  limitations: [
    'Grid endpoints are optimizer bounds; an interval reaching an endpoint is boundary-limited, not a closed confidence interval.',
    'Grid interval endpoints are approximate and should be refined by root finding after bracketing.',
    'The LR calibration assumes independent homoscedastic Gaussian residuals and is not validated for this experimental dataset.',
    'The observation-selection convention remains inferred from published degrees of freedom and is not author-confirmed.',
  ],
  results,
}, null, 2));
