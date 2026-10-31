import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceReactionEquation, balanceReactionNetwork } from './balanceEquation';

test('exact chemical equation balancing', async (t) => {
  await t.test('balances a common neutral equation', () => {
    assert.equal(balanceReactionEquation('H2 + O2 -> H2O'), '2 H2 + O2 → 2 H2O');
  });

  await t.test('balances polyatomic groups', () => {
    assert.equal(balanceReactionEquation('Al + HCl -> AlCl3 + H2'), '2 Al + 6 HCl → 2 AlCl3 + 3 H2');
  });

  await t.test('balances an ionic redox equation with electrons', () => {
    assert.equal(
      balanceReactionEquation('MnO4^- + H^+ + e^- -> Mn^2+ + H2O'),
      'MnO4^- + 8 H^+ + 5 e⁻ → Mn^2+ + 4 H2O',
    );
  });

  await t.test('balances ionic precipitation', () => {
    assert.equal(balanceReactionEquation('Fe^3+ + OH^- -> Fe(OH)3'), 'Fe^3+ + 3 OH^- → Fe(OH)3');
  });

  await t.test('rejects an impossible species set', () => {
    assert.throws(() => balanceReactionEquation('H2 -> O2'), /No non-zero coefficient solution/);
  });

  await t.test('balances multi-line input and preserves comments', () => {
    const input = '# equations\nH2 + O2 -> H2O\n\nAl + HCl -> AlCl3 + H2';
    assert.equal(
      balanceReactionNetwork(input),
      '# equations\n2 H2 + O2 → 2 H2O\n\n2 Al + 6 HCl → 2 AlCl3 + 3 H2',
    );
  });
});
