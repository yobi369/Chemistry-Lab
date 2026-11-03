import { readFileSync } from 'node:fs';
import { importQinTratnyek2018Csv } from '../../src/research/experimentalCsv';
import { fitQinModel4, inferQinIronType, QinExperimentSeries, QinModel4Variant } from '../../src/research/qinHydrogenModel';

const csvPath = process.argv[2];
if (!csvPath) throw new Error('Usage: bun run scripts/benchmarks/audit_qin_2018_model4_observation_selection.ts <csv-path>');
const dataset = importQinTratnyek2018Csv(readFileSync(csvPath, 'utf8'));
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
const allSeries = [...grouped.values()] as QinExperimentSeries[];
const excludedIds = new Set(['64', '65', '68', '69']);
const paperTable31 = allSeries.filter(s => !excludedIds.has(s.experimentId));
const inferred35_287 = allSeries.map(s => ({
  ...s, observations: s.observations.filter(o => o.timeHours > 0 || s.ironType === 'CMC-nZVI'),
}));
const full35 = allSeries;
const candidates = [
  { name: '31-series / 279-point table candidate', series: paperTable31,
    hypothesis: 'Exclude four CMC-nZVI dithionite/thiosulfite series; retain all nine time points in each remaining series.' },
  { name: '35-series / 287-point reconstructed candidate', series: inferred35_287,
    hypothesis: 'Retain all 35 series; remove t=0 for 28 non-CMC series and retain all seven CMC-nZVI series.' },
  { name: '35-series / 315-point raw candidate', series: full35,
    hypothesis: 'Retain all 35 series and all nine time points.' },
];
const initialRates4L = {
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
const blankIds = { Alfa: '35', Beijing: '33', Hepure: '48', Toda: '54', 'CMC-nZVI': '63' };
const targets = {
  '4L': {
    Alfa: { A: 2.2245, B: 20.5425, k1: 0.4113, k2: 0.0076 },
    Beijing: { A: 1.9074, B: 73.5162, k1: 0.1338, k2: 0.0008 },
    Hepure: { A: 1.9806, B: 201.2470, k1: 0.4575, k2: 0.0010 },
    Toda: { A: 101.3740, B: 16.0141, k1: 0.0358, k2: 0.0054 },
    'CMC-nZVI': { A: 150.8590, B: 229.5700, k1: 0.4838, k2: 0.0117 },
  },
  '4G': {
    Alfa: { A: 2.1025, B: 19.8775, k1: 0.4719, k2: 0.0081 },
    Beijing: { A: 1.0925, B: 23.0687, k1: 0.4719, k2: 0.0032 },
    Hepure: { A: 1.9809, B: 218.8110, k1: 0.4719, k2: 0.0009 },
    Toda: { A: 12.9154, B: 117.4120, k1: 0.4719, k2: 0.0170 },
    'CMC-nZVI': { A: 152.1190, B: 230.8050, k1: 0.4719, k2: 0.0114 },
  },
};
function runCandidate(name: string, hypothesis: string, series: readonly QinExperimentSeries[]) {
  const count = series.reduce((n, s) => n + s.observations.length, 0);
  const fits = (['4L', '4G'] as const).map((model: QinModel4Variant) => {
    const fit = fitQinModel4(model, series, {
      weighting: 'unweighted', zeroStandardDeviation: 'unweighted',
      initialRatesByIronType: model === '4L' ? initialRates4L : initialRates4G,
      ...(model === '4G' ? { initialSharedK1PerHour: 0.4719 } : {}),
      maxIterations: 400, tolerance: 1e-10,
    });
    const blankFits = Object.fromEntries(Object.entries(blankIds).map(([iron, id]) => {
      const amplitude = fit.localAmplitudesMicromoles[id];
      const rate = fit.rateConstantsPerHour[iron];
      const target = targets[model][iron as keyof typeof targets['4L']];
      return [iron, amplitude ? {
        A: amplitude.A, B: amplitude.B, k1PerHour: rate.k1PerHour, k2PerHour: rate.k2PerHour,
        target, absoluteErrors: {
          A: Math.abs(amplitude.A - target.A), B: Math.abs(amplitude.B - target.B),
          k1: Math.abs(rate.k1PerHour - target.k1), k2: Math.abs(rate.k2PerHour - target.k2),
        },
      } : null];
    }));
    return {
      model, converged: fit.converged, sumSquaredResiduals: fit.sumSquaredResiduals,
      reducedChiSquare: fit.reducedChiSquare, parameterCount: fit.parameterCount,
      degreesOfFreedom: fit.degreesOfFreedom, warnings: fit.warnings,
      rateConstantsPerHour: fit.rateConstantsPerHour, blankFits,
      matchesPublishedDegreesOfFreedom: fit.degreesOfFreedom === (model === '4L' ? 207 : 211),
    };
  });
  return { name, hypothesis, seriesCount: series.length, observationCount: count, fits };
}
console.log(JSON.stringify({
  source: 'Qin et al. 2018; DOI 10.1021/acs.est.8b04436; raw dataset DOI 10.5281/zenodo.1979080',
  rawData: { series: allSeries.length, observations: dataset.audit.measurementCount,
    observationsPerSeries: [...new Set(allSeries.map(s => s.observations.length))] },
  publishedTargets: {
    model4L: { reducedChiSquareRounded: 1.6, degreesOfFreedom: 207, fittedParameters: 72,
      localConditionsInTablesS5S6: 31 },
    model4G: { reducedChiSquareRounded: 3.8, degreesOfFreedom: 211, fittedParameters: 68,
      localConditionsInTablesS5S6: 31 },
  },
  candidates: candidates.map(c => runCandidate(c.name, c.hypothesis, c.series)),
  interpretation: [
    'The degrees-of-freedom equation alone cannot distinguish 31 series × 9 observations from 35 series × 287 observations because the local-parameter count changes with the number of series.',
    'The published Model 4 Tables S5 and S6 list 31 local experimental conditions, not 35. Their condition list excludes CMC-nZVI dithionite/thiosulfite series #64, #65, #68 and #69.',
    'The 31-condition candidate is supported by the published Table S5/S6 row count, fitted-parameter count, degrees of freedom and rounded reduced chi-square values. Beijing/Hepure blank coefficients remain sensitive to non-unique phase-2 minima and do not reproduce exactly from the current optimizer starts.',
    'The paper and SI do not explicitly state the row-level timepoint inclusion rule or publish the original fitting project; direct author confirmation is still required for definitive provenance.',
  ],
}, null, 2));
