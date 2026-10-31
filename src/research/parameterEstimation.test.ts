import test from 'node:test';
import assert from 'node:assert/strict';
import { fitFirstOrderDecay } from './parameterEstimation';

test('first-order kinetic parameter estimation', async t => {
  await t.test('recovers exact rate and initial value from noiseless observations', () => {
    const k = 0.42, y0 = 125;
    const fit = fitFirstOrderDecay([0, 1, 2, 3, 4].map(timeSeconds => ({
      timeSeconds, value: y0 * Math.exp(-k * timeSeconds),
    })));
    assert.ok(Math.abs(fit.rateConstantPerSecond - k) < 1e-12);
    assert.ok(Math.abs(fit.initialValue - y0) < 1e-10);
    assert.ok(fit.coefficientOfDetermination > 0.999999999);
  });
  await t.test('uses supplied measurement standard deviations in weighted fitting', () => {
    const k = 0.31;
    const fit = fitFirstOrderDecay([0, 1, 2, 3].map(timeSeconds => ({
      timeSeconds,
      value: 80 * Math.exp(-k * timeSeconds),
      standardDeviation: 0.2,
    })));
    assert.equal(fit.weightedLeastSquares, true);
    assert.ok(Math.abs(fit.rateConstantPerSecond - k) < 1e-10);
  });
  await t.test('rejects partially supplied measurement uncertainty', () => {
    assert.throws(() => fitFirstOrderDecay([
      { timeSeconds: 0, value: 10, standardDeviation: 0.2 },
      { timeSeconds: 1, value: 8 },
      { timeSeconds: 2, value: 6, standardDeviation: 0.2 },
    ]), /standard deviations for every observation/);
  });
  await t.test('rejects zero and negative observations rather than silently taking logarithms', () => {
    assert.throws(() => fitFirstOrderDecay([
      { timeSeconds: 0, value: 10 }, { timeSeconds: 1, value: 0 }, { timeSeconds: 2, value: 2 },
    ]), /positive value/);
  });
});
