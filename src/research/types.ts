/**
 * Research kernel domain model.
 *
 * This kernel is a well-mixed, continuous-time stochastic reaction network.
 * It is deliberately separate from the visual particle sandbox: its outputs
 * must not be interpreted as spatial molecular dynamics or quantum chemistry.
 */

export type ElementalComposition = Readonly<Record<string, number>>;

export interface ChemicalSpecies {
  readonly id: string;
  readonly label: string;
  /** Number of atoms of each element in one entity, e.g. { H: 2, O: 1 }. */
  readonly composition: ElementalComposition;
  /** Integer formal charge, in units of the elementary charge. */
  readonly charge: number;
}

export interface StoichiometricTerm {
  readonly speciesId: string;
  readonly coefficient: number;
}

export interface StochasticReaction {
  readonly id: string;
  readonly label: string;
  readonly reactants: readonly StoichiometricTerm[];
  readonly products: readonly StoichiometricTerm[];
  /**
   * Stochastic rate constant c in s^-1 per available reactant combination.
   * This is NOT a macroscopic k in M^(1-order) s^-1.
   */
  readonly stochasticRateConstant: number;
}

export interface ReactionNetwork {
  readonly species: readonly ChemicalSpecies[];
  readonly reactions: readonly StochasticReaction[];
}

export type SpeciesCounts = Readonly<Record<string, number>>;

export interface ValidationIssue {
  readonly code:
    | 'DUPLICATE_SPECIES'
    | 'DUPLICATE_REACTION'
    | 'INVALID_COMPOSITION'
    | 'INVALID_CHARGE'
    | 'UNKNOWN_SPECIES'
    | 'INVALID_COEFFICIENT'
    | 'EMPTY_SIDE'
    | 'INVALID_RATE_CONSTANT'
    | 'ATOM_IMBALANCE'
    | 'CHARGE_IMBALANCE'
    | 'INVALID_INITIAL_COUNT';
  readonly message: string;
  readonly path: string;
}

export interface SimulationEvent {
  readonly timeSeconds: number;
  readonly reactionId: string;
  readonly reactionLabel: string;
  readonly countsAfter: SpeciesCounts;
}

export interface SimulationResult {
  readonly initialCounts: SpeciesCounts;
  readonly finalCounts: SpeciesCounts;
  readonly events: readonly SimulationEvent[];
  readonly elapsedSeconds: number;
  readonly terminatedBy: 'time_limit' | 'no_enabled_reactions' | 'event_limit'
  | 'cancelled';
  readonly seed: number;
}
