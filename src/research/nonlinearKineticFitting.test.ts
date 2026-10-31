import test from 'node:test';
import assert from 'node:assert/strict';
import { fitMassActionMechanism } from './nonlinearKineticFitting';

const sequential = {
  speciesIds:['A','B','C'],
  initialConcentrations:{A:1,B:0,C:0},
  reactions:[
    {id:'k1',reactants:[{speciesId:'A',coefficient:1}],products:[{speciesId:'B',coefficient:1}]},
    {id:'k2',reactants:[{speciesId:'B',coefficient:1}],products:[{speciesId:'C',coefficient:1}]},
  ],
};
const parameters = [
  {reactionId:'k1',initialGuess:0.2,lowerBound:0.001,upperBound:2,units:'s^-1'},
  {reactionId:'k2',initialGuess:0.2,lowerBound:0.001,upperBound:2,units:'s^-1'},
];
test('multi-step nonlinear mass-action kinetic fitting', async t => {
  await t.test('recovers two sequential first-order rate constants from multi-species observations', () => {
    const trueFit = fitMassActionMechanism(sequential, [
      {...parameters[0],initialGuess:0.7},{...parameters[1],initialGuess:0.25},
    ], [0,0.5,1,1.5,2,3,4,5].flatMap(timeSeconds => [
      {timeSeconds,speciesId:'A',value:Math.exp(-0.7*timeSeconds)},
      {timeSeconds,speciesId:'B',value:0.7/(0.25-0.7)*(Math.exp(-0.7*timeSeconds)-Math.exp(-0.25*timeSeconds))},
      {timeSeconds,speciesId:'C',value:1-Math.exp(-0.7*timeSeconds)-0.7/(0.25-0.7)*(Math.exp(-0.7*timeSeconds)-Math.exp(-0.25*timeSeconds))},
    ]), {maxIntegrationStepSeconds:0.002});
    assert.ok(Math.abs(trueFit.parameterEstimates.k1-0.7)<0.002);
    assert.ok(Math.abs(trueFit.parameterEstimates.k2-0.25)<0.002);
    assert.ok(trueFit.locallyIdentifiable);
    assert.equal(trueFit.parameterCount,2);
    assert.ok(trueFit.correlationMatrix);
  });
  await t.test('supports weighted observations and reports covariance/correlation diagnostics', () => {
    const observations = [0,0.5,1,1.5,2,3,4,5].flatMap(timeSeconds => [
      {timeSeconds,speciesId:'A',value:Math.exp(-0.7*timeSeconds),standardDeviation:0.01},
      {timeSeconds,speciesId:'B',value:0.7/(0.25-0.7)*(Math.exp(-0.7*timeSeconds)-Math.exp(-0.25*timeSeconds)),standardDeviation:0.01},
    ]);
    const fit=fitMassActionMechanism(sequential,parameters,observations,{maxIntegrationStepSeconds:0.002});
    assert.ok(fit.parameterEstimates.k1>0);
    assert.ok(fit.standardErrors);
    assert.ok(fit.covarianceMatrix);
  });
  await t.test('flags unidentifiable parameters when only one species time series constrains two rates', () => {
    const observations=[0,1,2,3,4,5].map(timeSeconds=>({timeSeconds,speciesId:'A',value:Math.exp(-0.7*timeSeconds)}));
    const fit=fitMassActionMechanism(sequential,parameters,observations);
    assert.equal(fit.locallyIdentifiable,false);
    assert.equal(fit.identifiableParameterCount,1);
    assert.equal(fit.parameterCount,2);
    assert.equal(fit.covarianceMatrix,null);
    assert.ok(fit.warnings.some(w=>w.includes('locally unidentifiable')));
  });
  await t.test('rejects missing parameter bounds, unknown species and incomplete uncertainty', () => {
    assert.throws(()=>fitMassActionMechanism(sequential,[parameters[0]],[
      {timeSeconds:0,speciesId:'A',value:1},
      {timeSeconds:1,speciesId:'A',value:0.5},
      {timeSeconds:2,speciesId:'A',value:0.2},
    ],{}),/one unique kinetic parameter/);
    assert.throws(()=>fitMassActionMechanism(sequential,parameters,[
      {timeSeconds:0,speciesId:'X',value:1},
      {timeSeconds:1,speciesId:'X',value:0.5},
      {timeSeconds:2,speciesId:'X',value:0.2},
    ]),/invalid species/);
    assert.throws(()=>fitMassActionMechanism(sequential,parameters,[
      {timeSeconds:0,speciesId:'A',value:1,standardDeviation:0.1},
      {timeSeconds:1,speciesId:'A',value:0.5},
      {timeSeconds:2,speciesId:'A',value:0.2},
    ]),/standard deviations for all/);
  });
});
