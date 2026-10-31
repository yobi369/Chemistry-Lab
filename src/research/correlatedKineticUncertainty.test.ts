import test from 'node:test';
import assert from 'node:assert/strict';
import {propagateCorrelatedKineticUncertainty} from './correlatedKineticUncertainty';

const mechanism={
 speciesIds:['A','B','C'],
 initialConcentrations:{A:1,B:0,C:0},
 reactions:[
  {id:'k1',reactants:[{speciesId:'A',coefficient:1}],products:[{speciesId:'B',coefficient:1}]},
  {id:'k2',reactants:[{speciesId:'B',coefficient:1}],products:[{speciesId:'C',coefficient:1}]},
 ],
};
const parameters=[
 {reactionId:'k1',initialGuess:0.7,lowerBound:0.1,upperBound:1,units:'s^-1'},
 {reactionId:'k2',initialGuess:0.25,lowerBound:0.05,upperBound:0.5,units:'s^-1'},
];
const covariance=[[0.04,0.03],[0.03,0.09]];

test('correlated nonlinear kinetic uncertainty propagation',async t=>{
 await t.test('propagates joint parameter covariance into deterministic prediction bands',()=>{
  const args=[mechanism,parameters,{k1:0.7,k2:0.25},covariance,[0,1,2,3]] as const;
  const a=propagateCorrelatedKineticUncertainty(...args,{sampleCount:200,seed:42,maxIntegrationStepSeconds:0.01});
  const b=propagateCorrelatedKineticUncertainty(...args,{sampleCount:200,seed:42,maxIntegrationStepSeconds:0.01});
  assert.equal(a.acceptedSamples,200);
  assert.equal(a.attempts>=200,true);
  assert.deepEqual(a.bands,b.bands);
  for(const band of a.bands){
   assert.ok(band.lowerQuantile<=band.median);
   assert.ok(band.median<=band.upperQuantile);
   assert.ok(band.standardDeviation>=0);
  }
  const productBand=a.bands.find(band=>band.speciesId==='C'&&band.timeSeconds===3)!;
  assert.ok(productBand.standardDeviation>0);
 });
 await t.test('rejects non-symmetric, non-positive-semidefinite and dimensionally invalid covariance',()=>{
  assert.throws(()=>propagateCorrelatedKineticUncertainty(mechanism,parameters,{k1:0.7,k2:0.25},[[1,0],[0]], [1]),/dimensions/);
  assert.throws(()=>propagateCorrelatedKineticUncertainty(mechanism,parameters,{k1:0.7,k2:0.25},[[1,0.5],[0,1]], [1]),/symmetric/);
  assert.throws(()=>propagateCorrelatedKineticUncertainty(mechanism,parameters,{k1:0.7,k2:0.25},[[1,2],[2,1]], [1]),/positive semidefinite/);
 });
});
