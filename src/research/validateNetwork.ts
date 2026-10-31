import { isElementSymbol } from './elements';
import type {
  ReactionNetwork,
  SpeciesCounts,
  ValidationIssue,
} from './types';

const isPositiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

export function validateNetwork(network: ReactionNetwork): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const speciesById = new Map<string, ReactionNetwork['species'][number]>();

  network.species.forEach((species, index) => {
    const path = `species[${index}]`;
    if (speciesById.has(species.id)) {
      issues.push({ code: 'DUPLICATE_SPECIES', message: `Duplicate species id "${species.id}".`, path });
    } else {
      speciesById.set(species.id, species);
    }
    if (!species.id.trim() || !species.label.trim()) {
      issues.push({ code: 'INVALID_COMPOSITION', message: 'Species id and label must be non-empty.', path });
    }
    if (!Number.isSafeInteger(species.charge)) {
      issues.push({ code: 'INVALID_CHARGE', message: 'Formal charge must be a safe integer.', path: `${path}.charge` });
    }
    for (const [element, count] of Object.entries(species.composition)) {
      if (!isElementSymbol(element) || !isPositiveInteger(count)) {
        issues.push({
          code: 'INVALID_COMPOSITION',
          message: `Element "${element}" must use a valid element symbol and a positive integer atom count.`,
          path: `${path}.composition.${element}`,
        });
      }
    }
    if (Object.keys(species.composition).length === 0 && !(species.id === 'electron' && species.charge === -1)) {
      issues.push({ code: 'INVALID_COMPOSITION', message: 'Composition must contain at least one element; the explicit electron species is the only atom-free exception.', path: `${path}.composition` });
    }
  });

  const reactionIds = new Set<string>();
  network.reactions.forEach((reaction, index) => {
    const path = `reactions[${index}]`;
    if (reactionIds.has(reaction.id)) {
      issues.push({ code: 'DUPLICATE_REACTION', message: `Duplicate reaction id "${reaction.id}".`, path });
    }
    reactionIds.add(reaction.id);

    if (!Number.isFinite(reaction.stochasticRateConstant) || reaction.stochasticRateConstant < 0) {
      issues.push({
        code: 'INVALID_RATE_CONSTANT',
        message: 'Stochastic rate constant must be finite and non-negative.',
        path: `${path}.stochasticRateConstant`,
      });
    }
    if (reaction.reactants.length === 0 || reaction.products.length === 0) {
      issues.push({ code: 'EMPTY_SIDE', message: 'Reaction must have at least one reactant and one product term.', path });
    }

    for (const [side, terms] of [['reactants', reaction.reactants], ['products', reaction.products]] as const) {
      const seen = new Set<string>();
      terms.forEach((term, termIndex) => {
        const termPath = `${path}.${side}[${termIndex}]`;
        if (!speciesById.has(term.speciesId)) {
          issues.push({ code: 'UNKNOWN_SPECIES', message: `Unknown species id "${term.speciesId}".`, path: `${termPath}.speciesId` });
        }
        if (!isPositiveInteger(term.coefficient)) {
          issues.push({ code: 'INVALID_COEFFICIENT', message: 'Stoichiometric coefficient must be a positive safe integer.', path: `${termPath}.coefficient` });
        }
        if (seen.has(term.speciesId)) {
          issues.push({ code: 'INVALID_COEFFICIENT', message: `Combine repeated "${term.speciesId}" terms into one coefficient.`, path: termPath });
        }
        seen.add(term.speciesId);
      });
    }

    if (reaction.reactants.length && reaction.products.length &&
        reaction.reactants.every(t => speciesById.has(t.speciesId)) &&
        reaction.products.every(t => speciesById.has(t.speciesId)) &&
        [...reaction.reactants, ...reaction.products].every(t => isPositiveInteger(t.coefficient))) {
      const atomDelta = new Map<string, number>();
      let chargeDelta = 0;
      for (const term of reaction.reactants) {
        const species = speciesById.get(term.speciesId)!;
        for (const [element, count] of Object.entries(species.composition)) {
          atomDelta.set(element, (atomDelta.get(element) ?? 0) - count * term.coefficient);
        }
        chargeDelta -= species.charge * term.coefficient;
      }
      for (const term of reaction.products) {
        const species = speciesById.get(term.speciesId)!;
        for (const [element, count] of Object.entries(species.composition)) {
          atomDelta.set(element, (atomDelta.get(element) ?? 0) + count * term.coefficient);
        }
        chargeDelta += species.charge * term.coefficient;
      }
      for (const [element, delta] of atomDelta) {
        if (delta !== 0) {
          issues.push({ code: 'ATOM_IMBALANCE', message: `Element ${element} is not conserved (product minus reactant atoms = ${delta}).`, path });
        }
      }
      if (chargeDelta !== 0) {
        issues.push({ code: 'CHARGE_IMBALANCE', message: `Charge is not conserved (product minus reactant charge = ${chargeDelta}).`, path });
      }
    }
  });

  return issues;
}

export function validateInitialCounts(
  network: ReactionNetwork,
  counts: SpeciesCounts,
): ValidationIssue[] {
  const known = new Set(network.species.map((species) => species.id));
  const issues: ValidationIssue[] = [];
  for (const [speciesId, count] of Object.entries(counts)) {
    if (!known.has(speciesId)) {
      issues.push({ code: 'UNKNOWN_SPECIES', message: `Initial count references unknown species "${speciesId}".`, path: `initialCounts.${speciesId}` });
    }
    if (!Number.isSafeInteger(count) || count < 0) {
      issues.push({ code: 'INVALID_INITIAL_COUNT', message: 'Initial molecule counts must be non-negative safe integers.', path: `initialCounts.${speciesId}` });
    }
  }
  for (const species of network.species) {
    if (!(species.id in counts)) {
      issues.push({ code: 'INVALID_INITIAL_COUNT', message: `Missing initial count for "${species.id}". Use zero explicitly when absent.`, path: `initialCounts.${species.id}` });
    }
  }
  return issues;
}
