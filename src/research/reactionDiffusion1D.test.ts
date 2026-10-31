import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateReactionDiffusion1D } from './reactionDiffusion1D';
import { SimulationInputError } from './gillespie';

test('zero-flux diffusion conserves spatially integrated amount and smooths a pulse', () => {
  const result = simulateReactionDiffusion1D({
    lengthMeters: 1, timeStepSeconds: 0.001, steps: 100,
    species: [{ id: 'A', diffusionCoefficientM2PerS: 0.01,
      initialConcentrationMolPerM3: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] }],
    reactions: [],
  });
  const final = result.concentrationsMolPerM3.A;
  assert.ok(Math.abs(final.reduce((a, b) => a + b, 0) - 1) < 1e-10);
  assert.ok(final[0] < 1);
  assert.ok(final[1] > 0);
  assert.ok(final.every(value => value >= 0));
});

test('uniform concentration remains uniform under diffusion', () => {
  const result = simulateReactionDiffusion1D({
    lengthMeters: 2, timeStepSeconds: 0.01, steps: 20,
    species: [{ id: 'A', diffusionCoefficientM2PerS: 0.5,
      initialConcentrationMolPerM3: [3, 3, 3, 3] }],
    reactions: [],
  });
  for (const value of result.concentrationsMolPerM3.A) assert.ok(Math.abs(value - 3) < 1e-12);
});

test('first-order conversion follows the explicit Euler analytical trend', () => {
  const result = simulateReactionDiffusion1D({
    lengthMeters: 1, timeStepSeconds: 0.01, steps: 10,
    species: [
      { id: 'A', diffusionCoefficientM2PerS: 0, initialConcentrationMolPerM3: [2, 2, 2, 2] },
      { id: 'B', diffusionCoefficientM2PerS: 0, initialConcentrationMolPerM3: [0, 0, 0, 0] },
    ],
    reactions: [{ id: 'decay', reactantSpeciesId: 'A', products: [{ speciesId: 'B', coefficient: 1 }], rateConstantPerS: 1 }],
  });
  const expectedA = 2 * (1 - 0.01) ** 10;
  assert.ok(Math.abs(result.concentrationsMolPerM3.A[0] - expectedA) < 1e-12);
  assert.ok(Math.abs(result.concentrationsMolPerM3.A[0] + result.concentrationsMolPerM3.B[0] - 2) < 1e-10);
});

test('rejects an explicit step outside the positivity stability bound', () => {
  assert.throws(() => simulateReactionDiffusion1D({
    lengthMeters: 1, timeStepSeconds: 1, steps: 1,
    species: [{ id: 'A', diffusionCoefficientM2PerS: 1, initialConcentrationMolPerM3: [1, 0, 0, 0] }],
    reactions: [],
  }), SimulationInputError);
});
