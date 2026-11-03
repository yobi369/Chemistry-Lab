import { readFileSync } from 'node:fs';
import { importQinTratnyek2018Csv } from '../../src/research/experimentalCsv';
import { fitQinModel4, inferQinIronType, QinExperimentSeries } from '../../src/research/qinHydrogenModel';

const path = process.argv[2];
if (!path) throw new Error('Usage: bun run scripts/benchmarks/fit_qin_2018_dataset.ts <csv-path>');
const csv = readFileSync(path, 'utf8');
const dataset = importQinTratnyek2018Csv(csv);
const grouped = new Map<string, { experimentId: string; label: string; ironType: ReturnType<typeof inferQinIronType>; observations: { timeHours: number; hydrogenMicromoles: number; standardDeviationMicromoles: number }[] }>();
for (const m of dataset.measurements) {
  let group = grouped.get(m.experimentId);
  if (!group) {
    group = { experimentId: m.experimentId, label: m.experimentLabel, ironType: inferQinIronType(m.experimentLabel), observations: [] };
    grouped.set(m.experimentId, group);
  }
  group.observations.push({
    timeHours: m.timeHours, hydrogenMicromoles: m.hydrogenMicromoles,
    standardDeviationMicromoles: m.standardDeviationMicromoles,
  });
}
const allSeries = [...grouped.values()] as QinExperimentSeries[];
// Candidate reconstruction of the paper's fit set: 35 series, all t>0 records,
// plus the seven CMC-nZVI t=0 records. This is inferred from the published df
// counts (287 observations for 4L/4G), and is explicitly labelled as a hypothesis.
const candidateSeries = allSeries.map(s => ({
  ...s,
  observations: s.observations.filter(o => o.timeHours > 0 || s.ironType === 'CMC-nZVI'),
}));
const candidateCount = candidateSeries.reduce((n, s) => n + s.observations.length, 0);
if (candidateCount !== 287) throw new Error('Candidate selection expected 287 points from published df arithmetic; got ' + candidateCount);
const initialRatesByIronType = {
  Alfa: { k1PerHour: 0.41, k2PerHour: 0.0076 },
  Beijing: { k1PerHour: 0.13, k2PerHour: 0.0008 },
  Hepure: { k1PerHour: 0.2, k2PerHour: 0.005 },
  Toda: { k1PerHour: 0.2, k2PerHour: 0.003 },
  'CMC-nZVI': { k1PerHour: 0.4, k2PerHour: 0.01 },
};
const options = { weighting: 'standard-deviation' as const, zeroStandardDeviation: 'unweighted' as const, initialRatesByIronType };
const fit4L = fitQinModel4('4L', candidateSeries, options);
const fit4G = fitQinModel4('4G', candidateSeries, { ...options, initialSharedK1PerHour: 0.4 });
const alfaBlank4L = fit4L.localAmplitudesMicromoles['35'];
const alfaBlank4G = fit4G.localAmplitudesMicromoles['35'];
console.log(JSON.stringify({
  source: '10.5281/zenodo.1979080',
  selection: 'candidate-inferred: t>0 for 28 non-CMC series; all 9 points for 7 CMC-nZVI series',
  selectionIsConfirmedByAuthors: false,
  totalSeries: allSeries.length,
  totalRawMeasurements: dataset.audit.measurementCount,
  candidateFitPoints: candidateCount,
  model4L: {
    converged: fit4L.converged, iterations: fit4L.iterations,
    parameterCount: fit4L.parameterCount, degreesOfFreedom: fit4L.degreesOfFreedom,
    weightedResidualSumSquares: fit4L.weightedResidualSumSquares,
    reducedChiSquare: fit4L.reducedChiSquare,
    ratesByIronType: fit4L.rateConstantsPerHour,
    alfaBlank: alfaBlank4L,
    identifiable: fit4L.locallyIdentifiable,
    conditionNumber: fit4L.informationConditionNumber,
    warnings: fit4L.warnings,
  },
  model4G: {
    converged: fit4G.converged, iterations: fit4G.iterations,
    parameterCount: fit4G.parameterCount, degreesOfFreedom: fit4G.degreesOfFreedom,
    weightedResidualSumSquares: fit4G.weightedResidualSumSquares,
    reducedChiSquare: fit4G.reducedChiSquare,
    ratesByIronType: fit4G.rateConstantsPerHour,
    alfaBlank: alfaBlank4G,
    identifiable: fit4G.locallyIdentifiable,
    conditionNumber: fit4G.informationConditionNumber,
    warnings: fit4G.warnings,
  },
  publishedTargets: {
    model4L: { reducedChiSquare: 1.6, degreesOfFreedom: 207, alfaBlank: { A: 2.2245, k1PerHour: 0.4113, B: 20.5425, k2PerHour: 0.0076 } },
    model4G: { reducedChiSquare: 3.8, degreesOfFreedom: 211, alfaBlank: { A: 2.1025, k1PerHour: 0.4719, B: 19.8775, k2PerHour: 0.0081 } },
  },
}, null, 2));
