import test from 'node:test';
import assert from 'node:assert/strict';
import { convertMacroscopicRateConstant } from './rateConversion';
import { AVOGADRO_CONSTANT } from './rateConversion';
import type { StochasticReaction } from './types';

const reaction = (reactants: StochasticReaction['reactants']): StochasticReaction => ({
  id: 'r', label: 'test',
  reactants,
  products: [{ speciesId: 'P', coefficient: 1 }],
  stochasticRateConstant: 1,
});

test('macroscopic-to-stochastic rate conversion', async (t) => {
  await t.test('first-order rate constant is independent of volume', () => {
    const r = reaction([{ speciesId: 'A', coefficient: 1 }]);
    const a = convertMacroscopicRateConstant(r, 0.25, 1e-3);
    const b = convertMacroscopicRateConstant(r, 0.25, 1e-9);
    assert.equal(a.stochasticRateConstant, 0.25);
    assert.equal(b.stochasticRateConstant, 0.25);
    assert.equal(a.macroscopicUnits, 's^-1');
  });

  await t.test('second-order A + B uses c = k / (NA V)', () => {
    const r = reaction([
      { speciesId: 'A', coefficient: 1 },
      { speciesId: 'B', coefficient: 1 },
    ]);
    const converted = convertMacroscopicRateConstant(r, 2, 1e-3);
    const expected = 2 / (AVOGADRO_CONSTANT * 1e-3);
    assert.ok(Math.abs(converted.stochasticRateConstant / expected - 1) < 1e-12);
    assert.equal(converted.macroscopicUnits, 'M^-1 s^-1');
  });

  await t.test('second-order 2A includes the factorial convention', () => {
    const r = reaction([{ speciesId: 'A', coefficient: 2 }]);
    const converted = convertMacroscopicRateConstant(r, 2, 1e-3);
    const expected = (2 * 2) / (AVOGADRO_CONSTANT * 1e-3);
    assert.ok(Math.abs(converted.stochasticRateConstant / expected - 1) < 1e-12);
  });

  await t.test('rejects invalid volumes and constants', () => {
    const r = reaction([{ speciesId: 'A', coefficient: 1 }]);
    assert.throws(() => convertMacroscopicRateConstant(r, 1, 0), /volume must be/);
    assert.throws(() => convertMacroscopicRateConstant(r, -1, 1), /rate constant must be/);
  });
});
