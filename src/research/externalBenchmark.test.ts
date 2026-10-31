import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateArrheniusRate } from './arrhenius';
import { simulateMassActionMechanism } from './nonlinearKineticFitting';

const fixture=JSON.parse(readFileSync(new URL('../../benchmarks/scientific-reference-fixtures.json',import.meta.url),'utf8'));
const nist=JSON.parse(readFileSync(new URL('../../benchmarks/nist_h_o2_reference.json',import.meta.url),'utf8'));

test('external scientific reference benchmarks',async t=>{
  await t.test('Chemistry Lab RK4 trajectory agrees with independent SciPy BDF reference for a sequential mechanism',()=>{
    const caseData=fixture.sequentialAtoBtoC;
    const mechanism={
      speciesIds:['A','B','C'],
      initialConcentrations:{A:1,B:0,C:0},
      reactions:[
        {id:'k1',reactants:[{speciesId:'A',coefficient:1}],products:[{speciesId:'B',coefficient:1}]},
        {id:'k2',reactants:[{speciesId:'B',coefficient:1}],products:[{speciesId:'C',coefficient:1}]},
      ],
    };
    const result=simulateMassActionMechanism(mechanism,{k1:0.7,k2:0.25},caseData.timesSeconds,0.0005);
    for(let i=0;i<result.length;i++){
      for(let j=0;j<3;j++) assert.ok(Math.abs(result[i].concentrations[['A','B','C'][j]]-caseData.referenceByBDF[i][j])<2e-9);
      const total=Object.values(result[i].concentrations).reduce((sum,value)=>sum+value,0);
      assert.ok(Math.abs(total-1)<1e-10);
    }
  });
  await t.test('published Robertson reference fixtures preserve positivity and total concentration',()=>{
    const caseData=fixture.robertson1966;
    for(let i=0;i<caseData.timesSeconds.length;i++){
      const bdf=caseData.referenceByBDF[i],radau=caseData.referenceByRadau[i];
      assert.ok(bdf.every(value=>value>=0));
      assert.ok(radau.every(value=>value>=0));
      assert.ok(Math.abs(bdf.reduce((a,b)=>a+b,0)-1)<2e-9);
      assert.ok(Math.abs(radau.reduce((a,b)=>a+b,0)-1)<2e-9);
      for(let j=0;j<3;j++) assert.ok(Math.abs(bdf[j]-radau[j])<2e-9);
    }
  });
  await t.test('Arrhenius implementation reproduces NIST tabulated H + O2 rate-expression values',()=>{
    const {A,activationEnergyJPerMol}=nist.rateExpression;
    for(const [temperature,referenceRate] of nist.tabulatedArrheniusValues){
      const calculated=calculateArrheniusRate(A,activationEnergyJPerMol,temperature).rateConstant;
      // NIST's table is rounded to 3 significant figures and uses R=8.314472.
      assert.ok(Math.abs(calculated-referenceRate)/referenceRate<0.006);
    }
  });
});
