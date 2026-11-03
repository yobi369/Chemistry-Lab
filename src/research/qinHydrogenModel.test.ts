import test from 'node:test';
import assert from 'node:assert/strict';
import { fitQinModel4, inferQinIronType, QinExperimentSeries } from './qinHydrogenModel';

function makeSeries(id: string, ironType: 'Alfa' | 'Beijing', k1: number, k2: number, A: number, B: number): QinExperimentSeries {
  const times = [0, 2, 4, 8, 24, 48, 72, 96, 120];
  return {
    experimentId: id, label: id + ' (' + ironType + ')', ironType,
    observations: times.map(timeHours => ({
      timeHours,
      hydrogenMicromoles: A * (1 - Math.exp(-k1 * timeHours)) + B * (1 - Math.exp(-k2 * timeHours)),
      standardDeviationMicromoles: 0.1,
    })),
  };
}

test('Model 4L recovers two independently decaying phases with k values shared by iron type', () => {
  const data = [
    makeSeries('a1', 'Alfa', 0.42, 0.008, 2.2, 20.5),
    makeSeries('a2', 'Alfa', 0.42, 0.008, 1.2, 3.2),
    makeSeries('b1', 'Beijing', 0.14, 0.001, 1.9, 73.5),
    makeSeries('b2', 'Beijing', 0.14, 0.001, 2.7, 50.6),
  ];
  const fit = fitQinModel4('4L', data, { weighting: 'unweighted', zeroStandardDeviation: 'unweighted' });
  assert.equal(fit.converged, true);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Alfa.k1PerHour - 0.42) < 1e-4);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Alfa.k2PerHour - 0.008) < 1e-5);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Beijing.k1PerHour - 0.14) < 1e-4);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Beijing.k2PerHour - 0.001) < 1e-5);
  assert.ok(fit.sumSquaredResiduals < 1e-8);
});

test('Model 4G shares k1 globally while retaining iron-type-specific k2', () => {
  const data = [
    makeSeries('a1', 'Alfa', 0.42, 0.008, 2.2, 20.5),
    makeSeries('a2', 'Alfa', 0.42, 0.008, 1.2, 3.2),
    makeSeries('b1', 'Beijing', 0.42, 0.001, 1.9, 73.5),
    makeSeries('b2', 'Beijing', 0.42, 0.001, 2.7, 50.6),
  ];
  const fit = fitQinModel4('4G', data, { weighting: 'unweighted', zeroStandardDeviation: 'unweighted' });
  assert.equal(fit.converged, true);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Alfa.k1PerHour - 0.42) < 1e-4);
  assert.equal(fit.rateConstantsPerHour.Alfa.k1PerHour, fit.rateConstantsPerHour.Beijing.k1PerHour);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Alfa.k2PerHour - 0.008) < 1e-5);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Beijing.k2PerHour - 0.001) < 1e-5);
});

test('SD weighting exposes zero-SD exclusions and degrees of freedom', () => {
  const series = makeSeries('a1', 'Alfa', 0.42, 0.008, 2.2, 20.5);
  const observations = series.observations.map((o, i) => i === 0 ? { ...o, standardDeviationMicromoles: 0 } : o);
  const fit = fitQinModel4('4L', [{ ...series, observations }], {
    weighting: 'standard-deviation', zeroStandardDeviation: 'exclude',
  });
  assert.equal(fit.excludedZeroStandardDeviationCount, 1);
  assert.equal(fit.includedObservationCount, 8);
  assert.equal(fit.reducedChiSquare !== null, true);
  assert.throws(() => fitQinModel4('4L', [{ ...series, observations }], {
    weighting: 'standard-deviation', zeroStandardDeviation: 'error',
  }), /Zero SD/);
});

test('near-collinear rate columns retain the valid one-phase NNLS solution', () => {
  const times = [1, 2, 4, 8, 16];
  const series: QinExperimentSeries = {
    experimentId: 'singular', label: 'singular (Alfa)', ironType: 'Alfa',
    observations: times.map(timeHours => ({
      timeHours,
      hydrogenMicromoles: 3 * -Math.expm1(-1e-8 * timeHours),
      standardDeviationMicromoles: 0.1,
    })),
  };
  const fit = fitQinModel4('4L', [series], {
    weighting: 'unweighted',
    zeroStandardDeviation: 'unweighted',
    fixedRateConstantsPerHour: {
      'Alfa.k1PerHour': 1e-8,
      'Alfa.k2PerHour': 1e-8,
    },
  });
  assert.equal(fit.converged, true);
  assert.ok(fit.sumSquaredResiduals < 1e-24);
  const amplitude = fit.localAmplitudesMicromoles.singular;
  assert.ok(Math.abs(amplitude.A + amplitude.B - 3) < 1e-8);
});

test('rejects invalid model, ids and iron labels', () => {
  const series = makeSeries('a1', 'Alfa', 0.42, 0.008, 2.2, 20.5);
  assert.throws(() => fitQinModel4('4L', [series, series], { weighting: 'unweighted', zeroStandardDeviation: 'unweighted' }), /unique/);
  assert.throws(() => inferQinIronType('unknown sample'), /Could not infer/);
  assert.equal(inferQinIronType('#64 CMC nZVI + dithionite'), 'CMC-nZVI');
});

test('bootstrap refits can skip local covariance while preserving fitted parameters', () => {
  const data = [
    makeSeries('a1', 'Alfa', 0.42, 0.008, 2.2, 20.5),
    makeSeries('a2', 'Alfa', 0.42, 0.008, 1.2, 3.2),
    makeSeries('b1', 'Beijing', 0.14, 0.001, 1.9, 73.5),
    makeSeries('b2', 'Beijing', 0.14, 0.001, 2.7, 50.6),
  ];
  const fit = fitQinModel4('4L', data, {
    weighting: 'unweighted', zeroStandardDeviation: 'unweighted',
    calculateUncertainty: false,
  });
  assert.equal(fit.converged, true);
  assert.equal(fit.covarianceMatrix, null);
  assert.equal(fit.standardErrors, null);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Alfa.k1PerHour - 0.42) < 1e-4);
  assert.ok(fit.warnings.some(warning => warning.includes('skipped by caller')));
});

test('conditional profile refit holds the requested rate exactly and refits free rates', () => {
  const data = [
    makeSeries('a1', 'Alfa', 0.42, 0.008, 2.2, 20.5),
    makeSeries('a2', 'Alfa', 0.42, 0.008, 1.2, 3.2),
    makeSeries('b1', 'Beijing', 0.14, 0.001, 1.9, 73.5),
    makeSeries('b2', 'Beijing', 0.14, 0.001, 2.7, 50.6),
  ];
  const fit = fitQinModel4('4L', data, {
    weighting: 'unweighted', zeroStandardDeviation: 'unweighted',
    fixedRateConstantsPerHour: { 'Alfa.k1PerHour': 0.42 },
  });
  assert.equal(fit.converged, true);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Alfa.k1PerHour - 0.42) < 1e-14);
  assert.ok(Math.abs(fit.rateConstantsPerHour.Alfa.k2PerHour - 0.008) < 1e-5);
  assert.equal(fit.covarianceMatrix, null);
  assert.ok(fit.warnings.some(warning => warning.includes('Conditional profile refit')));
});

test('conditional profile refit rejects unknown and out-of-range fixed rates', () => {
  const data = [makeSeries('a1', 'Alfa', 0.42, 0.008, 2.2, 20.5)];
  const base = { weighting: 'unweighted' as const, zeroStandardDeviation: 'unweighted' as const };
  assert.throws(() => fitQinModel4('4L', data, {
    ...base, fixedRateConstantsPerHour: { 'Unknown.k2PerHour': 0.1 },
  }), /Unknown fixed rate/);
  assert.throws(() => fitQinModel4('4L', data, {
    ...base, fixedRateConstantsPerHour: { 'Alfa.k2PerHour': 11 },
  }), /between 1e-8 and 10/);
});
