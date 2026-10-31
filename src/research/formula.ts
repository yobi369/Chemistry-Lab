import { isElementSymbol } from './elements';
import type { ReactionNetwork, StoichiometricTerm } from './types';

export class ChemicalParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChemicalParseError';
  }
}

function addAtoms(target: Record<string, number>, source: Record<string, number>, multiplier: number): void {
  for (const [element, count] of Object.entries(source)) {
    const next = (target[element] ?? 0) + count * multiplier;
    if (!Number.isSafeInteger(next)) throw new ChemicalParseError('Formula atom count exceeds the safe integer range.');
    target[element] = next;
  }
}

/**
 * Parse a neutral molecular/formula-unit string, including nested () and []
 * groups and hydrate components such as CuSO4·5H2O. Ionic charge belongs in
 * the equation term suffix (for example Fe^3+ or SO4^2-), not in this parser.
 */
export function parseChemicalFormula(input: string): Record<string, number> {
  const formula = input.trim();
  if (!formula || /\s/.test(formula)) {
    throw new ChemicalParseError('A chemical formula must be non-empty and contain no internal whitespace.');
  }

  const components = formula.split(/[·.]/);
  if (components.some((component) => component.length === 0)) {
    throw new ChemicalParseError('Hydrate separators must have a formula component on both sides.');
  }

  const total: Record<string, number> = {};
  for (const component of components) {
    let index = 0;
    let componentMultiplier = 1;
    const leading = component.match(/^(\d+)(?=[A-Z[(])/);
    if (leading) {
      componentMultiplier = Number(leading[1]);
      if (!Number.isSafeInteger(componentMultiplier) || componentMultiplier < 1) {
        throw new ChemicalParseError('Hydrate component multiplier must be a positive safe integer.');
      }
      index = leading[0].length;
    }

    const parseSequence = (closing?: ')' | ']'): Record<string, number> => {
      const atoms: Record<string, number> = {};
      let terms = 0;
      while (index < component.length) {
        const char = component[index];
        if (char === ')' || char === ']') {
          if (char !== closing) throw new ChemicalParseError(`Unexpected closing group "${char}" in formula "${formula}".`);
          if (terms === 0) throw new ChemicalParseError(`Empty group in formula "${formula}".`);
          index += 1;
          return atoms;
        }

        if (char === '(' || char === '[') {
          const expected = char === '(' ? ')' : ']';
          index += 1;
          const nested = parseSequence(expected);
          const countMatch = component.slice(index).match(/^\d+/);
          const count = countMatch ? Number(countMatch[0]) : 1;
          if (!Number.isSafeInteger(count) || count < 1) throw new ChemicalParseError('Group multiplier must be a positive safe integer.');
          if (countMatch) index += countMatch[0].length;
          addAtoms(atoms, nested, count);
          terms += 1;
          continue;
        }

        if (/[A-Z]/.test(char)) {
          let symbol = char;
          index += 1;
          if (index < component.length && /[a-z]/.test(component[index])) {
            symbol += component[index];
            index += 1;
          }
          if (!isElementSymbol(symbol)) throw new ChemicalParseError(`Unknown element symbol "${symbol}".`);
          const countMatch = component.slice(index).match(/^\d+/);
          const count = countMatch ? Number(countMatch[0]) : 1;
          if (!Number.isSafeInteger(count) || count < 1) throw new ChemicalParseError('Atom count must be a positive safe integer.');
          if (countMatch) index += countMatch[0].length;
          const next = (atoms[symbol] ?? 0) + count;
          if (!Number.isSafeInteger(next)) throw new ChemicalParseError('Formula atom count exceeds the safe integer range.');
          atoms[symbol] = next;
          terms += 1;
          continue;
        }

        throw new ChemicalParseError(`Unexpected character "${char}" in formula "${formula}".`);
      }

      if (closing) throw new ChemicalParseError(`Unclosed group in formula "${formula}".`);
      if (terms === 0) throw new ChemicalParseError(`Empty formula group in "${formula}".`);
      return atoms;
    };

    const parsed = parseSequence();
    if (index !== component.length) throw new ChemicalParseError(`Could not parse all of formula "${formula}".`);
    addAtoms(total, parsed, componentMultiplier);
  }

  return total;
}

export interface ParsedEquationTerm {
  readonly formula: string;
  readonly coefficient: number;
  readonly speciesId: string;
  readonly charge: number;
}

export interface ParsedChemicalEquation {
  readonly source: string;
  readonly arrow: 'forward' | 'reversible';
  readonly reactants: readonly ParsedEquationTerm[];
  readonly products: readonly ParsedEquationTerm[];
  readonly compositions: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly charges: Readonly<Record<string, number>>;
}

function splitReactionTerms(side: string): string[] {
  const terms: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < side.length; index += 1) {
    const char = side[index];
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (depth < 0) throw new ChemicalParseError('Unexpected closing group in reaction side.');
    if (char === '+' && depth === 0) {
      // A plus sign immediately following ^ or ^digits is an ionic charge,
      // not a separator between chemical terms.
      const prefix = side.slice(start, index).trimEnd();
      if (/\^\d*$/.test(prefix)) continue;
      terms.push(side.slice(start, index));
      start = index + 1;
    }
  }
  if (depth !== 0) throw new ChemicalParseError('Unclosed group in reaction side.');
  terms.push(side.slice(start));
  return terms;
}

function parseEquationTerm(rawTerm: string): {
  coefficient: number;
  formula: string;
  speciesId: string;
  composition: Record<string, number>;
  charge: number;
} {
  const match = rawTerm.trim().match(/^(\d+)?\s*([A-Za-z][A-Za-z0-9()[\]·.]*)?(?:\^(\d*)([+-]))?$/);
  if (!match || !match[2]) {
    throw new ChemicalParseError(`Could not parse reaction term "${rawTerm.trim()}". Use a coefficient, neutral formula and optional caret charge such as Fe^3+ or SO4^2-.`);
  }
  const coefficient = match[1] ? Number(match[1]) : 1;
  if (!Number.isSafeInteger(coefficient) || coefficient < 1) {
    throw new ChemicalParseError('Reaction coefficients must be positive safe integers.');
  }
  const rawFormula = match[2];
  const chargeMagnitude = match[4] ? (match[3] ? Number(match[3]) : 1) : 0;
  if (!Number.isSafeInteger(chargeMagnitude) || (match[4] && chargeMagnitude < 1)) {
    throw new ChemicalParseError('Ionic charge magnitude must be a positive safe integer.');
  }
  const charge = match[4] === '+' ? chargeMagnitude : match[4] === '-' ? -chargeMagnitude : 0;

  if (rawFormula === 'e') {
    if (charge !== -1) throw new ChemicalParseError('Electron species must be written e^-.');
    return { coefficient, formula: 'e⁻', speciesId: 'electron', composition: {}, charge: -1 };
  }

  const chargeLabel = charge === 0 ? '' : `^${Math.abs(charge) === 1 ? '' : Math.abs(charge)}${charge > 0 ? '+' : '-'}`;
  const formula = `${rawFormula}${chargeLabel}`;
  return {
    coefficient,
    formula,
    speciesId: `formula:${formula}`,
    composition: parseChemicalFormula(rawFormula),
    charge,
  };
}

/** Parse neutral and ionic formula equations such as Fe^3+ + 3 OH^- -> Fe(OH)3. */
export function parseReactionEquation(input: string): ParsedChemicalEquation {
  const source = input.trim();
  const arrowMatches = [...source.matchAll(/(<=>|⇌|↔|->|→)/g)];
  if (arrowMatches.length !== 1) {
    throw new ChemicalParseError('Enter exactly one reaction arrow: ->, →, <=>, ⇌ or ↔.');
  }

  const arrowMatch = arrowMatches[0];
  const arrow = arrowMatch[0];
  const left = source.slice(0, arrowMatch.index).trim();
  const right = source.slice((arrowMatch.index ?? 0) + arrow.length).trim();
  if (!left || !right) throw new ChemicalParseError('A reaction needs reactants and products on both sides.');

  const compositions: Record<string, Record<string, number>> = {};
  const charges: Record<string, number> = {};
  const parseSide = (side: string): ParsedEquationTerm[] => {
    const rawTerms = splitReactionTerms(side);
    if (rawTerms.some((term) => !term.trim())) throw new ChemicalParseError('Reaction terms cannot be empty.');
    const combined = new Map<string, number>();

    for (const rawTerm of rawTerms) {
      const parsed = parseEquationTerm(rawTerm);
      compositions[parsed.speciesId] ??= parsed.composition;
      charges[parsed.speciesId] = parsed.charge;
      const next = (combined.get(parsed.speciesId) ?? 0) + parsed.coefficient;
      if (!Number.isSafeInteger(next)) throw new ChemicalParseError('Combined stoichiometric coefficient exceeds the safe integer range.');
      combined.set(parsed.speciesId, next);
    }

    return [...combined].map(([speciesId, coefficient]) => ({
      speciesId,
      coefficient,
      formula: speciesId === 'electron' ? 'e⁻' : speciesId.slice('formula:'.length),
      charge: charges[speciesId],
    }));
  };

  return {
    source,
    arrow: arrow === '<=>' || arrow === '⇌' || arrow === '↔' ? 'reversible' : 'forward',
    reactants: parseSide(left),
    products: parseSide(right),
    compositions,
    charges,
  };
}

/** Convert a parsed ionic/neutral equation to its written forward channel. */
export function equationToNetwork(
  equation: ParsedChemicalEquation,
  stochasticRateConstant: number,
): ReactionNetwork {
  const species = Object.entries(equation.compositions).map(([id, composition]) => ({
    id,
    label: id === 'electron' ? 'e⁻' : id.slice('formula:'.length),
    composition,
    charge: equation.charges[id] ?? 0,
  }));
  const toTerms = (terms: readonly ParsedEquationTerm[]): StoichiometricTerm[] =>
    terms.map(({ speciesId, coefficient }) => ({ speciesId, coefficient }));

  return {
    species,
    reactions: [{
      id: 'parsed-equation',
      label: equation.source,
      reactants: toTerms(equation.reactants),
      products: toTerms(equation.products),
      stochasticRateConstant,
    }],
  };
}

export interface ParsedReactionNetwork {
  readonly equations: readonly ParsedChemicalEquation[];
  readonly network: ReactionNetwork;
}

/**
 * Parse one neutral or ionic reaction equation per line. Blank lines and
 * lines whose first non-whitespace character is # are ignored. Each channel
 * receives the same supplied stochastic rate constant.
 */
export function parseReactionNetwork(
  input: string,
  stochasticRateConstant: number,
): ParsedReactionNetwork {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  if (lines.length === 0) throw new ChemicalParseError('Enter at least one reaction equation.');

  const equations = lines.map(parseReactionEquation);
  const compositions = new Map<string, Readonly<Record<string, number>>>();
  const charges = new Map<string, number>();
  const reactions = equations.map((equation, index) => {
    for (const [speciesId, composition] of Object.entries(equation.compositions)) {
      const previous = compositions.get(speciesId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(composition)) {
        throw new ChemicalParseError(`Formula "${speciesId}" resolved to inconsistent elemental compositions.`);
      }
      compositions.set(speciesId, composition);
      charges.set(speciesId, equation.charges[speciesId] ?? 0);
    }
    const toTerms = (terms: readonly ParsedEquationTerm[]): StoichiometricTerm[] =>
      terms.map(({ speciesId, coefficient }) => ({ speciesId, coefficient }));
    return {
      id: `reaction-${index + 1}`,
      label: equation.source,
      reactants: toTerms(equation.reactants),
      products: toTerms(equation.products),
      stochasticRateConstant,
    };
  });

  const species = [...compositions].map(([id, composition]) => ({
    id,
    label: id === 'electron' ? 'e⁻' : id.slice('formula:'.length),
    composition,
    charge: charges.get(id) ?? 0,
  }));

  return {
    equations,
    network: { species, reactions },
  };
}
