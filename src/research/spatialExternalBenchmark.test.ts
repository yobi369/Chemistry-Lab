import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulateReactionDiffusion2D} from './reactionDiffusion2D';

const fixture=JSON.parse(readFileSync(new URL('../../benchmarks/spatial2d_scipy_reference.json',import.meta.url),'utf8'));

test('2-D Chemistry Lab finite-volume solver agrees with independent SciPy method-of-lines references',()=>{
 const {widthMeters,heightMeters,gridRows,gridColumns,diffusionCoefficientM2PerS,timeSeconds}=fixture.domain;
 const dx=widthMeters/gridColumns,dy=heightMeters/gridRows;
 const initial=Array.from({length:gridRows},(_,y)=>Array.from({length:gridColumns},(_,x)=>
  1+0.2*Math.cos(Math.PI*(x+0.5)*dx)*Math.cos(Math.PI*(y+0.5)*dy)));
 const dt=1e-5,steps=Math.round(timeSeconds/dt);
 const result=simulateReactionDiffusion2D({
  widthMeters,heightMeters,timeStepSeconds:dt,steps,reactions:[],
  species:[{id:'A',diffusionCoefficientM2PerS,initialConcentrationMolPerM3:initial}],
 });
 const reference=fixture.referenceByBDF;
 for(let y=0;y<gridRows;y++)for(let x=0;x<gridColumns;x++){
  assert.ok(Math.abs(result.concentrationsMolPerM3.A[y][x]-reference[y][x])<1e-6);
  assert.ok(Math.abs(fixture.referenceByBDF[y][x]-fixture.referenceByRadau[y][x])<2e-9);
 }
 const total=result.concentrationsMolPerM3.A.flat().reduce((a,b)=>a+b,0);
 assert.ok(Math.abs(total-gridRows*gridColumns)<1e-9);
});
