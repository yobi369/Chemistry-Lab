import { parseReactionEquation } from './formula';
import { SimulationInputError } from './gillespie';

interface Fraction {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

const abs = (value: bigint) => value < 0n ? -value : value;

function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function fraction(numerator: bigint, denominator = 1n): Fraction {
  if (denominator === 0n) throw new SimulationInputError('Internal balancing error: division by zero.');
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: abs(denominator / divisor),
  };
}

const ZERO = fraction(0n);
const ONE = fraction(1n);
const isZero = (value: Fraction) => value.numerator === 0n;
const add = (a: Fraction, b: Fraction) =>
  fraction(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
const subtract = (a: Fraction, b: Fraction) =>
  fraction(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
const multiply = (a: Fraction, b: Fraction) =>
  fraction(a.numerator * b.numerator, a.denominator * b.denominator);
const divide = (a: Fraction, b: Fraction) =>
  fraction(a.numerator * b.denominator, a.denominator * b.numerator);

function lcm(a: bigint, b: bigint): bigint {
  return abs((a / gcd(a, b)) * b);
}

function toPrimitivePositiveIntegers(values: readonly Fraction[]): bigint[] | null {
  if (values.some((value) => value.numerator <= 0n)) return null;
  const denominator = values.reduce((current, value) => lcm(current, value.denominator), 1n);
  const integers = values.map((value) => value.numerator * (denominator / value.denominator));
  const common = integers.reduce((current, value) => gcd(current, value), 0n);
  return integers.map((value) => value / common);
}

/**
 * Balance a single equation using exact rational row reduction.
 * Input coefficients are treated as placeholders; the smallest positive
 * integer coefficient vector found in the nullspace is returned.
 */
export function balanceReactionEquation(input: string): string {
  const parsed = parseReactionEquation(input);
  const reactantIds = parsed.reactants.map((term) => term.speciesId);
  const productIds = parsed.products.map((term) => term.speciesId);
  const overlap = reactantIds.filter((id) => productIds.includes(id));
  if (overlap.length) {
    throw new SimulationInputError('The same species appears on both sides. Cancel common species before automatic balancing.');
  }

  const columns = [
    ...parsed.reactants.map((term) => ({ ...term, sign: 1 })),
    ...parsed.products.map((term) => ({ ...term, sign: -1 })),
  ];
  const speciesIds = columns.map((term) => term.speciesId);
  const elements = [...new Set(
    speciesIds.flatMap((id) => Object.keys(parsed.compositions[id] ?? {})),
  )].sort();
  const includeCharge = speciesIds.some((id) => (parsed.charges[id] ?? 0) !== 0);
  const rowNames = [...elements, ...(includeCharge ? ['charge'] : [])];
  if (rowNames.length === 0) {
    throw new SimulationInputError('This equation has no elemental or charge constraints and cannot be balanced automatically.');
  }

  const matrix: Fraction[][] = rowNames.map((rowName) => columns.map((term) => {
    const value = rowName === 'charge'
      ? (parsed.charges[term.speciesId] ?? 0)
      : (parsed.compositions[term.speciesId]?.[rowName] ?? 0);
    return fraction(BigInt(value * term.sign));
  }));

  // Exact reduced row-echelon form.
  let pivotRow = 0;
  const pivotColumns: number[] = [];
  for (let column = 0; column < columns.length && pivotRow < matrix.length; column += 1) {
    let candidate = pivotRow;
    while (candidate < matrix.length && isZero(matrix[candidate][column])) candidate += 1;
    if (candidate === matrix.length) continue;
    [matrix[pivotRow], matrix[candidate]] = [matrix[candidate], matrix[pivotRow]];

    const pivot = matrix[pivotRow][column];
    matrix[pivotRow] = matrix[pivotRow].map((value) => divide(value, pivot));
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === pivotRow) continue;
      const factor = matrix[row][column];
      if (isZero(factor)) continue;
      matrix[row] = matrix[row].map((value, index) =>
        subtract(value, multiply(factor, matrix[pivotRow][index])),
      );
    }
    pivotColumns.push(column);
    pivotRow += 1;
  }

  const pivotSet = new Set(pivotColumns);
  const freeColumns = columns.map((_, index) => index).filter((index) => !pivotSet.has(index));
  if (freeColumns.length === 0) {
    throw new SimulationInputError('No non-zero coefficient solution exists for this equation.');
  }
  if (freeColumns.length > 4) {
    throw new SimulationInputError('The equation has more than four independent free coefficients; simplify the species set before automatic balancing.');
  }

  let best: bigint[] | null = null;
  let bestSum: bigint | null = null;
  const assignments = new Array<bigint>(freeColumns.length).fill(1n);
  const searchLimit = 12;

  const evaluate = () => {
    const values = new Array<Fraction>(columns.length).fill(ZERO);
    freeColumns.forEach((column, index) => { values[column] = fraction(assignments[index]); });
    pivotColumns.forEach((column, row) => {
      let value = ZERO;
      freeColumns.forEach((freeColumn) => {
        value = add(value, multiply(matrix[row][freeColumn], values[freeColumn]));
      });
      values[column] = subtract(ZERO, value);
    });

    const candidate = toPrimitivePositiveIntegers(values);
    if (!candidate) return;
    const sum = candidate.reduce((total, value) => total + value, 0n);
    if (bestSum === null || sum < bestSum) {
      best = candidate;
      bestSum = sum;
    }
  };

  const search = (index: number) => {
    if (index === assignments.length) {
      evaluate();
      return;
    }
    for (let value = 1; value <= searchLimit; value += 1) {
      assignments[index] = BigInt(value);
      search(index + 1);
    }
  };
  search(0);

  if (!best) {
    throw new SimulationInputError('No positive coefficient solution was found in the bounded exact search. Check species, charges and equation completeness.');
  }
  const coefficients = best as bigint[];
  if (coefficients.some((value) => value > BigInt(Number.MAX_SAFE_INTEGER))) {
    throw new SimulationInputError('Balanced coefficients exceed the safe integer range.');
  }

  const arrow = parsed.arrow === 'reversible' ? '⇌' : '→';
  const renderSide = (terms: typeof columns, offset: number) =>
    terms.map((term, index) => {
      const coefficient = Number(coefficients[offset + index]);
      return `${coefficient === 1 ? '' : `${coefficient} `}${term.formula}`;
    }).join(' + ');
  return `${renderSide(columns.slice(0, parsed.reactants.length), 0)} ${arrow} ${renderSide(columns.slice(parsed.reactants.length), parsed.reactants.length)}`;
}

/** Balance each non-comment equation line independently; preserve blank/comment lines. */
export function balanceReactionNetwork(input: string): string {
  return input.split(/\r?\n/).map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    try {
      return balanceReactionEquation(trimmed);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Equation could not be balanced.';
      throw new SimulationInputError(`Line ${index + 1}: ${message}`);
    }
  }).join('\n');
}
