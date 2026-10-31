import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeStoichiometry } from './stoichiometry';
import { parseReactionNetwork } from './formula';

test('exact stoichiometric network analysis', async (t) => {
  await t.test('finds the atom conservation vector for H2 dissociation', () => {
    const network = parseReactionNetwork('H2 -> 2 H', 0.1).network;
    const analysis = analyzeStoichiometry(network);
    assert.deepEqual(analysis.matrix, [[-1], [2]]);
    assert.equal(analysis.rank, 1);
    assert.equal(analysis.independentConservationLaws, 1);
    assert.deepEqual(analysis.conservationBasis, [[2, 1]]);
  });

  await t.test('finds total entity conservation in a two-step isomer network', () => {
    // Formula parser models species by formula, so use the equivalent typed network
    // with three distinct abstract states carrying the same elemental composition.
    const model = {
      species: [
        { id: 'A', label: 'A', composition: { C: 1, H: 4 }, charge: 0 },
        { id: 'B', label: 'B', composition: { C: 1, H: 4 }, charge: 0 },
        { id: 'C', label: 'C', composition: { C: 1, H: 4 }, charge: 0 },
      ],
      reactions: [
        { id: 'r1', label: 'A to B', reactants: [{ speciesId: 'A', coefficient: 1 }], products: [{ speciesId: 'B', coefficient: 1 }], stochasticRateConstant: 0.1 },
        { id: 'r2', label: 'B to C', reactants: [{ speciesId: 'B', coefficient: 1 }], products: [{ speciesId: 'C', coefficient: 1 }], stochasticRateConstant: 0.1 },
      ],
    };
    const analysis = analyzeStoichiometry(model);
    assert.equal(analysis.rank, 2);
    assert.equal(analysis.independentReactionCycles, 0);
    assert.deepEqual(analysis.conservationBasis, [[1, 1, 1]]);
  });

  await t.test('detects an independent reaction cycle', () => {
    const model = {
      species: [
        { id: 'A', label: 'A', composition: { C: 1 }, charge: 0 },
        { id: 'B', label: 'B', composition: { C: 1 }, charge: 0 },
        { id: 'C', label: 'C', composition: { C: 1 }, charge: 0 },
      ],
      reactions: [
        { id: 'ab', label: 'A to B', reactants: [{ speciesId: 'A', coefficient: 1 }], products: [{ speciesId: 'B', coefficient: 1 }], stochasticRateConstant: 0.1 },
        { id: 'bc', label: 'B to C', reactants: [{ speciesId: 'B', coefficient: 1 }], products: [{ speciesId: 'C', coefficient: 1 }], stochasticRateConstant: 0.1 },
        { id: 'ca', label: 'C to A', reactants: [{ speciesId: 'C', coefficient: 1 }], products: [{ speciesId: 'A', coefficient: 1 }], stochasticRateConstant: 0.1 },
      ],
    };
    const analysis = analyzeStoichiometry(model);
    assert.equal(analysis.rank, 2);
    assert.equal(analysis.independentReactionCycles, 1);
    assert.deepEqual(analysis.conservationBasis, [[1, 1, 1]]);
  });
});
