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
function summarize(fit: ReturnType<typeof fitQinModel4>) {
  return {
    converged: fit.converged, iterations: fit.iterations,
    parameterCount: fit.parameterCount, degreesOfFreedom: fit.degreesOfFreedom,
    sumSquaredResiduals: fit.sumSquaredResiduals,
    weightedResidualSumSquares: fit.weightedResidualSumSquares,
    reducedChiSquare: fit.reducedChiSquare,
    ratesByIronType: fit.rateConstantsPerHour,
    alfaBlank: fit.localAmplitudesMicromoles['35'],
    identifiable: fit.locallyIdentifiable,
    conditionNumber: fit.informationConditionNumber,
    warnings: fit.warnings,
  };
}
const fit4LWeighted = fitQinModel4('4L', candidateSeries, {
  weighting: 'standard-deviation', zeroStandardDeviation: 'unweighted',
  initialRatesByIronType,
});
const fit4GWeighted = fitQinModel4('4G', candidateSeries, {
  weighting: 'standard-deviation', zeroStandardDeviation: 'unweighted',
  initialRatesByIronType: initialRates4G, initialSharedK1PerHour: 0.4719,
});
const fit4LUnweighted = fitQinModel4('4L', candidateSeries, {
  weighting: 'unweighted', zeroStandardDeviation: 'unweighted',
  initialRatesByIronType,
});
const fit4GUnweighted = fitQinModel4('4G', candidateSeries, {
  weighting: 'unweighted', zeroStandardDeviation: 'unweighted',
  initialRatesByIronType: initialRates4G, initialSharedK1PerHour: 0.4719,
});
console.log(JSON.stringify({
  source: '10.5281/zenodo.1979080',
  selection: 'candidate-inferred: t>0 for 28 non-CMC series; all 9 points for 7 CMC-nZVI series',
  selectionIsConfirmedByAuthors: false,
  totalSeries: allSeries.length,
  totalRawMeasurements: dataset.audit.measurementCount,
  candidateFitPoints: candidateCount,
  paperSeededFits: {
    model4L_SD_weighted: summarize(fit4LWeighted),
    model4G_SD_weighted: summarize(fit4GWeighted),
    model4L_unweighted: summarize(fit4LUnweighted),
    model4G_unweighted: summarize(fit4GUnweighted),
  },
  publishedTargets: {
    model4L: { reducedChiSquare: 1.6, degreesOfFreedom: 207, alfaBlank: { A: 2.2245, k1PerHour: 0.4113, B: 20.5425, k2PerHour: 0.0076 } },
    model4G: { reducedChiSquare: 3.8, degreesOfFreedom: 211, alfaBlank: { A: 2.1025, k1PerHour: 0.4719, B: 19.8775, k2PerHour: 0.0081 } },
  },
}, null, 2));
