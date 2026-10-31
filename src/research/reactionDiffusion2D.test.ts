import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateReactionDiffusion2D} from './reactionDiffusion2D';
import {SimulationInputError} from './gillespie';

test('two-dimensional reaction-diffusion and transport solver',async t=>{
 await t.test('uniform field remains uniform under diffusion and constant transport',()=>{
  const result=simulateReactionDiffusion2D({
   widthMeters:1,heightMeters:1,timeStepSeconds:0.001,steps:10,boundaryCondition:'periodic',reactions:[],
   species:[{id:'A',diffusionCoefficientM2PerS:0.1,velocityXMetersPerSecond:0.2,velocityYMetersPerSecond:-0.1,
    initialConcentrationMolPerM3:[[2,2,2],[2,2,2],[2,2,2]]}],
  });
  for(const row of result.concentrationsMolPerM3.A)for(const value of row)assert.ok(Math.abs(value-2)<1e-12);
 });
 await t.test('no-flux diffusion conserves the two-dimensional spatial sum',()=>{
  const result=simulateReactionDiffusion2D({
   widthMeters:1,heightMeters:1,timeStepSeconds:0.001,steps:100,reactions:[],
   species:[{id:'A',diffusionCoefficientM2PerS:0.01,
    initialConcentrationMolPerM3:[[1,0,0],[0,0,0],[0,0,0]]}],
  });
  const initial=1;
  const final=result.concentrationsMolPerM3.A.flat().reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(final-initial)<1e-10);
  assert.ok(result.concentrationsMolPerM3.A.flat().every(value=>value>=0));
 });
 await t.test('periodic x-advection transports a pulse and wraps at the boundary',()=>{
  const result=simulateReactionDiffusion2D({
   widthMeters:1,heightMeters:1,timeStepSeconds:0.125,steps:1,boundaryCondition:'periodic',reactions:[],
   species:[{id:'A',diffusionCoefficientM2PerS:0,velocityXMetersPerSecond:1,
    initialConcentrationMolPerM3:[[0,0,0,1],[0,0,0,0]]}],
  });
  const grid=result.concentrationsMolPerM3.A;
  assert.ok(Math.abs(grid[0][0]-0.5)<1e-12);
  assert.ok(Math.abs(grid[0][3]-0.5)<1e-12);
  assert.ok(Math.abs(grid.flat().reduce((a,b)=>a+b,0)-1)<1e-12);
 });
 await t.test('manufactured 2-D Neumann cosine solution demonstrates mesh convergence',()=>{
  const errors:number[]=[];
  const finalTime=0.005,diffusion=1;
  for(const cells of [12,24,48]){
   const dx=1/cells,nominalDt=0.1*dx*dx/diffusion;
   const steps=Math.round(finalTime/nominalDt),dt=finalTime/steps;
   const initial=Array.from({length:cells},(_,y)=>Array.from({length:cells},(_,x)=>
    1+0.2*Math.cos(Math.PI*(x+0.5)*dx)*Math.cos(Math.PI*(y+0.5)*dx)));
   const result=simulateReactionDiffusion2D({
    widthMeters:1,heightMeters:1,timeStepSeconds:dt,steps,reactions:[],
    species:[{id:'A',diffusionCoefficientM2PerS:diffusion,initialConcentrationMolPerM3:initial}],
   });
   const exact=initial.map((row,y)=>row.map((_,x)=>
    1+0.2*Math.cos(Math.PI*(x+0.5)*dx)*Math.cos(Math.PI*(y+0.5)*dx)*
    Math.exp(-diffusion*Math.PI*Math.PI*2*finalTime)));
   errors.push(Math.max(...result.concentrationsMolPerM3.A.flatMap((row,y)=>row.map((value,x)=>Math.abs(value-exact[y][x])))));
  }
  assert.ok(errors[0]/errors[1]>3.5);
  assert.ok(errors[1]/errors[2]>3.5);
 });
 await t.test('rejects an unstable 2-D explicit time step and ragged grids',()=>{
  assert.throws(()=>simulateReactionDiffusion2D({
   widthMeters:1,heightMeters:1,timeStepSeconds:1,steps:1,reactions:[],
   species:[{id:'A',diffusionCoefficientM2PerS:1,initialConcentrationMolPerM3:[[1,0],[0,0]]}],
  }),SimulationInputError);
  assert.throws(()=>simulateReactionDiffusion2D({
   widthMeters:1,heightMeters:1,timeStepSeconds:0.01,steps:1,reactions:[],
   species:[{id:'A',diffusionCoefficientM2PerS:0,initialConcentrationMolPerM3:[[1,0],[0]]}],
  }),SimulationInputError);
 });
});
