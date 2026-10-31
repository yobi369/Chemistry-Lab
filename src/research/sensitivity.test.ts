import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateLocalSensitivity, propagateFirstOrderRateUncertainty } from './sensitivity';

test('sensitivity and uncertainty propagation', async t => {
  await t.test('central difference recovers analytic elasticity for exponential decay', () => {
    const k = 0.4, time = 3;
    const result = estimateLocalSensitivity(value => Math.exp(-value * time), k);
    assert.ok(Math.abs(result.normalizedElasticity! + k * time) < 1e-7);
  });
  await t.test('zero parameter uncertainty collapses Monte Carlo interval to deterministic prediction', () => {
    const result = propagateFirstOrderRateUncertainty({
      meanRatePerSecond: 0.5, standardDeviationRatePerSecond: 0,
      timeSeconds: 2, initialValue: 100, samples: 500, seed: 7,
    });
    const expected = 100 * Math.exp(-1);
    assert.ok(Math.abs(result.monteCarloMean - expected) < 1e-10);
    assert.ok(Math.abs(result.monteCarloStandardDeviation) < 1e-10);
    assert.ok(Math.abs(result.predictionInterval95[0] - expected) < 1e-10);
  });
});
