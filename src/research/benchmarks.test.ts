import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateGillespie } from './gillespie';
import type { ReactionNetwork } from './types';

const decayNetwork: ReactionNetwork = {
  species: [
    { id: 'A', label: 'A state', composition: { C: 1, H: 4 }, charge: 0 },
    { id: 'B', label: 'B state', composition: { C: 1, H: 4 }, charge: 0 },
  ],
  reactions: [{
    id: 'first-order-decay',
    label: 'A → B',
    reactants: [{ speciesId: 'A', coefficient: 1 }],
    products: [{ speciesId: 'B', coefficient: 1 }],
    stochasticRateConstant: 0.7,
  }],
};

test('analytical benchmark: first-order decay ensemble', () => {
  const initialA = 40;
  const rate = 0.7;
  const horizon = 1;
  const expectedMean = initialA * Math.exp(-rate * horizon);
  const runs = 800;
  let observedTotal = 0;

  for (let seed = 1; seed <= runs; seed += 1) {
    const result = simulateGillespie(decayNetwork, { A: initialA, B: 0 }, {
      durationSeconds: horizon,
      seed,
    });
    observedTotal += result.finalCounts.A;
    assert.equal(result.finalCounts.A + result.finalCounts.B, initialA);
  }

  const observedMean = observedTotal / runs;
  // Conservative tolerance relative to the binomial ensemble standard error.
  assert.ok(
    Math.abs(observedMean - expectedMean) < 0.45,
    `Ensemble mean ${observedMean} differs from analytical mean ${expectedMean}`,
  );
});
