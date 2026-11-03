import { readFileSync } from 'node:fs';
import { importQinTratnyek2018Csv } from '../../src/research/experimentalCsv';
import { fitQinModel4, inferQinIronType, QinExperimentSeries, QinModel4Variant } from '../../src/research/qinHydrogenModel';

const csvPath = process.argv[2];
if (!csvPath) throw new Error('Usage: bun run scripts/benchmarks/profile_qin_2018_model4.ts <csv-path> [grid-points=81]');
const gridPoints = Number(process.argv[3] ?? 81);
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
const excludedModel4Ids = new Set(['64', '65', '68', '69']);
const series = [...grouped.values()].filter(s => !excludedModel4Ids.has(s.experimentId)) as QinExperimentSeries[];
if (series.length !== 31 || series.reduce((n, s) => n + s.observations.length, 0) !== 279)
  throw new Error('Expected the 31 published Model 4 conditions and all 279 time points.');

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
  initialRatesByIronType: rates, ...(model === '4G' ? { initialSharedK1PerHour: rates.Alfa.k1PerHour } : {}),
  maxIterations: 400, tolerance: 1e-10, calculateUncertainty: false,
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
  const initialRates = model === '4L' ? starts : starts4G;
  const baselineKeys = Object.keys(initialRates) as (keyof typeof initialRates)[];
  const baselineSeeds = Array.from({ length: 9 }, (_, seed) => {
    const factor = (index: number) => {
      if (seed === 0) return 1;
      if (seed === 1) return index % 2 === 0 ? 0.1 : 10;
      if (seed === 2) return index % 2 === 0 ? 10 : 0.1;
      if (seed === 3) return 0.1;
      if (seed === 4) return 10;
      if (seed === 5) return index % 2 === 0 ? 0.03 : 3;
      if (seed === 6) return index % 2 === 0 ? 3 : 0.03;
      if (seed === 7) return 0.3;
      return 3;
    };
    return Object.fromEntries(baselineKeys.map((type, index) => {
      const base = initialRates[type];
      return [type, {
        k1PerHour: Math.min(10, Math.max(1e-8, base.k1PerHour * factor(index * 2))),
        k2PerHour: Math.min(10, Math.max(1e-8, base.k2PerHour * factor(index * 2 + 1))),
      }];
    })) as typeof initialRates;
  });
  const baselineCandidates = [initialRates, ...baselineSeeds].map(seed =>
    fitQinModel4(model, series, options(model, seed)));
  const baseline = baselineCandidates.reduce<ReturnType<typeof fitQinModel4> | null>(
    (best, candidate) => candidate.converged &&
      (!best || candidate.sumSquaredResiduals < best.sumSquaredResiduals) ? candidate : best,
    null,
  );
  if (!baseline) throw new Error(model + ' baseline did not converge from any deterministic start.');
  const [group, parameterName] = parameter.split('.');
  const estimate = group === 'GLOBAL'
    ? baseline.rateConstantsPerHour.Alfa.k1PerHour
    : baseline.rateConstantsPerHour[group]?.[parameterName === 'k1PerHour' ? 'k1PerHour' : 'k2PerHour'];
  if (estimate === undefined || !Number.isFinite(estimate)) throw new Error('Could not resolve baseline parameter ' + parameter);
  const profileEstimate = Math.min(10, Math.max(1e-8, estimate));
  const n = baseline.includedObservationCount;
  const cutoff = 3.841458820694124;
  const rates = startsFromFit(baseline);
  const points = [...new Set([
    ...Array.from({ length: gridPoints }, (_, i) => {
      const logRate = Math.log(1e-8) + i * (Math.log(10) - Math.log(1e-8)) / (gridPoints - 1);
      return Math.min(10, Math.max(1e-8, Math.exp(logRate)));
    }),
    profileEstimate,
  ])].sort((a, b) => a - b);
  // The damped least-squares fitter can settle in a local basin when a
  // profiled rate is far from its baseline estimate. Use deterministic
  // multi-start conditional refits and retain the lowest converged SSE.
  // This is profile-only; it does not alter the production model fitter.
  const rateKeys = Object.keys(rates) as (keyof typeof rates)[];
  const makeSeedVariants = (baseRates: typeof rates) => Array.from({ length: 9 }, (_, seed) => {
    const factor = (index: number) => {
      if (seed === 0) return 1;
      if (seed === 1) return index % 2 === 0 ? 0.1 : 10;
      if (seed === 2) return index % 2 === 0 ? 10 : 0.1;
      if (seed === 3) return 0.1;
      if (seed === 4) return 10;
      if (seed === 5) return index % 2 === 0 ? 0.03 : 3;
      if (seed === 6) return index % 2 === 0 ? 3 : 0.03;
      if (seed === 7) return 0.3;
      return 3;
    };
    return Object.fromEntries(rateKeys.map((type, index) => {
      const base = baseRates[type];
      return [type, {
        k1PerHour: Math.min(10, Math.max(1e-8, base.k1PerHour * factor(index * 2))),
        k2PerHour: Math.min(10, Math.max(1e-8, base.k2PerHour * factor(index * 2 + 1))),
      }];
    })) as typeof rates;
  });
  // Continue from the best conditional solution at the preceding grid point,
  // while retaining the original baseline starts to reduce path dependence.
  let continuationRates = rates;
  const evaluateAt = (rate: number) => {
    let best: ReturnType<typeof fitQinModel4> | null = null;
    const seedVariants = [
      ...makeSeedVariants(rates),
      ...makeSeedVariants(continuationRates),
    ];
    for (const seed of seedVariants) {
      const fit = fitQinModel4(model, series, {
        ...options(model, seed),
        fixedRateConstantsPerHour: { [parameter]: rate },
      });
      if (fit.converged && (!best || fit.sumSquaredResiduals < best.sumSquaredResiduals))
        best = fit;
    }
    if (best) continuationRates = startsFromFit(best);
    if (!best) {
      const fallback = fitQinModel4(model, series, {
        ...options(model, rates),
        fixedRateConstantsPerHour: { [parameter]: rate },
      });
      return { ratePerHour: rate, objective: fallback.sumSquaredResiduals,
        converged: false, iterations: fallback.iterations, warnings: fallback.warnings };
    }
    return { ratePerHour: rate, objective: best.sumSquaredResiduals, converged: true,
      iterations: best.iterations, warnings: best.warnings };
  };
  const evaluations = points.map(evaluateAt);
  const profileMinimumObjective = Math.min(
    baseline.sumSquaredResiduals,
    ...evaluations.filter(point => point.converged).map(point => point.objective),
  );
  const withLikelihood = evaluations.map(p => ({
    ...p,
    likelihoodRatioStatistic: profileMinimumObjective > 0 && p.objective > 0
      ? n * Math.log(p.objective / profileMinimumObjective) : null,
  }));
  const accepted = withLikelihood.filter(p => p.converged && p.likelihoodRatioStatistic !== null &&
    p.likelihoodRatioStatistic! <= cutoff);
  const components: typeof accepted[] = [];
  let component: typeof accepted = [];
  for (const point of withLikelihood) {
    if (point.converged && point.likelihoodRatioStatistic !== null &&
        point.likelihoodRatioStatistic <= cutoff) {
      component.push(point);
    } else if (component.length) {
      components.push(component); component = [];
    }
  }
  if (component.length) components.push(component);
  const bestPoint = withLikelihood.reduce((best, point) =>
    point.converged && (point.likelihoodRatioStatistic ?? Infinity) <
      (best.likelihoodRatioStatistic ?? Infinity) ? point : best, withLikelihood[0]);
  const refineCrossing = (outside: typeof withLikelihood[number], inside: typeof withLikelihood[number], side: 'lower' | 'upper') => {
    let lo = Math.log(Math.min(outside.ratePerHour, inside.ratePerHour));
    let hi = Math.log(Math.max(outside.ratePerHour, inside.ratePerHour));
    for (let iteration = 0; iteration < 24; iteration++) {
      const mid = (lo + hi) / 2;
      const point = evaluateAt(Math.exp(mid));
      const statistic = point.converged && point.objective > 0
        ? Math.max(0, n * Math.log(point.objective / profileMinimumObjective)) : Infinity;
      const isAccepted = statistic <= cutoff;
      if (side === 'lower') {
        if (isAccepted) hi = mid; else lo = mid;
      } else {
        if (isAccepted) lo = mid; else hi = mid;
      }
    }
    return Math.exp((lo + hi) / 2);
  };
  const intervalFor = (pointsInComponent: typeof accepted) => {
    const first = pointsInComponent[0], last = pointsInComponent[pointsInComponent.length - 1];
    const firstIndex = withLikelihood.findIndex(p => p.ratePerHour === first.ratePerHour);
    const lastIndex = withLikelihood.findIndex(p => p.ratePerHour === last.ratePerHour);
    const lowerBoundaryLimited = firstIndex === 0;
    const upperBoundaryLimited = lastIndex === withLikelihood.length - 1;
    const lowerRefined = lowerBoundaryLimited ? first.ratePerHour :
      refineCrossing(withLikelihood[firstIndex - 1], first, 'lower');
    const upperRefined = upperBoundaryLimited ? last.ratePerHour :
      refineCrossing(withLikelihood[lastIndex + 1], last, 'upper');
    return {
      lowerPerHour: lowerRefined, upperPerHour: upperRefined,
      gridBracket: { lowerPerHour: first.ratePerHour, upperPerHour: last.ratePerHour },
      boundaryLimited: { lower: lowerBoundaryLimited, upper: upperBoundaryLimited },
      rootRefinementIterations: 24,
    };
  };
  const bestComponent = components.find(c => c.some(p => p.ratePerHour === bestPoint.ratePerHour));
  return {
    model, parameter, baselineEstimatePerHour: estimate,
    profileGridBestRatePerHour: bestPoint.ratePerHour,
    baselineObjective: baseline.sumSquaredResiduals,
    profileMinimumObjective,
    profileGridImprovedBaseline: profileMinimumObjective < baseline.sumSquaredResiduals - 1e-8 * (1 + baseline.sumSquaredResiduals),
    likelihoodRatioCutoff95: cutoff, observationCount: n,
    interval95GridApproximation: bestComponent ? intervalFor(bestComponent) : null,
    additionalAcceptedComponents: components.filter(c => c !== bestComponent).map(intervalFor),
    acceptedGridComponentCount: components.length,
    baselinePointIncluded: points.includes(profileEstimate),
    convergedProfilePoints: withLikelihood.filter(p => p.converged).length,
    failedProfilePoints: withLikelihood.filter(p => !p.converged).length,
    points: withLikelihood,
  };
}
const results = targets.map(t => profile(t.model, t.parameter));
console.log(JSON.stringify({
  source: 'Qin and Tratnyek 2018; Zenodo 10.5281/zenodo.1979080',
  fitSet: { selection: 'published Model 4 table set: exclude series #64, #65, #68, #69; retain all nine time points in the remaining 31 conditions', series: series.length,
    observations: 279, selectionConfirmedByAuthors: false },
  method: 'Conditional profile objective: fix one log-rate over a log-spaced grid and refit every other rate plus all per-series amplitudes.',
  intervalCalibration: 'Approximate Gaussian likelihood-ratio cutoff: n*ln(SSE_profile/SSE_min) <= chi-square(1, 0.95) = 3.84146, profiling an unknown common residual variance.',
  limitations: [
    'Grid endpoints are optimizer bounds; an interval reaching an endpoint is boundary-limited, not a closed confidence interval.',
    'Root-refined endpoints use 12 log-space bisection steps within the first grid bracket; inspect the archived profile curve and convergence flags.',
    'The LR calibration assumes independent homoscedastic Gaussian residuals and is not validated for this experimental dataset.',
    'The observation-selection convention remains inferred from published degrees of freedom and is not author-confirmed.',
  ],
  results,
}, null, 2));
