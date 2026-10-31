import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReactionThermodynamics } from './reactionThermodynamics';
import { GAS_CONSTANT_J_PER_MOL_K } from './arrhenius';
import type { ReactionNetwork } from './types';

const network: ReactionNetwork = {
  species: [
    { id: 'A', label: 'A', composition: { H: 2 }, charge: 0 },
    { id: 'B', label: 'B', composition: { H: 2 }, charge: 0 },
  ],
  reactions: [{
    id: 'r1', label: 'A -> B',
    reactants: [{ speciesId: 'A', coefficient: 1 }],
    products: [{ speciesId: 'B', coefficient: 1 }],
    stochasticRateConstant: 1,
  }],
};

test('reaction-network thermodynamics', async t => {
  await t.test('derives standard reaction Gibbs energy and K from formation energies', () => {
    const result = analyzeReactionThermodynamics({
      network, reactionId: 'r1', temperatureKelvin: 300,
      standardGibbsFormationJPerMol: { A: -10000, B: -15000 },
    });
    assert.equal(result.standardGibbsEnergyJPerMol, -5000);
    assert.ok(Math.abs(result.logEquilibriumConstant - 5000 / (GAS_CONSTANT_J_PER_MOL_K * 300)) < 1e-12);
    assert.ok(result.equilibriumConstant! > 1);
  });
  await t.test('identifies equilibrium when Q equals K', () => {
    const temperature = 298.15, deltaG = -2500;
    const k = Math.exp(-deltaG / (GAS_CONSTANT_J_PER_MOL_K * temperature));
    const result = analyzeReactionThermodynamics({
      network, reactionId: 'r1', temperatureKelvin: temperature,
      standardGibbsFormationJPerMol: { A: 0, B: deltaG },
      activities: { A: 1, B: k }, equilibriumToleranceJPerMol: 1e-8,
    });
    assert.equal(result.directionAtSuppliedActivities, 'equilibrium');
    assert.ok(Math.abs(result.reactionGibbsEnergyJPerMol!) < 1e-8);
  });
  await t.test('rejects missing species thermodynamic data', () => {
    assert.throws(() => analyzeReactionThermodynamics({
      network, reactionId: 'r1', temperatureKelvin: 300,
      standardGibbsFormationJPerMol: { A: 0 },
    }), /Missing finite thermodynamic/);
  });
});
