import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSmilesWithRDKit, RDKIT_VERSION, type RDKitModule, type RDKitMolecule } from './rdkitToolkit';

function fakeToolkit(overrides: Partial<RDKitMolecule> = {}, hasInchi = true) {
  let deleted = false;
  const molecule: RDKitMolecule = {
    get_smiles: () => 'C[C@H](O)C(=O)O',
    get_inchi: hasInchi ? () => 'InChI=1S/C3H6O3/c1-2(4)3(5)6/h2,4H,1H3,(H,5,6)' : undefined,
    get_json: () => JSON.stringify({molecules:[{atoms:[{chiralTag:2}],bonds:[]}]}),
    get_descriptors: () => JSON.stringify({amw:90.08,exactmw:90.0317}),
    get_num_atoms: () => 6,
    get_num_bonds: () => 5,
    delete: () => { deleted = true; },
    ...overrides,
  };
  const rdkit: RDKitModule = {
    version: () => RDKIT_VERSION,
    get_mol: () => molecule,
    get_inchikey_for_inchi: () => 'JVTAAEKCZFNVCJ-REOHCLBHSA-N',
  };
  return {rdkit,wasDeleted:()=>deleted};
}

test('RDKit molecular identity adapter', async t => {
  await t.test('returns canonical isomeric SMILES, InChI, InChIKey and structural metadata', () => {
    const fake=fakeToolkit();
    const result=analyzeSmilesWithRDKit('C[C@H](O)C(=O)O',fake.rdkit);
    assert.equal(result.toolkit,'RDKit.js');
    assert.equal(result.canonicalIsomericSmiles,'C[C@H](O)C(=O)O');
    assert.ok(result.inchi.startsWith('InChI=1S/'));
    assert.match(result.inchiKey,/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/);
    assert.equal(result.atomCount,6);
    assert.ok(result.structureJson);
    assert.equal(fake.wasDeleted(),true);
  });
  await t.test('rejects invalid input before calling the toolkit', () => {
    const fake=fakeToolkit();
    assert.throws(()=>analyzeSmilesWithRDKit(' ',fake.rdkit),/non-empty SMILES/);
    assert.throws(()=>analyzeSmilesWithRDKit('C'.repeat(10001),fake.rdkit),/10,000/);
  });
  await t.test('fails closed when InChI is unavailable', () => {
    const fake=fakeToolkit({},false);
    assert.throws(()=>analyzeSmilesWithRDKit('CCO',fake.rdkit),/does not expose InChI/);
    assert.equal(fake.wasDeleted(),true);
  });
  await t.test('rejects parse/sanitization failures', () => {
    const fake=fakeToolkit();
    const rdkit={...fake.rdkit,get_mol:()=>null};
    assert.throws(()=>analyzeSmilesWithRDKit('not-smiles',rdkit),/parse and sanitize/);
  });
  await t.test('rejects malformed InChIKey responses', () => {
    const fake=fakeToolkit();
    const rdkit={...fake.rdkit,get_inchikey_for_inchi:()=> 'not-a-key'};
    assert.throws(()=>analyzeSmilesWithRDKit('CCO',rdkit),/valid standard InChIKey/);
  });
});
