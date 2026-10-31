import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateArrheniusRate } from './arrhenius';

test('Arrhenius kinetics', async (t) => {
  await t.test('returns A when activation energy is zero', () => {
    const result = calculateArrheniusRate(2.5e6, 0, 298.15);
    assert.equal(result.rateConstant, 2.5e6);
    assert.equal(result.exponentialFactor, 1);
  });

  await t.test('increases the rate constant with temperature for positive Ea', () => {
    const low = calculateArrheniusRate(1e7, 50_000, 280);
    const high = calculateArrheniusRate(1e7, 50_000, 320);
    assert.ok(high.rateConstant > low.rateConstant);
    assert.ok(high.exponentialFactor > low.exponentialFactor);
  });

  await t.test('matches the Arrhenius equation', () => {
    const A = 1e7;
    const Ea = 50_000;
    const T = 300;
    const result = calculateArrheniusRate(A, Ea, T);
    const expected = A * Math.exp(-Ea / (8.31446261815324 * T));
    assert.ok(Math.abs(result.rateConstant / expected - 1) < 1e-12);
  });

  await t.test('rejects non-physical inputs', () => {
    assert.throws(() => calculateArrheniusRate(1, 10, 0), /Temperature must be/);
    assert.throws(() => calculateArrheniusRate(1, -10, 300), /Activation energy must be/);
    assert.throws(() => calculateArrheniusRate(-1, 10, 300), /Pre-exponential factor/);
  });
});
