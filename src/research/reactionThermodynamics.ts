import type { ReactionNetwork, StochasticReaction } from './types';
import { SimulationInputError } from './gillespie';
import { GAS_CONSTANT_J_PER_MOL_K } from './arrhenius';

export interface ReactionThermodynamicAnalysis {
  readonly reactionId: string;
  readonly temperatureKelvin: number;
  readonly standardGibbsEnergyJPerMol: number;
  readonly logEquilibriumConstant: number;
  readonly equilibriumConstant: number | null;
  readonly reactionQuotient: number | null;
  readonly reactionGibbsEnergyJPerMol: number | null;
  readonly directionAtSuppliedActivities: 'forward' | 'reverse' | 'equilibrium' | 'undetermined';
}

function sumStoichiometric(values: Readonly<Record<string, number>>, terms: StochasticReaction['products']): number {
  return terms.reduce((sum, term) => {
    const value = values[term.speciesId];
    if (!Number.isFinite(value)) throw new SimulationInputError(`Missing finite thermodynamic/activity value for species "${term.speciesId}".`);
    return sum + value * term.coefficient;
  }, 0);
}

/**
 * Analyse one reaction using species standard Gibbs formation energies and
 * dimensionless activities. All thermodynamic inputs must use the same
 * standard-state convention. This function does not modify kinetic rates.
 */
export function analyzeReactionThermodynamics(args: {
  network: ReactionNetwork;
  reactionId: string;
  standardGibbsFormationJPerMol: Readonly<Record<string, number>>;
  temperatureKelvin: number;
  activities?: Readonly<Record<string, number>>;
  equilibriumToleranceJPerMol?: number;
}): ReactionThermodynamicAnalysis {
  const { network, reactionId, standardGibbsFormationJPerMol, temperatureKelvin, activities } = args;
  if (!Number.isFinite(temperatureKelvin) || temperatureKelvin <= 0) {
    throw new SimulationInputError('Temperature must be finite and greater than zero kelvin.');
  }
  const reaction = network.reactions.find(item => item.id === reactionId);
  if (!reaction) throw new SimulationInputError(`Unknown reaction id "${reactionId}".`);
  const speciesIds = new Set(network.species.map(item => item.id));
  for (const id of [...reaction.reactants, ...reaction.products].map(term => term.speciesId)) {
    if (!speciesIds.has(id)) throw new SimulationInputError(`Reaction references unknown species "${id}".`);
  }
  const deltaG = sumStoichiometric(standardGibbsFormationJPerMol, reaction.products) -
    sumStoichiometric(standardGibbsFormationJPerMol, reaction.reactants);
  const logK = -deltaG / (GAS_CONSTANT_J_PER_MOL_K * temperatureKelvin);
  const rawK = Math.exp(logK);
  const equilibriumConstant = Number.isFinite(rawK) && rawK > 0 ? rawK : null;

  let quotient: number | null = null;
  let reactionGibbs: number | null = null;
  let direction: ReactionThermodynamicAnalysis['directionAtSuppliedActivities'] = 'undetermined';
  if (activities) {
    const logQ = sumStoichiometric(
      Object.fromEntries(Object.entries(activities).map(([id, value]) => {
        if (!Number.isFinite(value) || value <= 0) throw new SimulationInputError(`Activity for "${id}" must be finite and positive.`);
        return [id, Math.log(value)];
      })),
      reaction.products,
    ) - sumStoichiometric(
      Object.fromEntries(Object.entries(activities).map(([id, value]) => [id, Math.log(value)])),
      reaction.reactants,
    );
    const rawQ = Math.exp(logQ);
    quotient = Number.isFinite(rawQ) && rawQ > 0 ? rawQ : null;
    reactionGibbs = deltaG + GAS_CONSTANT_J_PER_MOL_K * temperatureKelvin * logQ;
    const tolerance = args.equilibriumToleranceJPerMol ?? 1e-6;
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new SimulationInputError('Equilibrium tolerance must be finite and non-negative.');
    direction = Math.abs(reactionGibbs) <= tolerance
      ? 'equilibrium'
      : reactionGibbs < 0 ? 'forward' : 'reverse';
  }
  return {
    reactionId,
    temperatureKelvin,
    standardGibbsEnergyJPerMol: deltaG,
    logEquilibriumConstant: logK,
    equilibriumConstant,
    reactionQuotient: quotient,
    reactionGibbsEnergyJPerMol: reactionGibbs,
    directionAtSuppliedActivities: direction,
  };
}
