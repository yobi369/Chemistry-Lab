import React,{useState} from 'react';
import {simulateReactionDiffusion2D} from '../research';
import type {ReactionDiffusion2DResult} from '../research';

const sample=[{id:'A',diffusionCoefficientM2PerS:0.01,velocityXMetersPerSecond:0,velocityYMetersPerSecond:0,
 initialConcentrationMolPerM3:[[1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]}];
const pretty=(value:number)=>Number(value.toPrecision(5)).toLocaleString();

export const SpatialChemistry2DPanel:React.FC=()=>{
 const [width,setWidth]=useState('1'),[height,setHeight]=useState('1'),[dt,setDt]=useState('0.001'),[steps,setSteps]=useState('10');
 const [boundary,setBoundary]=useState<'no-flux'|'periodic'>('no-flux');
 const [speciesJson,setSpeciesJson]=useState(JSON.stringify(sample,null,2)),[reactionJson,setReactionJson]=useState('[]');
 const [result,setResult]=useState<ReactionDiffusion2DResult|null>(null),[error,setError]=useState<string|null>(null);
 const run=()=>{
  try{
   const output=simulateReactionDiffusion2D({widthMeters:Number(width),heightMeters:Number(height),timeStepSeconds:Number(dt),
    steps:Number(steps),boundaryCondition:boundary,species:JSON.parse(speciesJson),reactions:JSON.parse(reactionJson)});
   setResult(output);setError(null);
  }catch(cause){setResult(null);setError(cause instanceof Error?cause.message:'2-D spatial simulation failed.');}
 };
 return <article className="rounded-2xl border border-sky-900/50 bg-zinc-950/80 p-5">
  <h4 className="text-sm font-semibold">Two-dimensional reaction–diffusion & transport</h4>
  <p className="mt-1 text-[11px] leading-5 text-zinc-500">Rectangular cell-centred finite volumes with conservative diffusion, x/y upwind advection, no-flux or periodic boundaries and first-order reaction channels.</p>
  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
   <label className="text-[11px] text-zinc-400">Width (m)<input type="number" step="any" value={width} onChange={e=>setWidth(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
   <label className="text-[11px] text-zinc-400">Height (m)<input type="number" step="any" value={height} onChange={e=>setHeight(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
   <label className="text-[11px] text-zinc-400">Time step (s)<input type="number" step="any" value={dt} onChange={e=>setDt(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
   <label className="text-[11px] text-zinc-400">Steps<input type="number" value={steps} onChange={e=>setSteps(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
  </div>
  <label className="mt-3 block text-[11px] text-zinc-400">Boundary condition
   <select value={boundary} onChange={e=>setBoundary(e.target.value as 'no-flux'|'periodic')} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100"><option value="no-flux">No-flux walls</option><option value="periodic">Periodic wrap</option></select>
  </label>
  <div className="mt-3 grid gap-3 lg:grid-cols-2">
   <label className="block text-[11px] text-zinc-400">Species JSON (concentration grid [y][x], D m²/s, velocities m/s)
    <textarea rows={10} value={speciesJson} onChange={e=>setSpeciesJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
   </label>
   <label className="block text-[11px] text-zinc-400">First-order reaction channels JSON
    <textarea rows={10} value={reactionJson} onChange={e=>setReactionJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
   </label>
  </div>
  <button type="button" onClick={run} className="mt-3 rounded-lg border border-sky-700 bg-sky-950/50 px-4 py-2 text-xs font-medium text-sky-200">Run 2-D spatial simulation</button>
  {error&&<p role="alert" className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</p>}
  {result&&<div className="mt-4 space-y-3 rounded-xl bg-black/30 p-3 text-xs">
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div><p className="text-zinc-500">Elapsed</p><p className="mt-1 font-mono">{pretty(result.elapsedSeconds)} s</p></div>
    <div><p className="text-zinc-500">Grid spacing</p><p className="mt-1 font-mono">{pretty(result.cellWidthXMeters)} × {pretty(result.cellWidthYMeters)} m</p></div>
    <div><p className="text-zinc-500">Stability number</p><p className="mt-1 font-mono">{pretty(result.stabilityNumber)}</p></div>
    <div><p className="text-zinc-500">Boundary</p><p className="mt-1 font-mono">{result.boundaryCondition}</p></div>
   </div>
   {Object.entries(result.concentrationsMolPerM3).map(([id,grid])=><div key={id} className="overflow-x-auto"><p className="mb-1 text-zinc-500">{id} concentration grid (mol/m³)</p><table className="text-[10px]"><tbody>{(grid as readonly (readonly number[])[]).map((row,y)=><tr key={y}>{row.map((value,x)=><td key={x} className="min-w-14 border border-zinc-800 p-1 text-center font-mono">{pretty(value)}</td>)}</tr>)}</tbody></table></div>)}
  </div>}
  <p className="mt-3 text-[10px] leading-5 text-zinc-500">Explicit first-order model. CI checks manufactured-solution convergence and an independent SciPy BDF/Radau method-of-lines reference case. This is not a stiff or general-purpose PDE solver.</p>
 </article>;
};
