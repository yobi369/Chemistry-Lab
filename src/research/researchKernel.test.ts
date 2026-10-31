import { describe, expect, it } from 'vitest';
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

describe('research chemistry kernel', () => {
  it('accepts a balanced reaction network', () => {
    expect(validateNetwork(network)).toEqual([]);
  });

  it('rejects atom and charge imbalance', () => {
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
    expect(validateNetwork(invalid).map((issue) => issue.code)).toContain('ATOM_IMBALANCE');
  });

  it('is reproducible for a fixed seed', () => {
    const options = { durationSeconds: 2, seed: 42 };
    expect(simulateGillespie(network, { A: 25, B: 0 }, options))
      .toEqual(simulateGillespie(network, { A: 25, B: 0 }, options));
  });

  it('conserves entity count for a 1:1 isomerisation', () => {
    const result = simulateGillespie(network, { A: 25, B: 0 }, { durationSeconds: 10, seed: 7 });
    expect(result.finalCounts.A + result.finalCounts.B).toBe(25);
    expect(result.finalCounts.A).toBeGreaterThanOrEqual(0);
    expect(result.finalCounts.B).toBeGreaterThanOrEqual(0);
  });

  it('does not fire a reaction without enough reactants', () => {
    const result = simulateGillespie(network, { A: 0, B: 0 }, { durationSeconds: 10 });
    expect(result.events).toHaveLength(0);
    expect(result.terminatedBy).toBe('no_enabled_reactions');
  });
});
