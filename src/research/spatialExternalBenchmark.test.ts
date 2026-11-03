import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulateReactionDiffusion2D} from './reactionDiffusion2D';

const fixture=JSON.parse(readFileSync(new URL('../../benchmarks/spatial2d_scipy_reference.json',import.meta.url),'utf8'));


const meshFixture=JSON.parse(readFileSync(new URL('../../benchmarks/spatial2d_mesh_convergence_scipy.json',import.meta.url),'utf8'));

test('2-D finite-volume solver converges against independent SciPy BDF/Radau references across four meshes',()=>{
 const {widthMeters,heightMeters,diffusionCoefficientM2PerS,timeSeconds,explicitDtFactor}=meshFixture.domain;
 const errors:number[]=[];
 for(const mesh of meshFixture.meshes){
  const {cells,steps,timeStepSeconds}=mesh;
  const dx=widthMeters/cells,dy=heightMeters/cells;
  const initial=Array.from({length:cells},(_,y)=>Array.from({length:cells},(_,x)=>
   1+0.2*Math.cos(Math.PI*(x+0.5)*dx/widthMeters)*Math.cos(Math.PI*(y+0.5)*dy/heightMeters)));
  const result=simulateReactionDiffusion2D({
   widthMeters,heightMeters,timeStepSeconds,steps,reactions:[],
   species:[{id:'A',diffusionCoefficientM2PerS,initialConcentrationMolPerM3:initial}],
  });
  const exact=initial.map((row,y)=>row.map((_,x)=>
   1+0.2*Math.cos(Math.PI*(x+0.5)*dx/widthMeters)*Math.cos(Math.PI*(y+0.5)*dy/heightMeters)*
   Math.exp(-diffusionCoefficientM2PerS*Math.PI**2*(widthMeters**-2+heightMeters**-2)*timeSeconds)));
  const continuumError=Math.max(...result.concentrationsMolPerM3.A.flatMap((row,y)=>
   row.map((value,x)=>Math.abs(value-exact[y][x]))));
  const explicitVsBdfError=mesh.maxAbsExplicitVsBdf;
  assert.ok(Math.abs(continuumError-mesh.maxAbsBdfVsContinuum-explicitVsBdfError)<2e-7,
   'Explicit-vs-continuum error should be consistent with independent BDF spatial error and explicit time error');
  assert.ok(mesh.maxAbsBdfRadau<3e-9,'Independent BDF and Radau references must agree');
  const total=result.concentrationsMolPerM3.A.flat().reduce((sum,value)=>sum+value,0);
  assert.ok(Math.abs(total-cells*cells)<1e-9,'No-flux diffusion must conserve spatial mass');
  errors.push(explicitVsBdfError);
 }
 const ratios=errors.slice(0,-1).map((error,index)=>error/errors[index+1]);
 assert.ok(ratios.every(ratio=>ratio>3.7),
  'Expected approximately second-order mesh convergence against SciPy BDF; ratios='+JSON.stringify(ratios));
});

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
