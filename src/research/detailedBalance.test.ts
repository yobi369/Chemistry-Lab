import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDetailedBalanceRates, simulateDetailedBalanceReversible, validateDetailedBalanceEquilibrium } from './detailedBalance';
import { GAS_CONSTANT_J_PER_MOL_K } from './arrhenius';

const temperature=298.15;
const R=GAS_CONSTANT_J_PER_MOL_K;
const deltaG=-R*temperature*Math.log(4);
const formation={A:0,B:deltaG};
const reaction={id:'A-reversible-B',reactants:[{speciesId:'A',coefficient:1}],products:[{speciesId:'B',coefficient:1}],forwardRateConstantPerSecond:0.8};

test('thermodynamically constrained reversible kinetics',async t=>{
  await t.test('derives reverse rate so kf/kr equals the thermodynamic equilibrium constant',()=>{
    const rates=deriveDetailedBalanceRates({reaction,standardGibbsFormationJPerMol:formation,temperatureKelvin:temperature});
    assert.ok(Math.abs(rates.equilibriumConstant!-4)<1e-10);
    assert.ok(Math.abs(rates.forwardRateConstantPerSecond/rates.reverseRateConstantPerSecond-4)<1e-10);
    assert.ok(Math.abs(rates.reverseRateConstantPerSecond-0.2)<1e-10);
  });
  await t.test('validates zero net flux at Q=K',()=>{
    const result=validateDetailedBalanceEquilibrium({
      reaction,standardGibbsFormationJPerMol:formation,temperatureKelvin:temperature,
      activities:{A:0.2,B:0.8},
    });
    assert.equal(result.equilibriumConsistent,true);
    assert.ok(Math.abs(result.netFluxPerSecond)<1e-12);
    assert.ok(Math.abs(result.reactionGibbsEnergyJPerMol)<1e-8);
  });
  await t.test('relaxes an off-equilibrium closed two-state system to its predicted equilibrium',()=>{
    const result=simulateDetailedBalanceReversible({
      speciesIds:['A','B'],initialActivities:{A:1,B:0},reactions:[reaction],
      standardGibbsFormationJPerMol:formation,temperatureKelvin:temperature,
      timeStepSeconds:0.01,steps:10000,
    });
    assert.ok(Math.abs(result.activities.A-0.2)<1e-6);
    assert.ok(Math.abs(result.activities.B-0.8)<1e-6);
    assert.ok(Math.abs(result.activities.A+result.activities.B-1)<1e-10);
  });
  await t.test('rejects missing formation energies and invalid activities',()=>{
    assert.throws(()=>deriveDetailedBalanceRates({reaction,standardGibbsFormationJPerMol:{A:0},temperatureKelvin:temperature}),/Missing finite/);
    assert.throws(()=>validateDetailedBalanceEquilibrium({
      reaction,standardGibbsFormationJPerMol:formation,temperatureKelvin:temperature,activities:{A:0,B:1},
    }),/must be finite and positive/);
  });
});
