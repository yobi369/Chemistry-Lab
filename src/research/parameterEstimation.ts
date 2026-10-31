import { SimulationInputError } from './gillespie';

export interface KineticObservation {
  readonly timeSeconds: number;
  /** Positive concentration or population measured at the stated time. */
  readonly value: number;
  /** Optional positive measurement standard deviation in the same units as value. */
  readonly standardDeviation?: number;
}

export interface FirstOrderFit {
  readonly model: 'first-order-decay';
  readonly rateConstantPerSecond: number;
  readonly rateConstantStandardErrorPerSecond: number;
  readonly approximateConfidenceInterval95PerSecond: readonly [number, number];
  readonly initialValue: number;
  readonly coefficientOfDetermination: number;
  readonly residualSumOfSquaresLogSpace: number;
  readonly observationsUsed: number;
  readonly weightedLeastSquares: boolean;
  readonly fitted: readonly { timeSeconds: number; observed: number; predicted: number; residualLog: number }[];
}

/**
 * Fit y(t)=y0 exp(-k t) by least squares in log space (weighted when measurement SDs are supplied).
 * When SDs are supplied, their relative log-space uncertainty is approximated by SD(y)/y. This is a deliberately narrow estimator for positive first-order decay data;
 * it is not a general nonlinear kinetic mechanism fitter.
 */
export function fitFirstOrderDecay(observations: readonly KineticObservation[]): FirstOrderFit {
  if (observations.length < 3) {
    throw new SimulationInputError('At least three observations are required to estimate a rate and residual uncertainty.');
  }
  for (const [index, item] of observations.entries()) {
    if (!Number.isFinite(item.timeSeconds) || item.timeSeconds < 0 ||
        !Number.isFinite(item.value) || item.value <= 0 ||
        (item.standardDeviation !== undefined &&
          (!Number.isFinite(item.standardDeviation) || item.standardDeviation <= 0))) {
      throw new SimulationInputError(`Observation ${index + 1} must have non-negative time, positive value and (if supplied) positive standard deviation.`);
    }
  }
  const distinctTimes = new Set(observations.map(item => item.timeSeconds));
  if (distinctTimes.size < 3) {
    throw new SimulationInputError('At least three distinct observation times are required.');
  }

  const xs = observations.map(item => item.timeSeconds);
  const ys = observations.map(item => Math.log(item.value));
  const hasUncertainty = observations.some(item => item.standardDeviation !== undefined);
  if (hasUncertainty && observations.some(item => item.standardDeviation === undefined)) {
    throw new SimulationInputError('Provide standard deviations for every observation or omit them for all observations.');
  }
  // For small relative errors, SD(log y) is approximated by SD(y)/y.
  const weights = observations.map(item => hasUncertainty
    ? 1 / ((item.standardDeviation! / item.value) ** 2) : 1);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const xMean = xs.reduce((sum, x, i) => sum + weights[i] * x, 0) / weightSum;
  const yMean = ys.reduce((sum, y, i) => sum + weights[i] * y, 0) / weightSum;
  const sxx = xs.reduce((sum, x, i) => sum + weights[i] * (x - xMean) ** 2, 0);
  if (!(sxx > 0)) throw new SimulationInputError('Observation times do not contain enough variation.');
  const slope = xs.reduce((sum, x, i) => sum + weights[i] * (x - xMean) * (ys[i] - yMean), 0) / sxx;
  const intercept = yMean - slope * xMean;
  const rate = -slope;
  if (!Number.isFinite(rate) || rate < 0) {
    throw new SimulationInputError('Observed data do not support a non-negative first-order decay rate.');
  }

  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const rss = residuals.reduce((sum, residual, i) => sum + weights[i] * residual ** 2, 0);
  const residualVariance = rss / (observations.length - 2);
  // Known log-space measurement variances set the covariance scale directly;
  // otherwise estimate residual variance from the unweighted regression.
  const standardError = Math.sqrt((hasUncertainty ? 1 : residualVariance) / sxx);
  const total = ys.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
  const rSquared = total === 0 ? (rss === 0 ? 1 : 0) : 1 - rss / total;
  const fitted = observations.map((item, i) => ({
    timeSeconds: item.timeSeconds,
    observed: item.value,
    predicted: Math.exp(intercept + slope * item.timeSeconds),
    residualLog: residuals[i],
  }));
  return {
    model: 'first-order-decay',
    rateConstantPerSecond: rate,
    rateConstantStandardErrorPerSecond: standardError,
    approximateConfidenceInterval95PerSecond: [
      Math.max(0, rate - 1.96 * standardError),
      rate + 1.96 * standardError,
    ],
    initialValue: Math.exp(intercept),
    coefficientOfDetermination: rSquared,
    residualSumOfSquaresLogSpace: rss,
    observationsUsed: observations.length,
    weightedLeastSquares: hasUncertainty,
    fitted,
  };
}
