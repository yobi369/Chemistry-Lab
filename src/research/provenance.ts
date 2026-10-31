import type { ReactionNetwork, SimulationResult, SpeciesCounts } from './types';
import { validateInitialCounts, validateNetwork } from './validateNetwork';

export type RateParameterisation =
  | { readonly kind: 'illustrative_default'; readonly stochasticRateConstant: number }
  | { readonly kind: 'direct_stochastic'; readonly stochasticRateConstant: number }
  | {
      readonly kind: 'macroscopic_conversion';
      readonly macroscopicRateConstant: number;
      readonly volumeLiters: number;
      readonly reactionOrder: number;
      readonly macroscopicUnits: string;
      readonly stochasticRateConstant: number;
    }
  | {
      readonly kind: 'arrhenius_conversion';
      readonly preExponentialFactor: number;
      readonly activationEnergyJPerMol: number;
      readonly temperatureKelvin: number;
      readonly macroscopicRateConstant: number;
      readonly volumeLiters: number;
      readonly reactionOrder: number;
      readonly macroscopicUnits: string;
      readonly stochasticRateConstant: number;
    };

export type ReactionRateParameterisation = RateParameterisation & { readonly reactionId: string };

export interface ExperimentRecord {
  readonly schemaVersion: 'chemistry-lab-experiment/v2';
  readonly createdAt: string;
  readonly software: {
    readonly name: 'Chemistry Lab';
    readonly researchKernel: 'gillespie-direct/v1';
  };
  readonly model: ReactionNetwork;
  readonly initialCounts: SpeciesCounts;
  readonly rateParameterisations: readonly ReactionRateParameterisation[];
  readonly simulation: {
    readonly durationSeconds: number;
    readonly seed: number;
    readonly maxEvents: number;
    readonly stochasticRateConstantUnits: 's^-1 per available reactant combination';
  };
  readonly assumptions: readonly string[];
  readonly result: SimulationResult;
}

export function createExperimentRecord(
  model: ReactionNetwork,
  initialCounts: SpeciesCounts,
  simulation: { durationSeconds: number; seed: number; maxEvents?: number },
  result: SimulationResult,
  createdAt = new Date().toISOString(),
  rateParameterisations?: readonly ReactionRateParameterisation[],
): ExperimentRecord {
  return {
    schemaVersion: 'chemistry-lab-experiment/v2',
    createdAt,
    software: { name: 'Chemistry Lab', researchKernel: 'gillespie-direct/v1' },
    model,
    initialCounts: { ...initialCounts },
    rateParameterisations: rateParameterisations ?? model.reactions.map((reaction) => ({
      reactionId: reaction.id,
      kind: 'direct_stochastic' as const,
      stochasticRateConstant: reaction.stochasticRateConstant,
    })),
    simulation: {
      durationSeconds: simulation.durationSeconds,
      seed: simulation.seed,
      maxEvents: simulation.maxEvents ?? 100_000,
      stochasticRateConstantUnits: 's^-1 per available reactant combination',
    },
    assumptions: [
      'Well-mixed reaction network.',
      'Constant-volume interpretation.',
      'Continuous-time Markov jump process simulated with the Gillespie direct method.',
      'Any kinetic conversion pathway supplied by the researcher is recorded per reaction channel in rateParameterisations.',
      'Species formula compositions and formal charges are user-supplied model metadata.',
    ],
    result,
  };
}

export function serializeExperiment(record: ExperimentRecord): string {
  return JSON.stringify(record, null, 2);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function simulationEventsToCsv(result: SimulationResult, network: ReactionNetwork): string {
  const species = network.species;
  const header = [
    'event_index',
    'time_seconds',
    'reaction_id',
    'reaction_label',
    ...species.map((item) => `count_${item.id}`),
  ];
  const rows = result.events.map((event, index) => [
    index + 1,
    event.timeSeconds,
    event.reactionId,
    event.reactionLabel,
    ...species.map((item) => event.countsAfter[item.id] ?? 0),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

/**
 * Parse and integrity-check a versioned experiment file before it is loaded.
 * This validates the recorded event trajectory against the saved reaction
 * network; it does not certify the scientific validity of the model.
 */
export function parseExperimentRecord(json: string): ExperimentRecord {
  let record: ExperimentRecord;
  try {
    record = JSON.parse(json) as ExperimentRecord;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!record || record.schemaVersion !== 'chemistry-lab-experiment/v2') {
    throw new Error('Unsupported experiment file. Expected schema chemistry-lab-experiment/v2.');
  }
  if (!record.model || !Array.isArray(record.model.species) || !Array.isArray(record.model.reactions)) {
    throw new Error('Experiment file is missing a valid reaction network.');
  }
  if (!record.simulation || !record.result || !record.initialCounts) {
    throw new Error('Experiment file is missing simulation inputs or results.');
  }
  if (!Number.isFinite(record.simulation.durationSeconds) || record.simulation.durationSeconds <= 0 ||
      !Number.isSafeInteger(record.simulation.seed) || record.simulation.seed < 0 ||
      !Number.isSafeInteger(record.simulation.maxEvents) || record.simulation.maxEvents < 1) {
    throw new Error('Experiment simulation settings are invalid.');
  }

  const networkIssues = validateNetwork(record.model);
  if (networkIssues.length) {
    throw new Error(`Saved reaction network is invalid: ${networkIssues.map(issue => issue.message).join(' ')}`);
  }
  const countIssues = validateInitialCounts(record.model, record.initialCounts);
  if (countIssues.length) {
    throw new Error(`Saved initial populations are invalid: ${countIssues.map(issue => issue.message).join(' ')}`);
  }

  const reactionById = new Map(record.model.reactions.map(reaction => [reaction.id, reaction]));
  const parameterisations = record.rateParameterisations;
  if (!Array.isArray(parameterisations) || parameterisations.length !== record.model.reactions.length) {
    throw new Error('Experiment must contain one rate parameterisation record per reaction channel.');
  }
  const parameterisationIds = new Set<string>();
  for (const item of parameterisations) {
    if (!item || typeof item.reactionId !== 'string' || parameterisationIds.has(item.reactionId)) {
      throw new Error('Rate parameterisation records contain an invalid or duplicate reaction id.');
    }
    parameterisationIds.add(item.reactionId);
    const reaction = reactionById.get(item.reactionId);
    if (!reaction || !Number.isFinite(item.stochasticRateConstant) || item.stochasticRateConstant < 0 ||
        Math.abs(item.stochasticRateConstant - reaction.stochasticRateConstant) > Math.max(1, Math.abs(reaction.stochasticRateConstant)) * 1e-12) {
      throw new Error(`Rate parameterisation for "${item.reactionId}" does not match the saved reaction model.`);
    }
  }
  for (const reaction of record.model.reactions) {
    if (!parameterisationIds.has(reaction.id)) throw new Error(`Missing rate parameterisation for reaction "${reaction.id}".`);
  }

  const result = record.result;
  if (!Array.isArray(result.events) || result.seed !== record.simulation.seed ||
      !Number.isFinite(result.elapsedSeconds) || result.elapsedSeconds < 0 ||
      result.elapsedSeconds > record.simulation.durationSeconds ||
      result.events.length > record.simulation.maxEvents) {
    throw new Error('Saved simulation result metadata is inconsistent.');
  }
  for (const species of record.model.species) {
    if (result.initialCounts?.[species.id] !== record.initialCounts[species.id]) {
      throw new Error('Saved result initial populations do not match the experiment inputs.');
    }
  }
  if (!['time_limit', 'no_enabled_reactions', 'event_limit', 'cancelled'].includes(result.terminatedBy)) {
    throw new Error('Saved simulation termination state is invalid.');
  }
  if ((result.terminatedBy === 'time_limit' || result.terminatedBy === 'no_enabled_reactions') &&
      result.elapsedSeconds !== record.simulation.durationSeconds) {
    throw new Error('Completed simulation observation horizon does not match its configured duration.');
  }
  if (result.terminatedBy === 'event_limit' && result.events.length !== record.simulation.maxEvents) {
    throw new Error('Event-limited result does not match the configured event cap.');
  }

  const expected: Record<string, number> = { ...record.initialCounts };
  let previousTime = 0;
  for (let index = 0; index < result.events.length; index += 1) {
    const event = result.events[index];
    const reaction = reactionById.get(event.reactionId);
    if (!reaction || event.reactionLabel !== reaction.label ||
        !Number.isFinite(event.timeSeconds) || event.timeSeconds <= previousTime ||
        event.timeSeconds > record.simulation.durationSeconds) {
      throw new Error(`Event ${index + 1} has invalid time or reaction metadata.`);
    }
    previousTime = event.timeSeconds;
    for (const term of reaction.reactants) {
      expected[term.speciesId] -= term.coefficient;
      if (expected[term.speciesId] < 0) throw new Error(`Event ${index + 1} consumes unavailable species "${term.speciesId}".`);
    }
    for (const term of reaction.products) expected[term.speciesId] += term.coefficient;

    for (const species of record.model.species) {
      const actual = event.countsAfter?.[species.id];
      if (!Number.isSafeInteger(actual) || actual < 0 || actual !== expected[species.id]) {
        throw new Error(`Event ${index + 1} population snapshot is inconsistent for "${species.id}".`);
      }
    }
  }

  for (const species of record.model.species) {
    const finalCount = result.finalCounts?.[species.id];
    if (!Number.isSafeInteger(finalCount) || finalCount < 0 || finalCount !== expected[species.id]) {
      throw new Error(`Final population is inconsistent for "${species.id}".`);
    }
  }

  return record;
}
