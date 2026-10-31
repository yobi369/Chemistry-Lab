import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMolecularStructure } from './molecularIdentity';

test('molecular structure graph validation', async t => {
  await t.test('accepts a connected water atom graph and checks formula/charge', () => {
    const result = validateMolecularStructure({
      structureId: 'water-1', source: 'hand-authored test graph',
      atoms: [
        { id: 'O1', element: 'O' }, { id: 'H1', element: 'H' }, { id: 'H2', element: 'H' },
      ],
      bonds: [
        { atomA: 'O1', atomB: 'H1', order: 1 },
        { atomA: 'O1', atomB: 'H2', order: 1 },
      ],
      inchiKey: 'XLYOFNOQVPJJNP-UHFFFAOYSA-N',
    }, 'H2O', 0);
    assert.equal(result.valid, true);
    assert.equal(result.connectedComponents, 1);
    assert.equal(result.computedFormula, 'H2O');
  });
  await t.test('rejects duplicate bonds and formula mismatch', () => {
    const result = validateMolecularStructure({
      structureId: 'bad', source: 'test',
      atoms: [{ id: 'C1', element: 'C' }, { id: 'O1', element: 'O' }],
      bonds: [{ atomA: 'C1', atomB: 'O1', order: 1 }, { atomA: 'O1', atomB: 'C1', order: 1 }],
    }, 'CO2');
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes('Duplicate bond')));
    assert.ok(result.errors.some(error => error.includes('formula')));
  });
});
