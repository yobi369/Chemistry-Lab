import React,{useState} from 'react';
import {simulateReactionDiffusion1D} from '../research';
import type {ReactionDiffusion1DResult} from '../research';

const initialSpecies=[{id:'A',diffusionCoefficientM2PerS:0.01,advectionVelocityMetersPerSecond:0,initialConcentrationMolPerM3:[1,0,0,0,0,0,0,0,0,0]}];
const pretty=(value:number)=>Number(value.toPrecision(5)).toLocaleString();

export const SpatialChemistryPanel:React.FC=()=>{
 const [length,setLength]=useState('1');
 const [dt,setDt]=useState('0.001');
 const [steps,setSteps]=useState('100');
 const [boundary,setBoundary]=useState<'no-flux'|'periodic'>('no-flux');
 const [speciesJson,setSpeciesJson]=useState(JSON.stringify(initialSpecies,null,2));
 const [reactionJson,setReactionJson]=useState('[]');
 const [result,setResult]=useState<ReactionDiffusion1DResult|null>(null);
 const [error,setError]=useState<string|null>(null);
 const run=()=>{
  try{
   const output=simulateReactionDiffusion1D({
    lengthMeters:Number(length),timeStepSeconds:Number(dt),steps:Number(steps),
    boundaryCondition:boundary,species:JSON.parse(speciesJson),reactions:JSON.parse(reactionJson),
   });
   setResult(output);setError(null);
  }catch(cause){setResult(null);setError(cause instanceof Error?cause.message:'Spatial simulation failed.');}
 };
 return <article className="rounded-2xl border border-cyan-900/50 bg-zinc-950/80 p-5">
  <h4 className="text-sm font-semibold">Spatial reaction–diffusion & transport (1-D)</h4>
  <p className="mt-1 text-[11px] leading-5 text-zinc-500">Conservative finite-volume diffusion, upwind advection and first-order reaction sources with explicit stability enforcement.</p>
  <div className="mt-3 grid grid-cols-3 gap-2">
   <label className="text-[11px] text-zinc-400">Domain length (m)<input type="number" step="any" value={length} onChange={e=>setLength(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
   <label className="text-[11px] text-zinc-400">Time step (s)<input type="number" step="any" value={dt} onChange={e=>setDt(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
   <label className="text-[11px] text-zinc-400">Steps<input type="number" value={steps} onChange={e=>setSteps(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
  </div>
  <label className="mt-3 block text-[11px] text-zinc-400">Boundary condition
   <select value={boundary} onChange={e=>setBoundary(e.target.value as 'no-flux'|'periodic')} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100"><option value="no-flux">No-flux walls</option><option value="periodic">Periodic wrap</option></select>
  </label>
  <div className="mt-3 grid gap-3 lg:grid-cols-2">
   <label className="block text-[11px] text-zinc-400">Species JSON (D in m²/s, velocity in m/s, cell concentrations in mol/m³)
    <textarea rows={9} value={speciesJson} onChange={e=>setSpeciesJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
   </label>
   <label className="block text-[11px] text-zinc-400">First-order reaction channels JSON
    <textarea rows={9} value={reactionJson} onChange={e=>setReactionJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
   </label>
  </div>
  <button type="button" onClick={run} className="mt-3 rounded-lg border border-cyan-700 bg-cyan-950/50 px-4 py-2 text-xs font-medium text-cyan-200">Run spatial simulation</button>
  {error&&<p role="alert" className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</p>}
  {result&&<div className="mt-4 space-y-3 rounded-xl bg-black/30 p-3 text-xs">
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div><p className="text-zinc-500">Elapsed</p><p className="mt-1 font-mono">{pretty(result.elapsedSeconds)} s</p></div>
    <div><p className="text-zinc-500">Cell width</p><p className="mt-1 font-mono">{pretty(result.cellWidthMeters)} m</p></div>
    <div><p className="text-zinc-500">Stability number</p><p className="mt-1 font-mono">{pretty(result.stabilityNumber)}</p></div>
    <div><p className="text-zinc-500">Boundary</p><p className="mt-1 font-mono">{result.boundaryCondition}</p></div>
   </div>
   <div className="overflow-x-auto"><table className="min-w-[360px] w-full text-left text-[10px]"><thead><tr className="text-zinc-500"><th className="p-1">Cell</th><th>Centre x (m)</th>{Object.keys(result.concentrationsMolPerM3).map(id=><th key={id}>{id} (mol/m³)</th>)}</tr></thead><tbody>{Array.from({length:result.concentrationsMolPerM3[Object.keys(result.concentrationsMolPerM3)[0]]?.length??0},(_,i)=><tr key={i} className="border-t border-zinc-800"><td className="p-1">{i}</td><td>{pretty((i+0.5)*result.cellWidthMeters)}</td>{Object.entries(result.concentrationsMolPerM3).map(([id,row])=><td key={id} className="font-mono">{pretty(row[i])}</td>)}</tr>)}</tbody></table></div>
  </div>}
  <p className="mt-3 text-[10px] leading-5 text-zinc-500">1-D constant-coefficient explicit model only. Refine the mesh and time step; use the manufactured-solution tests as a baseline, not a substitute for an independent PDE solver or experimental validation.</p>
 </article>;
};
