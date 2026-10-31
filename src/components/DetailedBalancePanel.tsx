import React,{useState} from 'react';
import {deriveDetailedBalanceRates,simulateDetailedBalanceReversible,validateDetailedBalanceEquilibrium} from '../research';
import type {ReversibleThermodynamicReaction} from '../research';

const R=8.31446261815324,T0=298.15;
const defaultReaction:ReversibleThermodynamicReaction={id:'A-reversible-B',reactants:[{speciesId:'A',coefficient:1}],products:[{speciesId:'B',coefficient:1}],forwardRateConstantPerSecond:0.8};
const pretty=(value:number)=>Number(value.toPrecision(6)).toLocaleString();

export const DetailedBalancePanel:React.FC=()=>{
 const [reactionJson,setReactionJson]=useState(JSON.stringify(defaultReaction,null,2));
 const [formationJson,setFormationJson]=useState(JSON.stringify({A:0,B:-R*T0*Math.log(4)},null,2));
 const [initialJson,setInitialJson]=useState(JSON.stringify({A:1,B:0},null,2));
 const [equilibriumJson,setEquilibriumJson]=useState(JSON.stringify({A:0.2,B:0.8},null,2));
 const [temperature,setTemperature]=useState(String(T0));
 const [dt,setDt]=useState('0.01');
 const [steps,setSteps]=useState('10000');
 const [result,setResult]=useState<null|{rates:ReturnType<typeof deriveDetailedBalanceRates>;equilibrium:ReturnType<typeof validateDetailedBalanceEquilibrium>;final:ReturnType<typeof simulateDetailedBalanceReversible>}>(null);
 const [error,setError]=useState<string|null>(null);
 const run=()=>{
  try{
   const reaction=JSON.parse(reactionJson) as ReversibleThermodynamicReaction;
   const formation=JSON.parse(formationJson) as Record<string,number>;
   const initial=JSON.parse(initialJson) as Record<string,number>;
   const equilibriumActivities=JSON.parse(equilibriumJson) as Record<string,number>;
   const temp=Number(temperature),timeStep=Number(dt),count=Number(steps);
   const rates=deriveDetailedBalanceRates({reaction,standardGibbsFormationJPerMol:formation,temperatureKelvin:temp});
   const equilibrium=validateDetailedBalanceEquilibrium({reaction,standardGibbsFormationJPerMol:formation,temperatureKelvin:temp,activities:equilibriumActivities});
   const speciesIds=Object.keys(initial);
   const final=simulateDetailedBalanceReversible({
    speciesIds,initialActivities:initial,reactions:[reaction],standardGibbsFormationJPerMol:formation,
    temperatureKelvin:temp,timeStepSeconds:timeStep,steps:count,
   });
   setResult({rates,equilibrium,final});setError(null);
  }catch(cause){setResult(null);setError(cause instanceof Error?cause.message:'Detailed-balance simulation failed.');}
 };
 return <article className="rounded-2xl border border-emerald-900/50 bg-zinc-950/80 p-5">
  <h4 className="text-sm font-semibold">Detailed-balance reversible kinetics</h4>
  <p className="mt-1 text-[11px] leading-5 text-zinc-500">Derive reverse rate constants from standard Gibbs formation energies, validate Q=K and simulate reversible mass-action dynamics in dimensionless ideal activities.</p>
  <div className="mt-3 grid gap-3 lg:grid-cols-2">
   <label className="block text-[11px] text-zinc-400">Reversible reaction JSON
    <textarea rows={7} value={reactionJson} onChange={e=>setReactionJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
   </label>
   <label className="block text-[11px] text-zinc-400">Standard Gibbs formation energies (J/mol)
    <textarea rows={7} value={formationJson} onChange={e=>setFormationJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
   </label>
   <label className="block text-[11px] text-zinc-400">Initial dimensionless activities
    <textarea rows={4} value={initialJson} onChange={e=>setInitialJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
   </label>
   <label className="block text-[11px] text-zinc-400">Activities to validate as equilibrium (all positive)
    <textarea rows={4} value={equilibriumJson} onChange={e=>setEquilibriumJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
   </label>
  </div>
  <div className="mt-3 grid grid-cols-3 gap-2">
   <label className="text-[11px] text-zinc-400">Temperature (K)<input type="number" value={temperature} onChange={e=>setTemperature(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
   <label className="text-[11px] text-zinc-400">Step (s)<input type="number" value={dt} onChange={e=>setDt(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
   <label className="text-[11px] text-zinc-400">Steps<input type="number" value={steps} onChange={e=>setSteps(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 font-mono text-xs"/></label>
  </div>
  <button type="button" onClick={run} className="mt-3 rounded-lg border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-xs font-medium text-emerald-200">Derive rates, validate equilibrium & simulate</button>
  {error&&<p role="alert" className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</p>}
  {result&&<div className="mt-4 space-y-3 rounded-xl bg-black/30 p-3 text-xs">
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div><p className="text-zinc-500">K°</p><p className="mt-1 font-mono text-emerald-200">{result.rates.equilibriumConstant===null?'overflow':pretty(result.rates.equilibriumConstant)}</p></div>
    <div><p className="text-zinc-500">k forward (s⁻¹)</p><p className="mt-1 font-mono text-zinc-200">{pretty(result.rates.forwardRateConstantPerSecond)}</p></div>
    <div><p className="text-zinc-500">k reverse (s⁻¹)</p><p className="mt-1 font-mono text-zinc-200">{pretty(result.rates.reverseRateConstantPerSecond)}</p></div>
    <div><p className="text-zinc-500">Q=K check</p><p className={result.equilibrium.equilibriumConsistent?'text-emerald-300':'text-amber-300'}>{result.equilibrium.equilibriumConsistent?'Passed':'Failed'}</p></div>
   </div>
   <div><p className="text-zinc-500">Equilibrium flux imbalance</p><p className="mt-1 font-mono text-zinc-200">{pretty(result.equilibrium.relativeFluxImbalance)}</p></div>
   <div><p className="text-zinc-500">Simulated final activities after {pretty(result.final.elapsedSeconds)} s</p>
    <div className="mt-1 grid grid-cols-2 gap-2">{Object.entries(result.final.activities).map(([id,value])=><p key={id} className="rounded-lg border border-zinc-800 p-2 font-mono">{id}: {pretty(Number(value))}</p>)}</div>
   </div>
  </div>}
  <p className="mt-3 text-[10px] leading-5 text-zinc-500">This model assumes a shared ideal-activity standard-state convention. It does not include non-ideal activity coefficients, phases, electrochemical potentials or stiff integration.</p>
 </article>;
};
