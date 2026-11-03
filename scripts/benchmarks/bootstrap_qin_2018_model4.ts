import { readFileSync } from 'node:fs';
import { importQinTratnyek2018Csv } from '../../src/research/experimentalCsv';
import { createSeededRandom, summarizeBootstrap } from '../../src/research/bootstrapStatistics';
import { fitQinModel4, inferQinIronType, QinExperimentSeries, QinModel4Variant } from '../../src/research/qinHydrogenModel';

const path = process.argv[2];
if (!path) throw new Error('Usage: bun run scripts/benchmarks/bootstrap_qin_2018_model4.ts <csv-path> [replicates=40] [seed=20261103]');
const replicates = Number(process.argv[3] ?? 40);
const seed = Number(process.argv[4] ?? 20261103);
if (!Number.isSafeInteger(replicates) || replicates < 20 || replicates > 500)
  throw new Error('Replicates must be an integer between 20 and 500.');
const random = createSeededRandom(seed);
const dataset = importQinTratnyek2018Csv(readFileSync(path, 'utf8'));
const grouped = new Map<string, { experimentId: string; label: string; ironType: ReturnType<typeof inferQinIronType>; observations: { timeHours: number; hydrogenMicromoles: number; standardDeviationMicromoles: number }[] }>();
for (const measurement of dataset.measurements) {
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
const sourceSeries = [...grouped.values()].filter(series => !excludedModel4Ids.has(series.experimentId)) as QinExperimentSeries[];
if (sourceSeries.length !== 31 || sourceSeries.reduce((n, s) => n + s.observations.length, 0) !== 279)
  throw new Error('Expected the 31 published Model 4 conditions and all 279 time points.');

const initialRatesByIronType = {
  Alfa: { k1PerHour: 0.4113, k2PerHour: 0.0076 },
  Beijing: { k1PerHour: 0.1338, k2PerHour: 0.0008 },
  Hepure: { k1PerHour: 0.4575, k2PerHour: 0.0010 },
  Toda: { k1PerHour: 0.0358, k2PerHour: 0.0054 },
  'CMC-nZVI': { k1PerHour: 0.4838, k2PerHour: 0.0117 },
};
const initialRates4G = {
  Alfa: { k1PerHour: 0.4719, k2PerHour: 0.0081 },
  Beijing: { k1PerHour: 0.4719, k2PerHour: 0.0032 },
  Hepure: { k1PerHour: 0.4719, k2PerHour: 0.0009 },
  Toda: { k1PerHour: 0.4719, k2PerHour: 0.0170 },
  'CMC-nZVI': { k1PerHour: 0.4719, k2PerHour: 0.0114 },
};
const fitOptions = (variant: QinModel4Variant, calculateUncertainty = false) => ({
  weighting: 'unweighted' as const,
  zeroStandardDeviation: 'unweighted' as const,
  initialRatesByIronType: variant === '4L' ? initialRatesByIronType : initialRates4G,
  ...(variant === '4G' ? { initialSharedK1PerHour: 0.4719 } : {}),
  maxIterations: 180,
  tolerance: 1e-7,
  calculateUncertainty,
});
function stratifiedClusterSample(replicate: number): QinExperimentSeries[] {
  const byType = new Map<string, QinExperimentSeries[]>();
  for (const series of sourceSeries) {
    const group = byType.get(series.ironType) ?? [];
    group.push(series); byType.set(series.ironType, group);
  }
  const sampled: QinExperimentSeries[] = [];
  for (const group of byType.values()) {
    for (let draw = 0; draw < group.length; draw++) {
      const selected = group[Math.floor(random() * group.length)];
      sampled.push({ ...selected, experimentId: selected.experimentId + '-boot-' + replicate + '-' + draw });
    }
  }
  return sampled;
}
function parameterValues(variant: QinModel4Variant, rates: ReturnType<typeof fitQinModel4>['rateConstantsPerHour']): Record<string, number> {
  const result: Record<string, number> = {};
  if (variant === '4G') result['GLOBAL.k1PerHour'] = rates.Alfa.k1PerHour;
  for (const [ironType, values] of Object.entries(rates)) {
    if (variant === '4L') result[ironType + '.k1PerHour'] = values.k1PerHour;
    result[ironType + '.k2PerHour'] = values.k2PerHour;
  }
  return result;
}
function run(variant: QinModel4Variant) {
  const baseline = fitQinModel4(variant, sourceSeries, fitOptions(variant, true));
  if (!baseline.converged) throw new Error(variant + ' baseline fit did not converge.');
  const baselineValues = parameterValues(variant, baseline.rateConstantsPerHour);
  const samples: Record<string, number[]> = Object.fromEntries(Object.keys(baselineValues).map(key => [key, []]));
  const lowerBoundHits: Record<string, number> = Object.fromEntries(Object.keys(baselineValues).map(key => [key, 0]));
  const upperBoundHits: Record<string, number> = Object.fromEntries(Object.keys(baselineValues).map(key => [key, 0]));
  let convergedReplicates = 0, failedReplicates = 0;
  for (let replicate = 0; replicate < replicates; replicate++) {
    try {
      const fit = fitQinModel4(variant, stratifiedClusterSample(replicate), fitOptions(variant));
      if (!fit.converged) { failedReplicates++; continue; }
      const values = parameterValues(variant, fit.rateConstantsPerHour);
      if (Object.keys(samples).some(key => !Number.isFinite(values[key]))) { failedReplicates++; continue; }
      for (const key of Object.keys(samples)) {
        samples[key].push(values[key]);
        if (values[key] <= 1e-8 * (1 + 1e-6)) lowerBoundHits[key]++;
        if (values[key] >= 10 * (1 - 1e-6)) upperBoundHits[key]++;
      }
      convergedReplicates++;
    } catch {
      failedReplicates++;
    }
  }
  const minimum = Math.ceil(replicates * 0.8);
  if (convergedReplicates < minimum)
    throw new Error(variant + ' bootstrap produced only ' + convergedReplicates + '/' + replicates +
      ' converged fits; at least ' + minimum + ' are required.');
  return {
    baselineObjective: baseline.sumSquaredResiduals,
    baselineRates: baselineValues,
    baselineWarnings: baseline.warnings,
    parameterBounds: { lower: 1e-8, upper: 10, units: 'h^-1' },
    lowerBoundHitCounts: lowerBoundHits,
    upperBoundHitCounts: upperBoundHits,
    intervals95: Object.fromEntries(Object.entries(samples).map(([key, values]) =>
      [key, summarizeBootstrap(values, baselineValues[key], minimum)])),
    requestedReplicates: replicates, convergedReplicates, failedReplicates,
    seed, resamplingUnit: 'experimental series, stratified within iron type',
  };
}
console.log(JSON.stringify({
  source: '10.5281/zenodo.1979080',
  fitSet: { selection: 'published Model 4 table set: exclude series #64, #65, #68, #69; retain all nine time points in the remaining 31 conditions', series: sourceSeries.length, observations: 279,
    selectionConfirmedByAuthors: false },
  uncertaintyMethod: 'Stratified nonparametric cluster bootstrap over experimental conditions; within-series time points remain intact.',
  limitations: [
    'Intervals quantify sensitivity to resampling the available experimental conditions, not measurement-noise uncertainty or a Bayesian posterior.',
    'The stratification and model-specific observation set are reconstructed from published table coverage and degrees of freedom, not confirmed author fitting files.',
    'Weakly identified rates may have asymmetric, boundary-limited or multimodal bootstrap distributions; percentile intervals do not remove those limitations.',
  ],
  model4L: run('4L'),
  model4G: run('4G'),
}, null, 2));
