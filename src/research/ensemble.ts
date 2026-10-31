import type { ReactionNetwork, SpeciesCounts } from './types';
import { simulateGillespie, type SimulationOptions } from './gillespie';
import { SimulationInputError } from './gillespie';

export interface EnsembleOptions extends SimulationOptions {
  readonly replicates: number;
}

export interface EnsembleSpeciesSummary {
  readonly speciesId: string;
  readonly mean: number;
  readonly standardDeviation: number;
  readonly standardError: number;
  /** Normal-approximation 95% confidence interval for the ensemble mean. */
  readonly confidenceInterval95: readonly [number, number];
}

export interface EnsembleResult {
  readonly replicateCount: number;
  readonly baseSeed: number;
  readonly durationSeconds: number;
  readonly species: readonly EnsembleSpeciesSummary[];
}

/**
 * Run independent seeded SSA trajectories and summarize final populations
 * using Welford's numerically stable online mean/variance algorithm.
 * Replicate seeds are baseSeed, baseSeed + 1, ... modulo uint32.
 */
export function simulateEnsemble(
  network: ReactionNetwork,
  initialCounts: SpeciesCounts,
  options: EnsembleOptions,
): EnsembleResult {
  if (!Number.isSafeInteger(options.replicates) || options.replicates < 2 || options.replicates > 10_000) {
    throw new SimulationInputError('replicates must be an integer between 2 and 10,000.');
  }
  const baseSeed = options.seed ?? 1;
  if (!Number.isSafeInteger(baseSeed) || baseSeed < 0 || baseSeed > 4_294_967_295) {
    throw new SimulationInputError('seed must be an integer between 0 and 4,294,967,295.');
  }

  const ids = network.species.map((species) => species.id);
  const means: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const m2: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));

  for (let replicate = 0; replicate < options.replicates; replicate += 1) {
    if (options.shouldCancel?.()) {
      throw new SimulationInputError(`Ensemble cancelled after ${replicate} of ${options.replicates} replicates.`);
    }
    const seed = (baseSeed + replicate) >>> 0;
    const trajectory = simulateGillespie(network, initialCounts, {
      durationSeconds: options.durationSeconds,
      seed,
      maxEvents: options.maxEvents,
    });
    if (trajectory.terminatedBy === 'event_limit') {
      throw new SimulationInputError(`Replicate ${replicate + 1} reached the event limit; increase the limit or shorten the simulation horizon before interpreting the ensemble.`);
    }

    const n = replicate + 1;
    for (const id of ids) {
      const value = trajectory.finalCounts[id] ?? 0;
      const delta = value - means[id];
      means[id] += delta / n;
      m2[id] += delta * (value - means[id]);
    }
  }

  const species = ids.map((speciesId) => {
    const variance = m2[speciesId] / (options.replicates - 1);
    const standardDeviation = Math.sqrt(Math.max(0, variance));
    const standardError = standardDeviation / Math.sqrt(options.replicates);
    return {
      speciesId,
      mean: means[speciesId],
      standardDeviation,
      standardError,
      confidenceInterval95: [
        means[speciesId] - 1.96 * standardError,
        means[speciesId] + 1.96 * standardError,
      ] as const,
    };
  });

  return {
    replicateCount: options.replicates,
    baseSeed,
    durationSeconds: options.durationSeconds,
    species,
  };
}
