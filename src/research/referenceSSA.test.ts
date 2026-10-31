import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom, simulateGillespie } from './gillespie';
import type { ReactionNetwork, SpeciesCounts } from './types';

const network: ReactionNetwork = {
  species: [
    { id: 'A', label: 'A', composition: { C: 2, H: 4 }, charge: 0 },
    { id: 'B', label: 'B', composition: { C: 2, H: 4 }, charge: 0 },
    { id: 'C', label: 'C', composition: { C: 2, H: 4 }, charge: 0 },
    { id: 'D', label: 'D', composition: { C: 4, H: 8 }, charge: 0 },
  ],
  reactions: [
    { id: 'a-b', label: 'A -> B', reactants: [{ speciesId: 'A', coefficient: 1 }], products: [{ speciesId: 'B', coefficient: 1 }], stochasticRateConstant: 0.4 },
    { id: 'a-c', label: 'A -> C', reactants: [{ speciesId: 'A', coefficient: 1 }], products: [{ speciesId: 'C', coefficient: 1 }], stochasticRateConstant: 0.6 },
    { id: '2a-d', label: '2 A -> D', reactants: [{ speciesId: 'A', coefficient: 2 }], products: [{ speciesId: 'D', coefficient: 1 }], stochasticRateConstant: 0.002 },
  ],
};

function choose(n: number, k: number): number {
  if (n < k) return 0;
  let value = 1;
  for (let i = 1; i <= k; i++) value *= (n - i + 1) / i;
  return value;
}

/** Independent first-reaction SSA: sample a clock for every enabled channel. */
function referenceFirstReactionSSA(seed: number, duration: number): SpeciesCounts {
  const random = createSeededRandom(seed);
  const counts: Record<string, number> = { A: 20, B: 0, C: 0, D: 0 };
  let time = 0;
  while (time < duration) {
    const clocks = network.reactions.map(reaction => {
      let propensity = reaction.stochasticRateConstant;
      for (const term of reaction.reactants) propensity *= choose(counts[term.speciesId], term.coefficient);
      return propensity > 0 ? -Math.log(Math.max(Number.EPSILON, 1 - random())) / propensity : Infinity;
    });
    let selected = 0;
    for (let i = 1; i < clocks.length; i++) if (clocks[i] < clocks[selected]) selected = i;
    const wait = clocks[selected];
    if (!Number.isFinite(wait) || time + wait > duration) break;
    const reaction = network.reactions[selected];
    for (const term of reaction.reactants) counts[term.speciesId] -= term.coefficient;
    for (const term of reaction.products) counts[term.speciesId] += term.coefficient;
    time += wait;
  }
  return counts;
}

function meanAndVariance(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return { mean, variance };
}

test('independent first-reaction SSA reference comparison', () => {
  const replicates = 1200;
  const duration = 1.25;
  const direct: Record<string, number[]> = { A: [], B: [], C: [], D: [] };
  const reference: Record<string, number[]> = { A: [], B: [], C: [], D: [] };
  for (let i = 0; i < replicates; i++) {
    const seed = 9000 + i;
    const actual = simulateGillespie(network, { A: 20, B: 0, C: 0, D: 0 }, {
      durationSeconds: duration, seed,
    }).finalCounts;
    const expected = referenceFirstReactionSSA(seed, duration);
    for (const id of Object.keys(direct)) {
      direct[id].push(actual[id]);
      reference[id].push(expected[id]);
    }
  }
  for (const id of Object.keys(direct)) {
    const a = meanAndVariance(direct[id]);
    const b = meanAndVariance(reference[id]);
    const pooledStandardError = Math.sqrt((a.variance + b.variance) / replicates);
    assert.ok(
      Math.abs(a.mean - b.mean) < 5 * pooledStandardError + 0.02,
      `${id}: direct SSA mean ${a.mean} differs from independent first-reaction mean ${b.mean}`,
    );
  }
});
