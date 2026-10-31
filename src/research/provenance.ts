import type { ReactionNetwork, SimulationResult, SpeciesCounts } from './types';

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

export interface ExperimentRecord {
  readonly schemaVersion: 'chemistry-lab-experiment/v1';
  readonly createdAt: string;
  readonly software: {
    readonly name: 'Chemistry Lab';
    readonly researchKernel: 'gillespie-direct/v1';
  };
  readonly model: ReactionNetwork;
  readonly initialCounts: SpeciesCounts;
  readonly rateParameterisation: RateParameterisation;
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
  rateParameterisation?: RateParameterisation,
): ExperimentRecord {
  return {
    schemaVersion: 'chemistry-lab-experiment/v1',
    createdAt,
    software: { name: 'Chemistry Lab', researchKernel: 'gillespie-direct/v1' },
    model,
    initialCounts: { ...initialCounts },
    rateParameterisation: rateParameterisation ?? {
      kind: 'direct_stochastic',
      stochasticRateConstant: model.reactions[0]?.stochasticRateConstant ?? 0,
    },
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
      'No automatic conversion from macroscopic concentration-based rate constants.',
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
