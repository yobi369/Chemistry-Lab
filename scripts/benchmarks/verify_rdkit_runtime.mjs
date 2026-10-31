import initRDKit from '@rdkit/rdkit';

const RDKit = await initRDKit();
if (!String(RDKit.version()).startsWith('2026.9.1')) {
  throw new Error(`Expected RDKit 2026.9.1, received ${RDKit.version()}`);
}

function identify(smiles) {
  const mol = RDKit.get_mol(smiles, JSON.stringify({ sanitize: true }));
  if (!mol) throw new Error(`RDKit failed to parse/sanitize valid reference SMILES: ${smiles}`);
  try {
    if (typeof mol.get_inchi !== 'function') {
      throw new Error('Pinned RDKit.js WASM build does not expose get_inchi().');
    }
    const canonicalIsomericSmiles = mol.get_smiles(JSON.stringify({
      canonical: true,
      doIsomericSmiles: true,
    }));
    const inchi = mol.get_inchi();
    const inchiKey = RDKit.get_inchikey_for_inchi(inchi);
    const structure = JSON.parse(mol.get_json());
    if (!canonicalIsomericSmiles || !inchi.startsWith('InChI=') ||
        !/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/.test(inchiKey) ||
        !Number.isInteger(mol.get_num_atoms()) || !Number.isInteger(mol.get_num_bonds()) ||
        !structure || typeof structure !== 'object') {
      throw new Error(`RDKit returned incomplete molecular identity for ${smiles}`);
    }
    return { canonicalIsomericSmiles, inchi, inchiKey, atomCount: mol.get_num_atoms(), bondCount: mol.get_num_bonds() };
  } finally {
    mol.delete();
  }
}

const ethanolA = identify('OCC');
const ethanolB = identify('CCO');
if (ethanolA.canonicalIsomericSmiles !== ethanolB.canonicalIsomericSmiles ||
    ethanolA.inchiKey !== ethanolB.inchiKey) {
  throw new Error('Equivalent SMILES inputs did not canonicalize to the same molecular identity.');
}

const ether = identify('COC');
if (ethanolA.inchiKey === ether.inchiKey) {
  throw new Error('Constitutional isomers ethanol and dimethyl ether were not distinguished.');
}

const enantiomerR = identify('C[C@H](O)C(=O)O');
const enantiomerS = identify('C[C@@H](O)C(=O)O');
if (enantiomerR.canonicalIsomericSmiles === enantiomerS.canonicalIsomericSmiles ||
    enantiomerR.inchiKey === enantiomerS.inchiKey) {
  throw new Error('Enantiomer pair was not distinguished by canonical isomeric identity.');
}

const alkeneE = identify('F/C=C/F');
const alkeneZ = identify('F/C=C\\F');
if (alkeneE.inchiKey === alkeneZ.inchiKey) {
  throw new Error('E/Z alkene stereoisomers were not distinguished.');
}

const invalid = RDKit.get_mol('C(C)(C)(C)(C)C', JSON.stringify({ sanitize: true }));
if (invalid) {
  invalid.delete();
  throw new Error('RDKit accepted a carbon with invalid valence during sanitization.');
}

console.log(JSON.stringify({
  toolkit: 'RDKit.js',
  version: RDKit.version(),
  equivalentSmilesCanonicalized: true,
  constitutionalIsomersDistinguished: true,
  tetrahedralEnantiomersDistinguished: true,
  alkeneStereoIsomersDistinguished: true,
  invalidValenceRejected: true,
}, null, 2));
