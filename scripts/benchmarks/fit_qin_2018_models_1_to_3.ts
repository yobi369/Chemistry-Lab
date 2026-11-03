import { readFileSync } from 'node:fs';
import { importQinTratnyek2018Csv } from '../../src/research/experimentalCsv';
import { fitQinAlternativeModel, QinAlternativeFit } from '../../src/research/qinHydrogenModels';
import { inferQinIronType, QinExperimentSeries } from '../../src/research/qinHydrogenModel';

const path = process.argv[2];
if (!path) throw new Error('Usage: bun run scripts/benchmarks/fit_qin_2018_models_1_to_3.ts <csv-path>');
const dataset = importQinTratnyek2018Csv(readFileSync(path, 'utf8'));
const grouped = new Map<string, { experimentId: string; label: string; ironType: ReturnType<typeof inferQinIronType>; observations: { timeHours: number; hydrogenMicromoles: number; standardDeviationMicromoles: number }[] }>();
for (const m of dataset.measurements) {
  let s = grouped.get(m.experimentId);
  if (!s) {
    s = { experimentId: m.experimentId, label: m.experimentLabel, ironType: inferQinIronType(m.experimentLabel), observations: [] };
    grouped.set(m.experimentId, s);
  }
  s.observations.push({ timeHours: m.timeHours, hydrogenMicromoles: m.hydrogenMicromoles, standardDeviationMicromoles: m.standardDeviationMicromoles });
}
// Tables S2–S4 contain the 31-condition model set; the four CMC-nZVI
// dithionite/thiosulfate conditions are included in the later Model 4 tables.
const excludedIds = new Set(['64', '65', '68', '69']);
const modelSeries = [...grouped.values()].filter(s => !excludedIds.has(s.experimentId)) as QinExperimentSeries[];
const pointCount = modelSeries.reduce((n, s) => n + s.observations.length, 0);
if (modelSeries.length !== 31 || pointCount !== 279)
  throw new Error('Expected the 31-series / 279-point Models 1–3 source set, got ' + modelSeries.length + ' series and ' + pointCount + ' points.');

const model1Rates = {
  Alfa: { k1PerHour: 0.0235, k2PerHour: 0.008 },
  Beijing: { k1PerHour: 0.0093, k2PerHour: 0.008 },
  Hepure: { k1PerHour: 0.0054, k2PerHour: 0.008 },
  Toda: { k1PerHour: 0.0223, k2PerHour: 0.008 },
  'CMC-nZVI': { k1PerHour: 0.1367, k2PerHour: 0.008 },
};
const model2Rates = {
  Alfa: { k1PerHour: 0.2072, k2PerHour: 0.008 },
  Beijing: { k1PerHour: 0.1242, k2PerHour: 0.008 },
  Hepure: { k1PerHour: 0.3226, k2PerHour: 0.008 },
  Toda: { k1PerHour: 0.0297, k2PerHour: 0.008 },
  'CMC-nZVI': { k1PerHour: 0.3489, k2PerHour: 0.008 },
};
const model2Ratios = { Alfa: 11.7471, Beijing: 4.0321, Hepure: 4.8621, Toda: 12.8096, 'CMC-nZVI': 48.8760 };
const model3Rates = {
  Alfa: { k1PerHour: 0.4000, k2PerHour: 0.0074 },
  Beijing: { k1PerHour: 0.1234, k2PerHour: 0.0002 },
  Hepure: { k1PerHour: 0.3383, k2PerHour: 0.0002 },
  Toda: { k1PerHour: 0.0628, k2PerHour: 0.0151 },
  'CMC-nZVI': { k1PerHour: 0.4810, k2PerHour: 0.0115 },
};
const model3Ratios = { Alfa: 9.4411, Beijing: 4.0006, Hepure: 4.8845, Toda: 1.8642, 'CMC-nZVI': 27.8439 };
const options = { weighting: 'unweighted' as const, zeroStandardDeviation: 'unweighted' as const };
const fit1 = fitQinAlternativeModel('1', modelSeries, { ...options, initialRatesByIronType: model1Rates });
const fit2 = fitQinAlternativeModel('2', modelSeries, { ...options, initialRatesByIronType: model2Rates, initialRatiosByIronType: model2Ratios });
const fit3 = fitQinAlternativeModel('3', modelSeries, { ...options, initialRatesByIronType: model3Rates, initialRatiosByIronType: model3Ratios });

function summarize(fit: QinAlternativeFit) {
  return {
    converged: fit.converged, iterations: fit.iterations, parameterCount: fit.parameterCount,
    degreesOfFreedom: fit.degreesOfFreedom, sumSquaredResiduals: fit.sumSquaredResiduals,
    reducedChiSquare: fit.reducedChiSquare, reducedChiSquareConvention: fit.reducedChiSquareConvention,
    globalParameters: fit.rateParametersByIronType,
    alfaBlankLocalScale: fit.localScaleParameters['35'],
    identifiable: fit.locallyIdentifiable, conditionNumber: fit.informationConditionNumber,
    alfaBlankStandardErrors: fit.standardErrors ? { localScale: fit.standardErrors['35.localScale'], k1PerHour: fit.standardErrors['Alfa.k1PerHour'], k2PerHour: fit.standardErrors['Alfa.k2PerHour'], ratio: fit.standardErrors['Alfa.ratio'] } : null,
    warnings: fit.warnings,
  };
}
if (fit1.degreesOfFreedom !== 243 || fit2.degreesOfFreedom !== 238 || fit3.degreesOfFreedom !== 233)
  throw new Error('Qin Models 1–3 degrees-of-freedom reproduction failed.');
if (Math.abs((fit1.reducedChiSquare ?? NaN) - 45) > 5)
  throw new Error('Model 1 reduced statistic does not match the published value 45.');
if (Math.abs((fit2.reducedChiSquare ?? NaN) - 7.2) > 1.0)
  throw new Error('Model 2 reduced statistic does not match the published value 7.2.');
if (Math.abs((fit3.reducedChiSquare ?? NaN) - 5.3) > 1.0)
  throw new Error('Model 3 reduced statistic does not match the published value 5.3.');

if (Math.abs(fit1.rateParametersByIronType.Alfa.k1PerHour - 0.0235) > 0.001 ||
    Math.abs(fit1.localScaleParameters['35'] - 14.1787) > 0.2)
  throw new Error('Model 1 Alfa blank parameters do not match Table S2.');
if (Math.abs(fit2.rateParametersByIronType.Alfa.k1PerHour - 0.2072) > 0.005 ||
    Math.abs(fit2.rateParametersByIronType.Alfa.ratio! - 11.7471) > 0.2 ||
    Math.abs(fit2.localScaleParameters['35'] - 0.0842) > 0.005)
  throw new Error('Model 2 Alfa blank parameters do not match Table S3.');
if (Math.abs(fit3.rateParametersByIronType.Alfa.k1PerHour - 0.4000) > 0.01 ||
    Math.abs(fit3.rateParametersByIronType.Alfa.k2PerHour! - 0.0074) > 0.0005 ||
    Math.abs(fit3.rateParametersByIronType.Alfa.ratio! - 9.4411) > 0.5 ||
    Math.abs(fit3.localScaleParameters['35'] - 0.1401) > 0.01)
  throw new Error('Model 3 Alfa blank parameters do not match Table S4.');

console.log(JSON.stringify({
  source: '10.5281/zenodo.1979080',
  selection: '31 conditions in Tables S2–S4; four CMC-nZVI dithionite/thiosulfate series excluded',
  totalSeries: modelSeries.length, totalMeasurements: pointCount,
  model1: summarize(fit1), model2: summarize(fit2), model3: summarize(fit3),
  publishedTargets: { model1: { reducedChiSquare: 45, degreesOfFreedom: 243 },
    model2: { reducedChiSquare: 7.2, degreesOfFreedom: 238 },
    model3: { reducedChiSquare: 5.3, degreesOfFreedom: 233 } },
}, null, 2));
