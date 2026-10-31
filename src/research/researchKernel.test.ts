import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateGillespie } from './gillespie';
import { validateNetwork } from './validateNetwork';
import type { ReactionNetwork } from './types';

const network: ReactionNetwork = {
  species: [
    { id: 'A', label: 'A', composition: { H: 2 }, charge: 0 },
    { id: 'B', label: 'B', composition: { H: 2 }, charge: 0 },
  ],
  reactions: [
    {
      id: 'isomerisation',
      label: 'A → B',
      reactants: [{ speciesId: 'A', coefficient: 1 }],
      products: [{ speciesId: 'B', coefficient: 1 }],
      stochasticRateConstant: 0.8,
    },
  ],
};

test('research chemistry kernel', async (t) => {
  await t.test('accepts a balanced reaction network', () => {
    assert.deepEqual(validateNetwork(network), []);
  });

  await t.test('rejects atom and charge imbalance', () => {
    const invalid: ReactionNetwork = {
      species: [
        { id: 'H2', label: 'hydrogen', composition: { H: 2 }, charge: 0 },
        { id: 'H', label: 'hydrogen atom', composition: { H: 1 }, charge: 0 },
      ],
      reactions: [{
        id: 'bad', label: 'unbalanced',
        reactants: [{ speciesId: 'H2', coefficient: 1 }],
        products: [{ speciesId: 'H', coefficient: 1 }],
        stochasticRateConstant: 1,
      }],
    };
    assert.ok(validateNetwork(invalid).some((issue) => issue.code === 'ATOM_IMBALANCE'));
  });

  await t.test('rejects invalid periodic-table symbols', () => {
    const invalid: ReactionNetwork = {
      species: [{ id: 'Xx', label: 'unknown', composition: { Xx: 1 }, charge: 0 }],
      reactions: [],
    };
    assert.ok(validateNetwork(invalid).some((issue) => issue.code === 'INVALID_COMPOSITION'));
  });

  await t.test('is reproducible for a fixed seed', () => {
    const options = { durationSeconds: 2, seed: 42 };
    assert.deepEqual(simulateGillespie(network, { A: 25, B: 0 }, options), simulateGillespie(network, { A: 25, B: 0 }, options));
  });

  await t.test('conserves entity count for a 1:1 isomerisation', () => {
    const result = simulateGillespie(network, { A: 25, B: 0 }, { durationSeconds: 10, seed: 7 });
    assert.equal(result.finalCounts.A + result.finalCounts.B, 25);
    assert.ok(result.finalCounts.A >= 0);
    assert.ok(result.finalCounts.B >= 0);
  });

  await t.test('rejects non-integer seeds', () => {
    assert.throws(() => simulateGillespie(network, { A: 25, B: 0 }, {
      durationSeconds: 1, seed: 1.5,
    }), /seed must be an integer/);
  });

  await t.test('reports the full observation horizon when no event occurs before it', () => {
    const result = simulateGillespie(network, { A: 1, B: 0 }, {
      durationSeconds: 0.000001, seed: 2,
    });
    assert.equal(result.elapsedSeconds, 0.000001);
    assert.equal(result.terminatedBy, 'time_limit');
  });

  await t.test('supports cooperative cancellation', () => {
    const result = simulateGillespie(network, { A: 25, B: 0 }, {
      durationSeconds: 100, shouldCancel: () => true,
    });
    assert.equal(result.terminatedBy, 'cancelled');
    assert.equal(result.events.length, 0);
  });

  await t.test('does not fire a reaction without enough reactants', () => {
    const result = simulateGillespie(network, { A: 0, B: 0 }, { durationSeconds: 10 });
    assert.equal(result.events.length, 0);
    assert.equal(result.terminatedBy, 'no_enabled_reactions');
    assert.equal(result.elapsedSeconds, 10);
  });
});
