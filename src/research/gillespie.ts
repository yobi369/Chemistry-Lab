import type {
  ReactionNetwork,
  SimulationEvent,
  SimulationResult,
  SpeciesCounts,
} from './types';
import { validateInitialCounts, validateNetwork } from './validateNetwork';

export interface SimulationOptions {
  readonly durationSeconds: number;
  readonly seed?: number;
  readonly maxEvents?: number;
  /** Optional cancellation hook for long-running simulations. */
  readonly shouldCancel?: () => boolean;
}

export class SimulationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationInputError';
  }
}

/** Small deterministic PRNG (Mulberry32). Same seed + inputs => same trajectory. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function combination(n: number, k: number): number {
  if (k < 0 || n < k) return 0;
  if (k === 0) return 1;
  let result = 1;
  for (let i = 1; i <= k; i += 1) result *= (n - (k - i)) / i;
  return result;
}

/**
 * Gillespie direct-method SSA for a well-mixed, constant-volume reaction network.
 * Propensity a_j = c_j * product_i choose(n_i, nu_ij).
 *
 * c_j is a stochastic rate constant in s^-1 per available reactant combination.
 * Converting experimental macroscopic rate constants requires explicit unit,
 * volume and Avogadro-constant handling; this function intentionally does not
 * guess that conversion.
 */
export function simulateGillespie(
  network: ReactionNetwork,
  initialCounts: SpeciesCounts,
  options: SimulationOptions,
): SimulationResult {
  const networkIssues = validateNetwork(network);
  if (networkIssues.length) {
    throw new SimulationInputError(networkIssues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  const countIssues = validateInitialCounts(network, initialCounts);
  if (countIssues.length) {
    throw new SimulationInputError(countIssues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  }
  if (!Number.isFinite(options.durationSeconds) || options.durationSeconds < 0) {
    throw new SimulationInputError('durationSeconds must be finite and non-negative.');
  }

  const requestedSeed = options.seed ?? 1;
  if (!Number.isSafeInteger(requestedSeed) || requestedSeed < 0 || requestedSeed > 4_294_967_295) {
    throw new SimulationInputError('seed must be an integer between 0 and 4,294,967,295.');
  }
  const seed = requestedSeed >>> 0;
  const maxEvents = options.maxEvents ?? 100_000;
  if (!Number.isSafeInteger(maxEvents) || maxEvents < 1) {
    throw new SimulationInputError('maxEvents must be a positive safe integer.');
  }

  const random = createSeededRandom(seed);
  const counts: Record<string, number> = { ...initialCounts };
  const initial: Record<string, number> = { ...initialCounts };
  const events: SimulationEvent[] = [];
  let time = 0;
  let terminatedBy: SimulationResult['terminatedBy'] = 'time_limit';

  while (time < options.durationSeconds) {
    if (options.shouldCancel?.()) {
      terminatedBy = 'cancelled';
      break;
    }

    const propensities = network.reactions.map((reaction) => {
      let propensity = reaction.stochasticRateConstant;
      for (const term of reaction.reactants) {
        propensity *= combination(counts[term.speciesId] ?? 0, term.coefficient);
        if (propensity === 0) break;
      }
      return propensity;
    });
    const totalPropensity = propensities.reduce((sum, value) => sum + value, 0);

    if (!Number.isFinite(totalPropensity)) {
      throw new SimulationInputError('Total reaction propensity overflowed; reduce populations or rate constants.');
    }
    if (!(totalPropensity > 0)) {
      terminatedBy = 'no_enabled_reactions';
      time = options.durationSeconds;
      break;
    }

    // Avoid log(0), including the rare case where a PRNG returns exactly zero.
    const uTime = Math.max(Number.EPSILON, 1 - random());
    const tau = -Math.log(uTime) / totalPropensity;
    if (time + tau > options.durationSeconds) {
      time = options.durationSeconds;
      break;
    }

    const threshold = random() * totalPropensity;
    let cumulative = 0;
    let selectedIndex = propensities.length - 1;
    for (let index = 0; index < propensities.length; index += 1) {
      cumulative += propensities[index];
      if (threshold < cumulative) {
        selectedIndex = index;
        break;
      }
    }

    const reaction = network.reactions[selectedIndex];
    for (const term of reaction.reactants) counts[term.speciesId] -= term.coefficient;
    for (const term of reaction.products) counts[term.speciesId] += term.coefficient;
    time += tau;
    events.push({
      timeSeconds: time,
      reactionId: reaction.id,
      reactionLabel: reaction.label,
      countsAfter: { ...counts },
    });

    if (events.length >= maxEvents) {
      terminatedBy = 'event_limit';
      break;
    }
  }

  return {
    initialCounts: initial,
    finalCounts: { ...counts },
    events,
    elapsedSeconds: time,
    terminatedBy,
    seed,
  };
}
