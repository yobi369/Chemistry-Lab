import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateEnsemble } from './ensemble';
import type { ReactionNetwork } from './types';

const network: ReactionNetwork = {
  species: [
    { id: 'A', label: 'A state', composition: { C: 1, H: 4 }, charge: 0 },
    { id: 'B', label: 'B state', composition: { C: 1, H: 4 }, charge: 0 },
  ],
  reactions: [{
    id: 'decay', label: 'A → B',
    reactants: [{ speciesId: 'A', coefficient: 1 }],
    products: [{ speciesId: 'B', coefficient: 1 }],
    stochasticRateConstant: 0.7,
  }],
};

test('stochastic ensemble analysis', async (t) => {
  await t.test('matches the analytical first-order decay mean', () => {
    const initialA = 40;
    const rate = 0.7;
    const durationSeconds = 1;
    const expectedMean = initialA * Math.exp(-rate * durationSeconds);
    const result = simulateEnsemble(network, { A: initialA, B: 0 }, {
      durationSeconds, seed: 1, replicates: 800,
    });
    const a = result.species.find((item) => item.speciesId === 'A')!;
    assert.ok(
      Math.abs(a.mean - expectedMean) < 0.45,
      `Ensemble mean ${a.mean} differs from analytical mean ${expectedMean}`,
    );
    assert.equal(result.replicateCount, 800);
    assert.ok(a.standardDeviation > 0);
    assert.ok(a.standardError > 0);
    assert.ok(a.confidenceInterval95[0] < a.mean);
    assert.ok(a.confidenceInterval95[1] > a.mean);
  });

  await t.test('is reproducible for the same base seed', () => {
    const options = { durationSeconds: 2, seed: 123, replicates: 25 };
    assert.deepEqual(
      simulateEnsemble(network, { A: 20, B: 0 }, options),
      simulateEnsemble(network, { A: 20, B: 0 }, options),
    );
  });

  await t.test('rejects too few replicates', () => {
    assert.throws(() => simulateEnsemble(network, { A: 20, B: 0 }, {
      durationSeconds: 1, replicates: 1,
    }), /replicates must be an integer/);
  });
});
