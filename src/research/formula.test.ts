import test from 'node:test';
import assert from 'node:assert/strict';
import { equationToNetwork, parseChemicalFormula, parseReactionEquation } from './formula';
import { validateNetwork } from './validateNetwork';

test('chemical formula parser', async (t) => {
  await t.test('parses simple formulas', () => {
    assert.deepEqual(parseChemicalFormula('H2O'), { H: 2, O: 1 });
    assert.deepEqual(parseChemicalFormula('NaCl'), { Na: 1, Cl: 1 });
  });

  await t.test('parses nested groups', () => {
    assert.deepEqual(parseChemicalFormula('Fe2(SO4)3'), { Fe: 2, S: 3, O: 12 });
    assert.deepEqual(parseChemicalFormula('K4[Fe(CN)6]'), { K: 4, Fe: 1, C: 6, N: 6 });
  });

  await t.test('parses hydrate components', () => {
    assert.deepEqual(parseChemicalFormula('CuSO4·5H2O'), { Cu: 1, S: 1, O: 9, H: 10 });
  });

  await t.test('rejects malformed groups and unknown elements', () => {
    assert.throws(() => parseChemicalFormula('Mg(OH'), /Unclosed group/);
    assert.throws(() => parseChemicalFormula('Xx2'), /Unknown element/);
  });
});

test('chemical equation parser', async (t) => {
  await t.test('parses and balances a neutral equation', () => {
    const parsed = parseReactionEquation('2 H2 + O2 -> 2 H2O');
    assert.equal(parsed.arrow, 'forward');
    const network = equationToNetwork(parsed, 0.1);
    assert.deepEqual(validateNetwork(network), []);
  });

  await t.test('reports an unbalanced equation through network validation', () => {
    const parsed = parseReactionEquation('H2 + O2 -> H2O');
    const issues = validateNetwork(equationToNetwork(parsed, 0.1));
    assert.ok(issues.some((issue) => issue.code === 'ATOM_IMBALANCE'));
  });

  await t.test('recognizes reversible arrows', () => {
    assert.equal(parseReactionEquation('H2 + I2 ⇌ 2 HI').arrow, 'reversible');
  });

  await t.test('rejects ambiguous or incomplete equations', () => {
    assert.throws(() => parseReactionEquation('H2 + O2'), /exactly one reaction arrow/);
    assert.throws(() => parseReactionEquation('H2 ->'), /both sides/);
  });
});

test('multi-step reaction network parser', async (t) => {
  await t.test('builds distinct channels with shared species', async () => {
    const { parseReactionNetwork } = await import('./formula');
    const parsed = parseReactionNetwork(
      '# two illustrative channels\n2 H2 + O2 -> 2 H2O\n\n2 H2O -> 2 H2 + O2',
      0.1,
    );
    assert.equal(parsed.network.reactions.length, 2);
    assert.equal(parsed.network.species.length, 3);
    assert.deepEqual(validateNetwork(parsed.network), []);
    assert.equal(parsed.network.reactions[0].id, 'reaction-1');
    assert.equal(parsed.network.reactions[1].id, 'reaction-2');
  });

  await t.test('rejects empty network input', async () => {
    const { parseReactionNetwork } = await import('./formula');
    assert.throws(() => parseReactionNetwork('# no equations', 1), /at least one reaction/);
  });
});
