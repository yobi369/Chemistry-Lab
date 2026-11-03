/**
 * Browser-side adapter for the official RDKit.js MinimalLib WebAssembly build.
 * The pinned runtime is loaded lazily from jsDelivr; no molecule data is sent
 * to a remote service. InChI generation is feature-detected and fails closed
 * if the distributed WASM build does not expose the InChI API.
 */
export const RDKIT_VERSION = '2026.9.1';
export const RDKIT_CDN_BASE = `https://cdn.jsdelivr.net/npm/@rdkit/rdkit@${RDKIT_VERSION}/dist/`;
export const RDKIT_LOCAL_BASE = `/vendor/rdkit/${RDKIT_VERSION}/`;

export interface RDKitMolecule {
  get_smiles(options?: string): string;
  get_inchi?: () => string;
  get_json(): string;
  get_descriptors(): string;
  get_num_atoms(): number;
  get_num_bonds(): number;
  delete(): void;
}
export interface RDKitModule {
  version(): string;
  get_mol(smiles: string, options?: string): RDKitMolecule | null;
  get_inchikey_for_inchi(inchi: string): string;
}
export interface RDKitMolecularIdentity {
  toolkit: 'RDKit.js';
  toolkitVersion: string;
  inputSmiles: string;
  canonicalIsomericSmiles: string;
  inchi: string;
  inchiKey: string;
  atomCount: number;
  bondCount: number;
  descriptors: Readonly<Record<string, unknown>>;
  /** Raw RDKit JSON preserves atom/bond properties including stereo annotations. */
  structureJson: unknown;
}

interface RDKitWorkerResponse {
  readonly id: number;
  readonly result?: RDKitMolecularIdentity;
  readonly error?: string;
}

interface PendingRDKitRequest {
  readonly resolve: (value: RDKitMolecularIdentity) => void;
  readonly reject: (reason: Error) => void;
}

let rdkitWorker: Worker | undefined;
let nextWorkerRequestId = 0;
const pendingWorkerRequests = new Map<number, PendingRDKitRequest>();

function rejectPendingWorkerRequests(error: Error): void {
  for (const request of pendingWorkerRequests.values()) request.reject(error);
  pendingWorkerRequests.clear();
}

/** RDKit.js uses dynamic Embind wrappers; isolate its required unsafe-eval permission in a dedicated worker. */
function getRDKitWorker(): Worker {
  if (typeof Worker === 'undefined') throw new Error('This browser does not support Web Workers required for isolated RDKit execution.');
  if (rdkitWorker) return rdkitWorker;
  const worker = new Worker('/rdkit-worker.js', { name: 'chemistry-lab-rdkit' });
  worker.onmessage = (event: MessageEvent<RDKitWorkerResponse>) => {
    const request = pendingWorkerRequests.get(event.data.id);
    if (!request) return;
    pendingWorkerRequests.delete(event.data.id);
    if (event.data.error) request.reject(new Error(event.data.error));
    else if (event.data.result) request.resolve(event.data.result);
    else request.reject(new Error('RDKit worker returned an empty analysis response.'));
  };
  worker.onerror = event => {
    event.preventDefault();
    const error = new Error(event.message || 'The isolated RDKit worker failed to execute.');
    rejectPendingWorkerRequests(error);
    worker.terminate();
    if (rdkitWorker === worker) rdkitWorker = undefined;
  };
  worker.onmessageerror = () => {
    const error = new Error('The isolated RDKit worker returned an unreadable message.');
    rejectPendingWorkerRequests(error);
    worker.terminate();
    if (rdkitWorker === worker) rdkitWorker = undefined;
  };
  rdkitWorker = worker;
  return worker;
}

/**
 * Parse/sanitize and identify a SMILES string with RDKit. Sanitization invokes
 * RDKit's chemistry checks; canonical isomeric SMILES and InChI retain supported
 * stereochemical distinctions. The RDKit molecule is always released.
 */
export function analyzeSmilesWithRDKit(smiles: string, rdkit: RDKitModule): RDKitMolecularIdentity {
  if (typeof smiles !== 'string' || !smiles.trim() || smiles.length > 10_000) {
    throw new Error('Provide a non-empty SMILES string of at most 10,000 characters.');
  }
  const molecule = rdkit.get_mol(smiles.trim(), JSON.stringify({ sanitize: true }));
  if (!molecule) throw new Error('RDKit could not parse and sanitize this SMILES. Check syntax, valence and formal charges.');
  try {
    const canonicalIsomericSmiles = molecule.get_smiles(JSON.stringify({
      canonical: true,
      doIsomericSmiles: true,
    }));
    if (!canonicalIsomericSmiles) throw new Error('RDKit did not return a canonical isomeric SMILES.');
    if (typeof molecule.get_inchi !== 'function') {
      throw new Error('This RDKit.js WASM build does not expose InChI generation. Do not substitute a guessed identifier.');
    }
    const inchi = molecule.get_inchi();
    if (!inchi || !inchi.startsWith('InChI=')) throw new Error('RDKit could not generate a standard InChI for this structure.');
    const inchiKey = rdkit.get_inchikey_for_inchi(inchi);
    if (!inchiKey || !/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(inchiKey)) {
      throw new Error('RDKit did not return a valid standard InChIKey.');
    }
    const descriptors = JSON.parse(molecule.get_descriptors()) as Record<string, unknown>;
    const structureJson = JSON.parse(molecule.get_json()) as unknown;
    return {
      toolkit: 'RDKit.js',
      toolkitVersion: rdkit.version(),
      inputSmiles: smiles.trim(),
      canonicalIsomericSmiles,
      inchi,
      inchiKey,
      atomCount: molecule.get_num_atoms(),
      bondCount: molecule.get_num_bonds(),
      descriptors,
      structureJson,
    };
  } finally {
    molecule.delete();
  }
}

export async function analyzeSmiles(smiles: string): Promise<RDKitMolecularIdentity> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    throw new Error('RDKit.js analysis requires a browser with Web Worker support.');
  }
  if (typeof smiles !== 'string' || !smiles.trim() || smiles.length > 10_000) {
    throw new Error('Provide a non-empty SMILES string of at most 10,000 characters.');
  }
  const id = ++nextWorkerRequestId;
  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(id, { resolve, reject });
    try {
      getRDKitWorker().postMessage({ id, smiles: smiles.trim() });
    } catch (error) {
      pendingWorkerRequests.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
