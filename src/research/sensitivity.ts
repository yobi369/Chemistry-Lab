import { SimulationInputError, createSeededRandom } from './gillespie';

export interface LocalSensitivity {
  readonly baselineOutput: number;
  readonly perturbedOutput: number;
  readonly absoluteSensitivity: number;
  /** Dimensionless elasticity (parameter/output scaled); null at zero baseline. */
  readonly normalizedElasticity: number | null;
  readonly relativeStep: number;
}

/** Central finite-difference sensitivity for a positive scalar parameter. */
export function estimateLocalSensitivity(
  model: (parameter: number) => number,
  parameter: number,
  relativeStep = 1e-4,
): LocalSensitivity {
  if (!Number.isFinite(parameter) || parameter <= 0 ||
      !Number.isFinite(relativeStep) || relativeStep <= 0 || relativeStep >= 1) {
    throw new SimulationInputError('Parameter must be positive and relativeStep must lie between 0 and 1.');
  }
  const low = parameter * (1 - relativeStep);
  const high = parameter * (1 + relativeStep);
  const baselineOutput = model(parameter);
  const lowOutput = model(low);
  const highOutput = model(high);
  if (![baselineOutput, lowOutput, highOutput].every(Number.isFinite)) {
    throw new SimulationInputError('Sensitivity model returned a non-finite output.');
  }
  const absoluteSensitivity = (highOutput - lowOutput) / (high - low);
  return {
    baselineOutput,
    perturbedOutput: highOutput,
    absoluteSensitivity,
    normalizedElasticity: baselineOutput === 0 ? null : absoluteSensitivity * parameter / baselineOutput,
    relativeStep,
  };
}

export interface FirstOrderUncertaintyResult {
  readonly method: 'delta-method-and-lognormal-monte-carlo';
  readonly meanRatePerSecond: number;
  readonly standardDeviationRatePerSecond: number;
  readonly timeSeconds: number;
  readonly initialValue: number;
  readonly deltaMethodMean: number;
  readonly deltaMethodStandardDeviation: number;
  readonly monteCarloMean: number;
  readonly monteCarloStandardDeviation: number;
  readonly predictionInterval95: readonly [number, number];
  readonly samples: number;
  readonly seed: number;
}

function quantile(sorted: readonly number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
}

/**
 * Propagate uncertainty in a positive first-order rate using a moment-matched
 * lognormal distribution. This captures parameter uncertainty only; it does
 * not add measurement noise or model discrepancy.
 */
export function propagateFirstOrderRateUncertainty(args: {
  meanRatePerSecond: number;
  standardDeviationRatePerSecond: number;
  timeSeconds: number;
  initialValue: number;
  samples?: number;
  seed?: number;
}): FirstOrderUncertaintyResult {
  const { meanRatePerSecond: mean, standardDeviationRatePerSecond: sd, timeSeconds, initialValue } = args;
  const samples = args.samples ?? 5000;
  const seed = args.seed ?? 1;
  if (!Number.isFinite(mean) || mean <= 0 || !Number.isFinite(sd) || sd < 0 ||
      !Number.isFinite(timeSeconds) || timeSeconds < 0 ||
      !Number.isFinite(initialValue) || initialValue < 0 ||
      !Number.isSafeInteger(samples) || samples < 100 || samples > 100_000 ||
      !Number.isSafeInteger(seed) || seed < 0 || seed > 4_294_967_295) {
    throw new SimulationInputError('Uncertainty inputs are invalid; require positive mean rate, non-negative SD/time/value, 100–100,000 samples and a uint32 seed.');
  }
  const variance = sd ** 2;
  const sigma2 = Math.log(1 + variance / (mean ** 2));
  const sigma = Math.sqrt(sigma2);
  const mu = Math.log(mean) - sigma2 / 2;
  const random = createSeededRandom(seed);
  const values: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const u1 = Math.max(Number.EPSILON, random());
    const u2 = random();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const sampledRate = Math.exp(mu + sigma * normal);
    values.push(initialValue * Math.exp(-sampledRate * timeSeconds));
  }
  values.sort((a, b) => a - b);
  const mcMean = values.reduce((sum, value) => sum + value, 0) / samples;
  const mcVariance = values.reduce((sum, value) => sum + (value - mcMean) ** 2, 0) / (samples - 1);
  const deltaMean = initialValue * Math.exp(-mean * timeSeconds);
  const deltaSd = Math.abs(timeSeconds * deltaMean) * sd;
  return {
    method: 'delta-method-and-lognormal-monte-carlo',
    meanRatePerSecond: mean,
    standardDeviationRatePerSecond: sd,
    timeSeconds,
    initialValue,
    deltaMethodMean: deltaMean,
    deltaMethodStandardDeviation: deltaSd,
    monteCarloMean: mcMean,
    monteCarloStandardDeviation: Math.sqrt(mcVariance),
    predictionInterval95: [quantile(values, 0.025), quantile(values, 0.975)],
    samples,
    seed,
  };
}
