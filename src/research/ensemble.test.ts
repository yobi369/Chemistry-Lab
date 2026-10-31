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

  await t.test('matches both analytical mean and variance of the binomial survivor distribution', () => {
    // For N independent first-order decays, survivors at fixed t are
    // Binomial(N, exp(-k t)); this checks more than the ensemble mean alone.
    const initialA = 60;
    const rate = 0.7;
    const durationSeconds = 1;
    const replicates = 3_000;
    const survivalProbability = Math.exp(-rate * durationSeconds);
    const expectedMean = initialA * survivalProbability;
    const expectedVariance = initialA * survivalProbability * (1 - survivalProbability);
    const result = simulateEnsemble(network, { A: initialA, B: 0 }, {
      durationSeconds, seed: 20261031, replicates,
    });
    const a = result.species.find((item) => item.speciesId === 'A')!;
    const meanTolerance = 5 * Math.sqrt(expectedVariance / replicates);
    assert.ok(
      Math.abs(a.mean - expectedMean) < meanTolerance,
      `Observed mean ${a.mean}; expected ${expectedMean} ± ${meanTolerance}`,
    );
    assert.ok(
      Math.abs(a.standardDeviation ** 2 - expectedVariance) < expectedVariance * 0.1,
      `Observed variance ${a.standardDeviation ** 2}; expected ${expectedVariance}`,
    );
  });

  await t.test('matches analytical branching probabilities for competing reaction channels', () => {
    const branchingNetwork: ReactionNetwork = {
      species: [
        { id: 'A', label: 'Precursor', composition: { C: 1 }, charge: 0 },
        { id: 'B', label: 'Product B', composition: { C: 1 }, charge: 0 },
        { id: 'C', label: 'Product C', composition: { C: 1 }, charge: 0 },
      ],
      reactions: [
        {
          id: 'branch-b', label: 'A → B',
          reactants: [{ speciesId: 'A', coefficient: 1 }],
          products: [{ speciesId: 'B', coefficient: 1 }],
          stochasticRateConstant: 0.3,
        },
        {
          id: 'branch-c', label: 'A → C',
          reactants: [{ speciesId: 'A', coefficient: 1 }],
          products: [{ speciesId: 'C', coefficient: 1 }],
          stochasticRateConstant: 0.7,
        },
      ],
    };
    const replicates = 2_500;
    const durationSeconds = 8;
    const result = simulateEnsemble(branchingNetwork, { A: 1, B: 0, C: 0 }, {
      durationSeconds, seed: 731, replicates,
    });
    const expectedB = (0.3 / 1) * (1 - Math.exp(-durationSeconds));
    const expectedC = (0.7 / 1) * (1 - Math.exp(-durationSeconds));
    const b = result.species.find((item) => item.speciesId === 'B')!;
    const c = result.species.find((item) => item.speciesId === 'C')!;
    assert.ok(Math.abs(b.mean - expectedB) < 0.035, `B mean ${b.mean}; expected ${expectedB}`);
    assert.ok(Math.abs(c.mean - expectedC) < 0.035, `C mean ${c.mean}; expected ${expectedC}`);
    assert.ok(Math.abs(b.mean + c.mean - (1 - Math.exp(-durationSeconds))) < 0.02);
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
