import type { ReactionNetwork } from './types';
import { validateNetwork } from './validateNetwork';

interface Fraction {
  readonly n: bigint;
  readonly d: bigint;
}

const abs = (value: bigint) => value < 0n ? -value : value;
function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}
function f(n: bigint, d = 1n): Fraction {
  if (d === 0n) throw new Error('Exact matrix operation divided by zero.');
  const sign = d < 0n ? -1n : 1n;
  const g = gcd(n, d);
  return { n: n / g * sign, d: abs(d / g) };
}
const zero = f(0n);
const isZero = (x: Fraction) => x.n === 0n;
const add = (a: Fraction, b: Fraction) => f(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Fraction, b: Fraction) => f(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Fraction, b: Fraction) => f(a.n * b.n, a.d * b.d);
const div = (a: Fraction, b: Fraction) => f(a.n * b.d, a.d * b.n);

interface RrefResult {
  readonly matrix: Fraction[][];
  readonly pivotColumns: readonly number[];
}

function reducedRowEchelon(input: readonly (readonly bigint[])[], columnCount: number): RrefResult {
  const matrix = input.map((row) => row.map((value) => f(value)));
  let pivotRow = 0;
  const pivotColumns: number[] = [];

  for (let column = 0; column < columnCount && pivotRow < matrix.length; column += 1) {
    let candidate = pivotRow;
    while (candidate < matrix.length && isZero(matrix[candidate][column])) candidate += 1;
    if (candidate === matrix.length) continue;
    [matrix[pivotRow], matrix[candidate]] = [matrix[candidate], matrix[pivotRow]];

    const pivot = matrix[pivotRow][column];
    matrix[pivotRow] = matrix[pivotRow].map((value) => div(value, pivot));
    for (let row = 0; row < matrix.length; row += 1) {
      if (row === pivotRow) continue;
      const factor = matrix[row][column];
      if (isZero(factor)) continue;
      matrix[row] = matrix[row].map((value, index) =>
        sub(value, mul(factor, matrix[pivotRow][index])),
      );
    }
    pivotColumns.push(column);
    pivotRow += 1;
  }

  return { matrix, pivotColumns };
}

function lcm(a: bigint, b: bigint): bigint {
  return abs((a / gcd(a, b)) * b);
}

function primitiveIntegerVector(values: readonly Fraction[]): number[] {
  const denominator = values.reduce((current, value) => lcm(current, value.d), 1n);
  const integers = values.map((value) => value.n * (denominator / value.d));
  const divisor = integers.reduce((current, value) => gcd(current, value), 0n);
  const primitive = integers.map((value) => value / (divisor || 1n));
  if (primitive.some((value) => abs(value) > BigInt(Number.MAX_SAFE_INTEGER))) {
    throw new Error('A conservation coefficient exceeds the safe integer range.');
  }
  return primitive.map(Number);
}

function nullspaceBasis(matrix: readonly (readonly bigint[])[], columnCount: number): number[][] {
  const reduced = reducedRowEchelon(matrix, columnCount);
  const pivots = new Set(reduced.pivotColumns);
  const freeColumns = Array.from({ length: columnCount }, (_, index) => index).filter((index) => !pivots.has(index));

  return freeColumns.map((freeColumn) => {
    const vector = Array.from({ length: columnCount }, () => zero);
    vector[freeColumn] = f(1n);
    reduced.pivotColumns.forEach((pivotColumn, rowIndex) => {
      vector[pivotColumn] = f(-reduced.matrix[rowIndex][freeColumn].n, reduced.matrix[rowIndex][freeColumn].d);
    });
    return primitiveIntegerVector(vector);
  });
}

export interface StoichiometricAnalysis {
  readonly speciesIds: readonly string[];
  readonly reactionIds: readonly string[];
  /** Rows are species, columns are reactions; entries are products minus reactants. */
  readonly matrix: readonly (readonly number[])[];
  readonly rank: number;
  readonly independentReactionCycles: number;
  readonly independentConservationLaws: number;
  /** Each integer vector is a left-nullspace invariant in speciesIds order. */
  readonly conservationBasis: readonly (readonly number[])[];
  readonly conservationRelations: readonly string[];
}

/** Exact integer stoichiometric matrix and left/right nullity analysis. */
export function analyzeStoichiometry(network: ReactionNetwork): StoichiometricAnalysis {
  const issues = validateNetwork(network);
  if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));

  const speciesIds = network.species.map((species) => species.id);
  const reactionIds = network.reactions.map((reaction) => reaction.id);
  const matrix = network.species.map((species) => network.reactions.map((reaction) => {
    const reactantCount = reaction.reactants.find((term) => term.speciesId === species.id)?.coefficient ?? 0;
    const productCount = reaction.products.find((term) => term.speciesId === species.id)?.coefficient ?? 0;
    return productCount - reactantCount;
  }));

  const integerMatrix = matrix.map((row) => row.map(BigInt));
  const rank = reducedRowEchelon(integerMatrix, reactionIds.length).pivotColumns.length;
  const transpose = reactionIds.map((_, reactionIndex) =>
    speciesIds.map((_, speciesIndex) => BigInt(matrix[speciesIndex][reactionIndex])),
  );
  const conservationBasis = nullspaceBasis(transpose, speciesIds.length);
  const conservationRelations = conservationBasis.map((vector) =>
    vector.map((coefficient, index) => coefficient === 0 ? null : `${coefficient === 1 ? '' : coefficient === -1 ? '−' : coefficient}${speciesIds[index]}`)
      .filter((term): term is string => term !== null)
      .join(' + ')
      .replace(/\+ −/g, '− '),
  );

  return {
    speciesIds,
    reactionIds,
    matrix,
    rank,
    independentReactionCycles: reactionIds.length - rank,
    independentConservationLaws: speciesIds.length - rank,
    conservationBasis,
    conservationRelations,
  };
}
