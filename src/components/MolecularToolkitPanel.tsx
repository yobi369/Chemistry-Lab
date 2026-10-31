import React, { useState } from 'react';
import { analyzeSmiles, type RDKitMolecularIdentity } from '../research/rdkitToolkit';

const example = 'C[C@H](O)C(=O)O';

export const MolecularToolkitPanel: React.FC = () => {
  const [smiles,setSmiles]=useState(example);
  const [result,setResult]=useState<RDKitMolecularIdentity|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try { setResult(await analyzeSmiles(smiles)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'RDKit molecular analysis failed.'); }
    finally { setLoading(false); }
  };
  return <article className="rounded-2xl border border-emerald-900/50 bg-zinc-950/80 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 className="text-sm font-semibold">RDKit molecular identity & stereochemistry</h4>
        <p className="mt-1 max-w-3xl text-[11px] leading-5 text-zinc-500">Official RDKit.js WebAssembly toolkit. Parsing and sanitization are performed by RDKit; canonical isomeric SMILES, InChI and InChIKey are generated locally in this browser.</p>
      </div>
      <span className="rounded-full border border-emerald-800 px-2 py-1 font-mono text-[10px] text-emerald-300">RDKit { '2026.9.1' }</span>
    </div>
    <label className="mt-3 block text-[11px] text-zinc-400">Input SMILES
      <textarea rows={3} value={smiles} onChange={event=>setSmiles(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3 font-mono text-xs text-zinc-100"/>
    </label>
    <button type="button" onClick={run} disabled={loading} className="mt-3 rounded-lg border border-emerald-700 bg-emerald-950/50 px-4 py-2 text-xs font-medium text-emerald-200 disabled:opacity-50">{loading?'Loading RDKit / analysing…':'Validate & identify molecule'}</button>
    {error && <p role="alert" className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</p>}
    {result && <div className="mt-4 space-y-3 rounded-xl bg-black/30 p-3 text-xs">
      <div><p className="text-zinc-500">Canonical isomeric SMILES</p><p className="mt-1 break-all font-mono text-emerald-200">{result.canonicalIsomericSmiles}</p></div>
      <div><p className="text-zinc-500">Standard InChI</p><p className="mt-1 break-all font-mono text-zinc-200">{result.inchi}</p></div>
      <div><p className="text-zinc-500">InChIKey</p><p className="mt-1 break-all font-mono text-zinc-200">{result.inchiKey}</p></div>
      <div className="grid grid-cols-3 gap-2">
        <div><p className="text-zinc-500">Atoms</p><p className="mt-1 font-mono text-zinc-200">{result.atomCount}</p></div>
        <div><p className="text-zinc-500">Bonds</p><p className="mt-1 font-mono text-zinc-200">{result.bondCount}</p></div>
        <div><p className="text-zinc-500">Toolkit</p><p className="mt-1 font-mono text-zinc-200">{result.toolkitVersion}</p></div>
      </div>
      <details><summary className="cursor-pointer text-zinc-400">RDKit descriptors & stereochemical structure JSON</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-900 p-2 text-[10px] text-zinc-300">{JSON.stringify({descriptors:result.descriptors,structure:result.structureJson},null,2)}</pre></details>
      <p className="text-[10px] text-zinc-500">RDKit molecule memory is released after analysis. Structure processing is local; the pinned runtime and WASM binary are fetched from jsDelivr on first use.</p>
    </div>}
  </article>;
};
