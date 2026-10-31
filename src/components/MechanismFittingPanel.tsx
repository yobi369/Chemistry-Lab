import React, { useState } from 'react';
import { fitMassActionMechanism } from '../research';
import type { NonlinearKineticFit } from '../research';

const defaultMechanism={
  speciesIds:['A','B','C'],
  initialConcentrations:{A:1,B:0,C:0},
  reactions:[
    {id:'k1',reactants:[{speciesId:'A',coefficient:1}],products:[{speciesId:'B',coefficient:1}]},
    {id:'k2',reactants:[{speciesId:'B',coefficient:1}],products:[{speciesId:'C',coefficient:1}]},
  ],
};
const defaultParameters=[
  {reactionId:'k1',initialGuess:0.2,lowerBound:0.001,upperBound:2,units:'s^-1'},
  {reactionId:'k2',initialGuess:0.2,lowerBound:0.001,upperBound:2,units:'s^-1'},
];
const times=[0,0.5,1,1.5,2,3,4,5];
const defaultObservations=times.flatMap(time=>{
  const a=Math.exp(-0.7*time);
  const b=0.7/(0.25-0.7)*(Math.exp(-0.7*time)-Math.exp(-0.25*time));
  const c=1-a-b;
  return [[time,'A',a],[time,'B',b],[time,'C',c]].map(row=>row.join(',')).join('\n');
}).join('\n');
const pretty=(value:number)=>Number(value.toPrecision(6)).toLocaleString();

export const MechanismFittingPanel:React.FC=()=>{
  const [mechanismJson,setMechanismJson]=useState(JSON.stringify(defaultMechanism,null,2));
  const [parameterJson,setParameterJson]=useState(JSON.stringify(defaultParameters,null,2));
  const [observationCsv,setObservationCsv]=useState(defaultObservations);
  const [maxStep,setMaxStep]=useState('0.005');
  const [result,setResult]=useState<NonlinearKineticFit|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const run=()=>{
    setLoading(true);setError(null);setResult(null);
    try{
      const mechanism=JSON.parse(mechanismJson);
      const parameters=JSON.parse(parameterJson);
      const observations=observationCsv.split(/\r?\n/).map((line,index)=>{
        const parts=line.split(',').map(part=>part.trim());
        if(parts.length<3||parts.length>4)throw new Error(`Line ${index+1}: use timeSeconds,speciesId,value[,standardDeviation].`);
        const timeSeconds=Number(parts[0]),value=Number(parts[2]);
        const standardDeviation=parts.length===4?Number(parts[3]):undefined;
        if(!Number.isFinite(timeSeconds)||!Number.isFinite(value)||(standardDeviation!==undefined&&!Number.isFinite(standardDeviation)))throw new Error(`Line ${index+1}: numeric fields must be finite.`);
        return {timeSeconds,speciesId:parts[1],value,...(standardDeviation===undefined?{}:{standardDeviation})};
      });
      const fit=fitMassActionMechanism(mechanism,parameters,observations,{maxIntegrationStepSeconds:Number(maxStep)});
      setResult(fit);
    }catch(cause){setError(cause instanceof Error?cause.message:'Nonlinear mechanism fit failed.');}
    finally{setLoading(false);}
  };
  return <article className="rounded-2xl border border-violet-900/50 bg-zinc-950/80 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 className="text-sm font-semibold">Multi-step nonlinear mechanism fitting</h4>
        <p className="mt-1 max-w-3xl text-[11px] leading-5 text-zinc-500">Fit bounded macroscopic mass-action rate constants to multi-species time-series. Uses fixed-step RK4 and bounded Levenberg–Marquardt; initial concentrations and mechanism topology remain fixed.</p>
      </div>
      <span className="rounded-full border border-violet-800 px-2 py-1 text-[10px] text-violet-300">RK4 + LM</span>
    </div>
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <label className="block text-[11px] text-zinc-400">Mechanism JSON
        <textarea rows={10} value={mechanismJson} onChange={e=>setMechanismJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
      </label>
      <label className="block text-[11px] text-zinc-400">Parameter bounds JSON (one per reaction)
        <textarea rows={10} value={parameterJson} onChange={e=>setParameterJson(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
      </label>
    </div>
    <label className="mt-3 block text-[11px] text-zinc-400">Observation CSV: timeSeconds,speciesId,value[,standardDeviation]
      <textarea rows={8} value={observationCsv} onChange={e=>setObservationCsv(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 font-mono text-[10px] text-zinc-200"/>
    </label>
    <label className="mt-3 block max-w-xs text-[11px] text-zinc-400">Maximum RK4 integration step (s)
      <input type="number" min="0.0000001" step="any" value={maxStep} onChange={e=>setMaxStep(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100"/>
    </label>
    <button type="button" onClick={run} disabled={loading} className="mt-3 rounded-lg border border-violet-700 bg-violet-950/50 px-4 py-2 text-xs font-medium text-violet-200 disabled:opacity-50">{loading?'Optimising mechanism…':'Fit multi-step mechanism'}</button>
    {error&&<p role="alert" className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</p>}
    {result&&<div className="mt-4 space-y-3 rounded-xl bg-black/30 p-3 text-xs">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><p className="text-zinc-500">Converged</p><p className={result.converged?'text-emerald-300':'text-amber-300'}>{result.converged?'Yes':'No'}</p></div>
        <div><p className="text-zinc-500">Local identifiability</p><p className={result.locallyIdentifiable?'text-emerald-300':'text-amber-300'}>{result.locallyIdentifiable?'Full rank':'Rank deficient'}</p></div>
        <div><p className="text-zinc-500">Iterations</p><p className="font-mono text-zinc-200">{result.iterations}</p></div>
        <div><p className="text-zinc-500">Information condition</p><p className="font-mono text-zinc-200">{Number.isFinite(result.informationConditionNumber)?pretty(result.informationConditionNumber):'∞'}</p></div>
      </div>
      <div><p className="mb-1 text-zinc-500">Estimated rate constants</p>
        <div className="grid gap-2 sm:grid-cols-2">{Object.entries(result.parameterEstimates).map(([id,value])=><div key={id} className="rounded-lg border border-zinc-800 p-2"><p className="font-mono text-violet-200">{id}: {pretty(Number(value))}</p><p className="mt-1 text-[10px] text-zinc-500">SE {result.standardErrors?pretty(result.standardErrors[id]):'not identifiable'}</p></div>)}</div>
      </div>
      {result.correlationMatrix&&<div className="overflow-x-auto"><p className="mb-1 text-zinc-500">Local parameter correlation matrix</p><table className="min-w-[320px] text-left text-[10px]"><thead><tr><th className="p-1">Parameter</th>{Object.keys(result.parameterEstimates).map(id=><th key={id} className="p-1">{id}</th>)}</tr></thead><tbody>{Object.entries(result.correlationMatrix).map(([id,row])=><tr key={id} className="border-t border-zinc-800"><td className="p-1 font-mono">{id}</td>{Object.values(row).map((value,index)=><td key={index} className="p-1 font-mono">{Number.isFinite(value)?pretty(value):'n/a'}</td>)}</tr>)}</tbody></table></div>}
      <div className="overflow-x-auto"><p className="mb-1 text-zinc-500">Fitted observations</p><table className="min-w-[460px] w-full text-left text-[10px]"><thead><tr className="text-zinc-500"><th className="p-1">Time</th><th>Species</th><th>Observed</th><th>Predicted</th><th>Residual</th></tr></thead><tbody>{result.fitted.map((row,index)=><tr key={index} className="border-t border-zinc-800 text-zinc-300"><td className="p-1">{row.timeSeconds}</td><td>{row.speciesId}</td><td>{pretty(row.observed)}</td><td>{pretty(row.predicted)}</td><td>{pretty(row.residual)}</td></tr>)}</tbody></table></div>
      {result.warnings.map((warning,index)=><p key={index} className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-2 text-[10px] text-amber-200">{warning}</p>)}
      <p className="text-[10px] text-zinc-500">Weighted residual sum of squares: {pretty(result.weightedResidualSumSquares)} · degrees of freedom: {result.degreesOfFreedom}. Covariance is a local linear approximation; observation-error correlations are not modelled.</p>
    </div>}
  </article>;
};
