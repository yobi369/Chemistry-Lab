export interface BootstrapInterval {
  readonly estimate: number;
  readonly lower: number;
  readonly median: number;
  readonly upper: number;
  readonly sampleCount: number;
}

/** Seeded Mulberry32 generator; identical seeds produce identical resampling streams. */
export function createSeededRandom(seed: number): () => number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Bootstrap seed must be an unsigned 32-bit integer.');
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear-interpolated empirical percentile, matching common statistical software conventions. */
export function empiricalPercentile(values: readonly number[], probability: number): number {
  if (!values.length || values.some(value => !Number.isFinite(value)) ||
      !Number.isFinite(probability) || probability < 0 || probability > 1)
    throw new Error('Percentile requires finite values and a probability in [0, 1].');
  const sorted = [...values].sort((a, b) => a - b);
  const position = probability * (sorted.length - 1);
  const lower = Math.floor(position), upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const fraction = position - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

/** Summarise successful bootstrap estimates; no normality assumption is made. */
export function summarizeBootstrap(
  values: readonly number[],
  originalEstimate: number,
  minimumSamples = 20,
): BootstrapInterval {
  if (!Number.isFinite(originalEstimate) || !Number.isSafeInteger(minimumSamples) || minimumSamples < 1)
    throw new Error('Invalid bootstrap estimate or minimum sample count.');
  if (values.length < minimumSamples || values.some(value => !Number.isFinite(value)))
    throw new Error('Insufficient finite bootstrap estimates for percentile intervals.');
  return {
    estimate: originalEstimate,
    lower: empiricalPercentile(values, 0.025),
    median: empiricalPercentile(values, 0.5),
    upper: empiricalPercentile(values, 0.975),
    sampleCount: values.length,
  };
}
