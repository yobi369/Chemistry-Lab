import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateMassActionMechanismAdaptiveImplicit } from './stiffKineticSolver';

const references = JSON.parse(readFileSync(new URL('../../benchmarks/scientific-reference-fixtures.json', import.meta.url), 'utf8'));

const robertson = {
  speciesIds: ['A','B','C'],
  initialConcentrations: {A:1,B:0,C:0},
  reactions: [
    {id:'r1',reactants:[{speciesId:'A',coefficient:1}],products:[{speciesId:'B',coefficient:1}]},
    {id:'r2',reactants:[{speciesId:'B',coefficient:1},{speciesId:'C',coefficient:1}],products:[{speciesId:'A',coefficient:1},{speciesId:'C',coefficient:1}]},
    {id:'r3',reactants:[{speciesId:'B',coefficient:2}],products:[{speciesId:'B',coefficient:1},{speciesId:'C',coefficient:1}]},
  ],
};

test('adaptive implicit mass-action solver for stiff kinetics', async t => {
  await t.test('reproduces the published Robertson 1966 trajectory against independent SciPy BDF and Radau references', () => {
    const reference = references.robertson1966;
    const times = [0,...reference.timesSeconds];
    const result = simulateMassActionMechanismAdaptiveImplicit(
      robertson,
      {r1:0.04,r2:1e4,r3:3e7},
      times,
      {relativeTolerance:2e-6,absoluteTolerance:1e-12,maximumStepSeconds:1e4,maximumSteps:500000},
    );
    assert.equal(result.results.length,times.length);
    assert.ok(result.acceptedSteps>0);
    assert.ok(result.rejectedSteps>0);
    assert.ok(result.newtonIterations>result.acceptedSteps);
    for(let i=0;i<reference.timesSeconds.length;i++){
      const values=result.results[i+1].concentrations;
      const bdf=reference.referenceByBDF[i];
      const radau=reference.referenceByRadau[i];
      const actual=[values.A,values.B,values.C];
      for(let j=0;j<3;j++){
        const tolerance=Math.max(2e-9,3e-4*Math.max(Math.abs(bdf[j]),Math.abs(radau[j])));
        assert.ok(Math.abs(actual[j]-bdf[j])<=tolerance,
          `time=${reference.timesSeconds[i]} species=${['A','B','C'][j]} actual=${actual[j]} BDF=${bdf[j]} tolerance=${tolerance}`);
        assert.ok(Math.abs(actual[j]-radau[j])<=tolerance,
          `time=${reference.timesSeconds[i]} species=${['A','B','C'][j]} actual=${actual[j]} Radau=${radau[j]} tolerance=${tolerance}`);
        assert.ok(actual[j]>=0);
      }
      assert.ok(Math.abs(actual.reduce((sum,value)=>sum+value,0)-1)<2e-6);
    }
  });

  await t.test('rejects invalid tolerance and missing reaction rate inputs', () => {
    assert.throws(()=>simulateMassActionMechanismAdaptiveImplicit(robertson,{r1:0.04,r2:1e4,r3:3e7},[1],{relativeTolerance:0}),/tolerances/);
    assert.throws(()=>simulateMassActionMechanismAdaptiveImplicit(robertson,{r1:0.04,r2:1e4},[1]),/Rate constant/);
  });
});
