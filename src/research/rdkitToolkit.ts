/**
 * Browser-side adapter for the official RDKit.js MinimalLib WebAssembly build.
 * The pinned runtime is loaded lazily from jsDelivr; no molecule data is sent
 * to a remote service. InChI generation is feature-detected and fails closed
 * if the distributed WASM build does not expose the InChI API.
 */
export const RDKIT_VERSION = '2026.9.1';
export const RDKIT_CDN_BASE = `https://cdn.jsdelivr.net/npm/@rdkit/rdkit@${RDKIT_VERSION}/dist/`;

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

declare global {
  interface Window {
    initRDKitModule?: (options?: { locateFile?: (file: string) => string }) => Promise<RDKitModule>;
    __chemistryLabRDKitPromise?: Promise<RDKitModule>;
  }
}

/** Load the pinned official RDKit.js WASM runtime once per page. */
export async function loadRDKitToolkit(): Promise<RDKitModule> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('RDKit.js is a browser WebAssembly toolkit and requires a browser environment.');
  }
  if (window.__chemistryLabRDKitPromise) return window.__chemistryLabRDKitPromise;
  window.__chemistryLabRDKitPromise = (async () => {
    if (!window.initRDKitModule) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-chemistry-lab-rdkit="true"]');
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Could not load the RDKit.js script.')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = `${RDKIT_CDN_BASE}RDKit_minimal.js`;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.dataset.chemistryLabRdkit = 'true';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Could not load the pinned RDKit.js runtime from jsDelivr.'));
        document.head.appendChild(script);
      });
    }
    if (!window.initRDKitModule) throw new Error('RDKit.js loaded without exposing its WebAssembly initializer.');
    return window.initRDKitModule({ locateFile: file => new URL(file, RDKIT_CDN_BASE).toString() });
  })().catch(error => {
    window.__chemistryLabRDKitPromise = undefined;
    throw error;
  });
  return window.__chemistryLabRDKitPromise;
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
  const rdkit = await loadRDKitToolkit();
  return analyzeSmilesWithRDKit(smiles, rdkit);
}
