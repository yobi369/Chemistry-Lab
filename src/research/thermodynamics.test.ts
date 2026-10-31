import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStandardThermodynamics, predictEquilibriumConstantAtTemperature, calculateReactionFreeEnergyChange } from './thermodynamics';
import { GAS_CONSTANT_J_PER_MOL_K } from './arrhenius';

test('standard-state thermodynamics', async t => {
  await t.test('computes Gibbs energy and equilibrium constant consistently', () => {
    const result = calculateStandardThermodynamics({
      temperatureKelvin: 298.15, enthalpyJPerMol: -10000, entropyJPerMolKelvin: -20,
    });
    const expectedG = -10000 - 298.15 * -20;
    assert.ok(Math.abs(result.gibbsEnergyJPerMol - expectedG) < 1e-9);
    assert.ok(Math.abs(result.logEquilibriumConstant + expectedG / (GAS_CONSTANT_J_PER_MOL_K * 298.15)) < 1e-12);
  });
  await t.test('van t Hoff relation reproduces the reference point', () => {
    const k = predictEquilibriumConstantAtTemperature({
      referenceEquilibriumConstant: 3.2, referenceTemperatureKelvin: 300,
      targetTemperatureKelvin: 300, enthalpyJPerMol: 25000,
    });
    assert.ok(Math.abs(k - 3.2) < 1e-12);
  });
  await t.test('reaction free energy is zero at equilibrium Q=K', () => {
    const temperature = 298.15, k = 4.5;
    const gStandard = -GAS_CONSTANT_J_PER_MOL_K * temperature * Math.log(k);
    assert.ok(Math.abs(calculateReactionFreeEnergyChange({
      standardGibbsEnergyJPerMol: gStandard, temperatureKelvin: temperature, reactionQuotient: k,
    })) < 1e-10);
  });
});
