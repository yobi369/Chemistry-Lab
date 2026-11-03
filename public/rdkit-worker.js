const RDKIT_VERSION = '2026.9.1';
const LOCAL_BASE = new URL(`/vendor/rdkit/${RDKIT_VERSION}/`, self.location.origin).toString();
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@rdkit/rdkit@${RDKIT_VERSION}/dist/`;
let rdkitPromise;

async function loadRDKit() {
  if (rdkitPromise) return rdkitPromise;
  rdkitPromise = (async () => {
    const candidates = [
      { label: 'same-origin packaged assets', base: LOCAL_BASE, script: new URL('RDKit_minimal.js', LOCAL_BASE).toString() },
      { label: 'pinned jsDelivr fallback', base: CDN_BASE, script: `${CDN_BASE}RDKit_minimal.js` },
    ];
    const failures = [];
    for (const candidate of candidates) {
      try {
        if (typeof self.initRDKitModule !== 'function') importScripts(candidate.script);
        if (typeof self.initRDKitModule !== 'function') throw new Error('RDKit.js script did not expose its WebAssembly initializer.');
        const module = await self.initRDKitModule({ locateFile: file => new URL(file, candidate.base).toString() });
        const version = String(module.version()).split('.').map(part => String(Number(part))).join('.');
        if (version !== RDKIT_VERSION) throw new Error(`Expected RDKit ${RDKIT_VERSION}, received ${module.version()}.`);
        return module;
      } catch (error) {
        failures.push(`${candidate.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    throw new Error(`Unable to initialize pinned RDKit.js in its isolated worker. ${failures.join(' | ')}`);
  })().catch(error => {
    rdkitPromise = undefined;
    throw error;
  });
  return rdkitPromise;
}

function identify(smiles, rdkit) {
  if (typeof smiles !== 'string' || !smiles.trim() || smiles.length > 10000) {
    throw new Error('Provide a non-empty SMILES string of at most 10,000 characters.');
  }
  const molecule = rdkit.get_mol(smiles.trim(), JSON.stringify({ sanitize: true }));
  if (!molecule) throw new Error('RDKit could not parse and sanitize this SMILES. Check syntax, valence and formal charges.');
  try {
    const canonicalIsomericSmiles = molecule.get_smiles(JSON.stringify({ canonical: true, doIsomericSmiles: true }));
    if (!canonicalIsomericSmiles) throw new Error('RDKit did not return a canonical isomeric SMILES.');
    if (typeof molecule.get_inchi !== 'function') throw new Error('This RDKit.js WASM build does not expose InChI generation.');
    const inchi = molecule.get_inchi();
    if (!inchi || !inchi.startsWith('InChI=')) throw new Error('RDKit could not generate a standard InChI.');
    const inchiKey = rdkit.get_inchikey_for_inchi(inchi);
    if (!inchiKey || !/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(inchiKey)) throw new Error('RDKit did not return a valid standard InChIKey.');
    return {
      toolkit: 'RDKit.js',
      toolkitVersion: rdkit.version(),
      inputSmiles: smiles.trim(),
      canonicalIsomericSmiles,
      inchi,
      inchiKey,
      atomCount: molecule.get_num_atoms(),
      bondCount: molecule.get_num_bonds(),
      descriptors: JSON.parse(molecule.get_descriptors()),
      structureJson: JSON.parse(molecule.get_json()),
    };
  } finally {
    molecule.delete();
  }
}

self.addEventListener('message', event => {
  const { id, smiles } = event.data ?? {};
  if (!Number.isSafeInteger(id)) return;
  (async () => {
    try {
      const rdkit = await loadRDKit();
      self.postMessage({ id, result: identify(smiles, rdkit) });
    } catch (error) {
      self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
    }
  })();
});
