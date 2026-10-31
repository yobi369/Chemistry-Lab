import type { StochasticReaction } from './types';
import { SimulationInputError } from './gillespie';

export const AVOGADRO_CONSTANT = 6.02214076e23;

export interface RateConversionResult {
  readonly stochasticRateConstant: number;
  readonly reactionOrder: number;
  readonly macroscopicUnits: string;
  readonly stochasticUnits: 's^-1 per available reactant combination';
  readonly formula: string;
}

function logFactorial(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10_000) {
    throw new SimulationInputError('Stoichiometric coefficients must be between 1 and 10,000 for rate conversion.');
  }
  let result = 0;
  for (let i = 2; i <= value; i += 1) result += Math.log(i);
  return result;
}

/**
 * Convert a macroscopic mass-action rate constant to the SSA convention used
 * by this kernel:
 *
 *   a(n) = c * product_i choose(n_i, nu_i)
 *
 * Assumed macroscopic rate law:
 *   r = k * product_i [S_i]^nu_i
 *
 * For a constant-volume ideal solution, c = k * (N_A * V)^(1-m)
 * * product_i (nu_i!), where m is total reactant molecularity.
 *
 * k must use M^(1-m) s^-1 (or s^-1 for m=1), V is in litres, and the
 * reaction must be an elementary mass-action step for this order convention.
 */
export function convertMacroscopicRateConstant(
  reaction: StochasticReaction,
  macroscopicRateConstant: number,
  volumeLiters: number,
): RateConversionResult {
  if (!Number.isFinite(macroscopicRateConstant) || macroscopicRateConstant < 0) {
    throw new SimulationInputError('Macroscopic rate constant must be finite and non-negative.');
  }
  if (!Number.isFinite(volumeLiters) || volumeLiters <= 0) {
    throw new SimulationInputError('Reaction volume must be finite and greater than zero litres.');
  }
  if (reaction.reactants.length === 0) {
    throw new SimulationInputError('Rate conversion requires at least one reactant term.');
  }

  const reactionOrder = reaction.reactants.reduce((sum, term) => sum + term.coefficient, 0);
  if (!Number.isSafeInteger(reactionOrder) || reactionOrder < 1 || reactionOrder > 100) {
    throw new SimulationInputError('Total reaction molecularity must be between 1 and 100.');
  }

  const orderFactorialLog = reaction.reactants.reduce(
    (sum, term) => sum + logFactorial(term.coefficient),
    0,
  );
  const macroscopicUnits = reactionOrder === 1
    ? 's^-1'
    : `M^-${reactionOrder - 1} s^-1`;

  if (macroscopicRateConstant === 0) {
    return {
      stochasticRateConstant: 0,
      reactionOrder,
      macroscopicUnits,
      stochasticUnits: 's^-1 per available reactant combination',
      formula: 'c = 0',
    };
  }

  const logNA_V = Math.log(AVOGADRO_CONSTANT) + Math.log(volumeLiters);
  const logC = Math.log(macroscopicRateConstant) + orderFactorialLog
    - (reactionOrder - 1) * logNA_V;
  const stochasticRateConstant = Math.exp(logC);
  if (!Number.isFinite(stochasticRateConstant) || stochasticRateConstant === 0) {
    throw new SimulationInputError('Converted stochastic rate is outside the representable numeric range.');
  }

  return {
    stochasticRateConstant,
    reactionOrder,
    macroscopicUnits,
    stochasticUnits: 's^-1 per available reactant combination',
    formula: `c = k × (Nₐ × V)^(1−${reactionOrder}) × ${reaction.reactants.map(term => `${term.coefficient}!`).join(' × ')}`,
  };
}
