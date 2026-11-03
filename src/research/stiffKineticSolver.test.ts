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
      {relativeTolerance:2e-7,absoluteTolerance:1e-13,maximumStepSeconds:1e4,maximumSteps:500000},
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

  await t.test('reproduces a stiff reversible A<->B relaxation with slow B->C drain against independent SciPy BDF and Radau', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../scripts/benchmarks/fixtures/stiff-reversible-slow-drain-fit.json', import.meta.url), 'utf8'));
    const mechanism = {
      speciesIds: fixture.species_ids,
      initialConcentrations: fixture.initial_concentrations,
      reactions: fixture.reactions.map((reaction: any) => ({
        id: reaction.id,
        reactants: reaction.reactants.map((term: any) => ({ speciesId: term.species_id, coefficient: term.coefficient })),
        products: reaction.products.map((term: any) => ({ speciesId: term.species_id, coefficient: term.coefficient })),
      })),
    };
    const result = simulateMassActionMechanismAdaptiveImplicit(
      mechanism,
      fixture.true_parameters,
      fixture.times_seconds,
      {
        relativeTolerance: fixture.fit.relative_tolerance,
        absoluteTolerance: fixture.fit.absolute_tolerance,
        maximumSteps: fixture.fit.maximum_steps,
        maximumNewtonIterations: fixture.fit.maximum_newton_iterations,
      },
    );
    assert.equal(result.results.length, fixture.times_seconds.length);
    assert.ok(result.acceptedSteps > 0);
    assert.ok(result.newtonIterations > 0);
    for (let i = 0; i < fixture.times_seconds.length; i++) {
      const actual = fixture.species_ids.map((id: string) => result.results[i].concentrations[id]);
      const bdf = fixture.reference_by_BDF[i];
      const radau = fixture.reference_by_Radau[i];
      for (let j = 0; j < actual.length; j++) {
        const tolerance = Math.max(2e-8, 2e-4 * Math.max(Math.abs(bdf[j]), Math.abs(radau[j])));
        assert.ok(Math.abs(actual[j] - bdf[j]) <= tolerance,
          `BDF mismatch at t=${fixture.times_seconds[i]} species=${fixture.species_ids[j]} actual=${actual[j]} reference=${bdf[j]}`);
        assert.ok(Math.abs(actual[j] - radau[j]) <= tolerance,
          `Radau mismatch at t=${fixture.times_seconds[i]} species=${fixture.species_ids[j]} actual=${actual[j]} reference=${radau[j]}`);
      }
      assert.ok(Math.abs(actual.reduce((sum: number, value: number) => sum + value, 0) - 1) < 2e-6);
      assert.ok(actual.every((value: number) => value >= 0));
    }
  });

  await t.test('tightening adaptive tolerances reduces stiff-network trajectory error', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../scripts/benchmarks/fixtures/stiff-reversible-slow-drain-fit.json', import.meta.url), 'utf8'));
    const mechanism = {
      speciesIds: fixture.species_ids,
      initialConcentrations: fixture.initial_concentrations,
      reactions: fixture.reactions.map((reaction: any) => ({
        id: reaction.id,
        reactants: reaction.reactants.map((term: any) => ({ speciesId: term.species_id, coefficient: term.coefficient })),
        products: reaction.products.map((term: any) => ({ speciesId: term.species_id, coefficient: term.coefficient })),
      })),
    };
    const simulate = (relativeTolerance: number, absoluteTolerance: number) =>
      simulateMassActionMechanismAdaptiveImplicit(mechanism, fixture.true_parameters, fixture.times_seconds, {
        relativeTolerance, absoluteTolerance, maximumSteps: fixture.fit.maximum_steps,
      });
    const coarse = simulate(1e-3, 1e-9);
    const tight = simulate(2e-8, 1e-14);
    const maxError = (result: ReturnType<typeof simulate>) => Math.max(...result.results.flatMap((row, i) =>
      fixture.species_ids.map((id: string, j: number) =>
        Math.abs(row.concentrations[id] - fixture.reference_by_BDF[i][j]))));
    assert.ok(maxError(tight) < maxError(coarse),
      `Tight tolerance error ${maxError(tight)} was not lower than coarse error ${maxError(coarse)}`);
  });

  await t.test('rejects invalid tolerance and missing reaction rate inputs', () => {
    assert.throws(()=>simulateMassActionMechanismAdaptiveImplicit(robertson,{r1:0.04,r2:1e4,r3:3e7},[1],{relativeTolerance:0}),/tolerances/);
    assert.throws(()=>simulateMassActionMechanismAdaptiveImplicit(robertson,{r1:0.04,r2:1e4},[1]),/Rate constant/);
  });
});
