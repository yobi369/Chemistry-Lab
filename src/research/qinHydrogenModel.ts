import { calculateLocalFitStatistics } from './localFitStatistics';
export type QinModel4Variant = '4L' | '4G';
export type QinIronType = 'Alfa' | 'Beijing' | 'Hepure' | 'Toda' | 'CMC-nZVI';

export interface QinHydrogenObservation {
  readonly timeHours: number;
  readonly hydrogenMicromoles: number;
  readonly standardDeviationMicromoles: number;
}
export interface QinExperimentSeries {
  readonly experimentId: string;
  readonly label: string;
  readonly ironType: QinIronType;
  readonly observations: readonly QinHydrogenObservation[];
}
export interface QinModel4Options {
  readonly weighting: 'unweighted' | 'standard-deviation';
  /** Only applies to SD-weighted fits. Exclusion is explicit and counted in the result. */
  readonly zeroStandardDeviation: 'exclude' | 'unweighted' | 'error';
  readonly initialRatesByIronType?: Readonly<Partial<Record<QinIronType, { k1PerHour: number; k2PerHour: number }>>>;
  readonly initialSharedK1PerHour?: number;
  readonly initialRatiosByIronType?: Readonly<Partial<Record<QinIronType, number>>>;
  readonly maxIterations?: number;
  readonly tolerance?: number;
}
export interface QinModel4Fit {
  readonly model: QinModel4Variant;
  readonly equation: 'A*(1-exp(-k1*t)) + B*(1-exp(-k2*t))';
  readonly rateConstantsPerHour: Readonly<Record<string, { k1PerHour: number; k2PerHour: number }>>;
  readonly localAmplitudesMicromoles: Readonly<Record<string, { A: number; B: number }>>;
  readonly fitted: readonly {
    experimentId: string; label: string; ironType: QinIronType;
    timeHours: number; observedMicromoles: number; predictedMicromoles: number;
    residualMicromoles: number; includedInObjective: boolean;
  }[];
  readonly weighting: QinModel4Options['weighting'];
  readonly zeroStandardDeviationPolicy: QinModel4Options['zeroStandardDeviation'];
  readonly includedObservationCount: number;
  readonly excludedZeroStandardDeviationCount: number;
  readonly parameterCount: number;
  readonly degreesOfFreedom: number;
  readonly sumSquaredResiduals: number;
  readonly weightedResidualSumSquares: number | null;
  readonly reducedChiSquare: number | null;
  readonly reducedChiSquareConvention: 'weighted-residual-sum-of-squares/df' | 'unweighted-residual-sum-of-squares/df';
  readonly iterations: number;
  readonly converged: boolean;
  readonly standardErrors: Readonly<Record<string, number | null>> | null;
  readonly covarianceMatrix: readonly (readonly number[])[] | null;
  readonly correlationMatrix: Readonly<Record<string, Readonly<Record<string, number>>>> | null;
  readonly identifiableParameterCount: number;
  readonly locallyIdentifiable: boolean;
  readonly informationConditionNumber: number;
  readonly warnings: readonly string[];
}

export class QinModel4FitError extends Error {
  constructor(message: string) { super(message); this.name = 'QinModel4FitError'; }
}
const ironTypes: readonly QinIronType[] = ['Alfa', 'Beijing', 'Hepure', 'Toda', 'CMC-nZVI'];
const finite = Number.isFinite;
function solve(matrix: number[][], vector: readonly number[]): number[] | null {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-18) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row[n]);
}
function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}
function solveAmplitudes(
  observations: readonly QinHydrogenObservation[],
  k1: number, k2: number,
  weights: readonly (number | null)[],
): { A: number; B: number; residuals: number[]; cost: number } {
  let s11 = 0, s12 = 0, s22 = 0, b1 = 0, b2 = 0;
  const x1: number[] = [], x2: number[] = [];
  observations.forEach((o, i) => {
    const a = -Math.expm1(-k1 * o.timeHours);
    const b = -Math.expm1(-k2 * o.timeHours);
    x1.push(a); x2.push(b);
    const w = weights[i] ?? 0;
    s11 += w * a * a; s12 += w * a * b; s22 += w * b * b;
    b1 += w * a * o.hydrogenMicromoles; b2 += w * b * o.hydrogenMicromoles;
  });
  const determinant = s11 * s22 - s12 * s12;
  let A = 0, B = 0;
  if (determinant > 1e-24) {
    A = (b1 * s22 - b2 * s12) / determinant;
    B = (b2 * s11 - b1 * s12) / determinant;
  }
  if (A < 0 && B < 0) { A = 0; B = 0; }
  else if (A < 0) { A = 0; B = s22 > 0 ? Math.max(0, b2 / s22) : 0; }
  else if (B < 0) { B = 0; A = s11 > 0 ? Math.max(0, b1 / s11) : 0; }
  const residuals = observations.map((o, i) => o.hydrogenMicromoles - A * x1[i] - B * x2[i]);
  const cost = residuals.reduce((sum, r, i) => sum + (weights[i] ?? 0) * r * r, 0);
  return { A, B, residuals, cost };
}

/** Fit the paper's independent two-phase appearance model with 4L or 4G sharing. */
export function fitQinModel4(
  variant: QinModel4Variant,
  series: readonly QinExperimentSeries[],
  options: QinModel4Options,
): QinModel4Fit {
  if (variant !== '4L' && variant !== '4G') throw new QinModel4FitError('Model variant must be 4L or 4G.');
  if (!series.length || new Set(series.map(s => s.experimentId)).size !== series.length)
    throw new QinModel4FitError('Provide non-empty series with unique experiment ids.');
  const presentTypes = [...new Set(series.map(s => s.ironType))];
  if (presentTypes.some(t => !ironTypes.includes(t))) throw new QinModel4FitError('Unknown iron type.');
  if (options.weighting !== 'unweighted' && options.weighting !== 'standard-deviation')
    throw new QinModel4FitError('Choose an explicit weighting mode.');
  if (!['exclude', 'unweighted', 'error'].includes(options.zeroStandardDeviation))
    throw new QinModel4FitError('Choose an explicit zero-standard-deviation policy.');
  const maxIterations = options.maxIterations ?? 300;
  const tolerance = options.tolerance ?? 1e-9;
  if (!Number.isSafeInteger(maxIterations) || maxIterations < 1 || !finite(tolerance) || tolerance <= 0)
    throw new QinModel4FitError('Invalid optimizer controls.');

  const prepared = series.map(s => {
    if (!s.experimentId.trim() || !s.label.trim() || !s.observations.length)
      throw new QinModel4FitError('Each experiment requires an id, label and observations.');
    const weights = s.observations.map(o => {
      if (!finite(o.timeHours) || o.timeHours < 0 || !finite(o.hydrogenMicromoles) ||
          !finite(o.standardDeviationMicromoles) || o.standardDeviationMicromoles < 0)
        throw new QinModel4FitError('Observations require finite non-negative time and SD, and finite H2 values.');
      if (options.weighting === 'unweighted') return 1;
      if (o.standardDeviationMicromoles === 0) {
        if (options.zeroStandardDeviation === 'error')
          throw new QinModel4FitError('Zero SD encountered under the error policy.');
        if (options.zeroStandardDeviation === 'exclude') return null;
        return 1;
      }
      return 1 / (o.standardDeviationMicromoles * o.standardDeviationMicromoles);
    });
    if (!weights.some(w => w !== null)) throw new QinModel4FitError('Every point in an experiment was excluded from fitting.');
    return { ...s, weights };
  });
  const excludedZeroStandardDeviationCount = options.weighting === 'standard-deviation' &&
    options.zeroStandardDeviation === 'exclude'
    ? prepared.reduce((n, s) => n + s.weights.filter(w => w === null).length, 0) : 0;
  const includedObservationCount = prepared.reduce((n, s) => n + s.weights.filter(w => w !== null).length, 0);
  const rateKeys = variant === '4L'
    ? presentTypes.flatMap(t => [t + ':k1', t + ':k2'])
    : ['GLOBAL:k1', ...presentTypes.map(t => t + ':k2')];
  const initial = rateKeys.map(key => {
    if (key === 'GLOBAL:k1') return Math.log(options.initialSharedK1PerHour ?? 0.4);
    const [type, parameter] = key.split(':') as [QinIronType, 'k1' | 'k2'];
    const defaults = options.initialRatesByIronType?.[type] ?? { k1PerHour: 0.4, k2PerHour: 0.008 };
    return Math.log(parameter === 'k1' ? defaults.k1PerHour : defaults.k2PerHour);
  });
  if (initial.some(v => !finite(v) || v < Math.log(1e-8) || v > Math.log(10)))
    throw new QinModel4FitError('Initial rates must be finite and between 1e-8 and 10 h^-1.');

  const ratesFor = (theta: readonly number[], type: QinIronType) => {
    const k1 = variant === '4L'
      ? Math.exp(theta[rateKeys.indexOf(type + ':k1')])
      : Math.exp(theta[rateKeys.indexOf('GLOBAL:k1')]);
    const k2 = Math.exp(theta[rateKeys.indexOf(type + ':k2')]);
    return { k1, k2 };
  };
  const evaluate = (theta: readonly number[]) => {
    const amplitudes: Record<string, { A: number; B: number }> = {};
    const residuals: number[] = [];
    let cost = 0;
    for (const s of prepared) {
      const rates = ratesFor(theta, s.ironType);
      const fitted = solveAmplitudes(s.observations, rates.k1, rates.k2, s.weights);
      amplitudes[s.experimentId] = { A: fitted.A, B: fitted.B };
      for (let i = 0; i < fitted.residuals.length; i++) {
        const w = s.weights[i];
        if (w === null) continue;
        const r = fitted.residuals[i] * Math.sqrt(w);
        residuals.push(r); cost += r * r;
      }
    }
    return { amplitudes, residuals, cost };
  };
  let theta = [...initial], current = evaluate(theta), lambda = 1e-3, converged = false, iterations = 0;
  const jacobianAt = (point: readonly number[], base: readonly number[]) => {
    const columns = point.map((value, j) => {
      const step = 1e-4;
      const plus = [...point], minus = [...point];
      plus[j] = Math.min(Math.log(10), value + step);
      minus[j] = Math.max(Math.log(1e-8), value - step);
      const rp = evaluate(plus).residuals, rm = evaluate(minus).residuals;
      const width = plus[j] - minus[j];
      return rp.map((v, i) => (v - rm[i]) / width);
    });
    return base.map((_, i) => columns.map(col => col[i]));
  };
  for (; iterations < maxIterations; iterations++) {
    const j = jacobianAt(theta, current.residuals), n = theta.length;
    const normal = Array.from({ length: n }, (_, a) =>
      Array.from({ length: n }, (_, b) => j.reduce((sum, row) => sum + row[a] * row[b], 0)));
    const gradient = Array.from({ length: n }, (_, a) =>
      j.reduce((sum, row, i) => sum + row[a] * current.residuals[i], 0));
    const damped = normal.map((row, i) => row.map((v, k) =>
      v + (i === k ? lambda * Math.max(normal[i][i], 1e-10) : 0)));
    const delta = solve(damped, gradient.map(v => -v));
    if (!delta) break;
    const candidate = theta.map((v, i) => Math.max(Math.log(1e-8), Math.min(Math.log(10), v + delta[i])));
    const next = evaluate(candidate);
    if (next.cost < current.cost) {
      const improvement = current.cost - next.cost;
      theta = candidate; current = next; lambda = Math.max(lambda / 3, 1e-12);
      if (Math.sqrt(dot(delta, delta)) < tolerance || improvement < tolerance * (1 + current.cost)) {
        converged = true; iterations++; break;
      }
    } else {
      lambda *= 10;
      if (lambda > 1e12) break;
    }
  }
  const rateConstantsPerHour: Record<string, { k1PerHour: number; k2PerHour: number }> = {};
  for (const type of presentTypes) {
    const rates = ratesFor(theta, type);
    rateConstantsPerHour[type] = { k1PerHour: rates.k1, k2PerHour: rates.k2 };
  }
  const fitted = prepared.flatMap(s => {
    const rates = ratesFor(theta, s.ironType), amp = current.amplitudes[s.experimentId];
    return s.observations.map((o, i) => {
      const predictedMicromoles = amp.A * -Math.expm1(-rates.k1 * o.timeHours) +
        amp.B * -Math.expm1(-rates.k2 * o.timeHours);
      return {
        experimentId: s.experimentId, label: s.label, ironType: s.ironType,
        timeHours: o.timeHours, observedMicromoles: o.hydrogenMicromoles,
        predictedMicromoles, residualMicromoles: o.hydrogenMicromoles - predictedMicromoles,
        includedInObjective: s.weights[i] !== null,
      };
    });
  });
  const sumSquaredResiduals = fitted.reduce((sum, o) => sum + o.residualMicromoles ** 2, 0);
  const parameterCount = rateKeys.length + 2 * series.length;
  const degreesOfFreedom = includedObservationCount - parameterCount;
  const weightedResidualSumSquares = options.weighting === 'standard-deviation' ? current.cost : null;
  const parameterNames = [
    ...rateKeys.map(key => key === 'GLOBAL:k1' ? 'GLOBAL.k1PerHour' : key.replace(':', '.').replace('k1', 'k1PerHour').replace('k2', 'k2PerHour')),
    ...series.flatMap(s => [s.experimentId + '.A', s.experimentId + '.B']),
  ];
  const parameterValues = [
    ...theta.map(Math.exp),
    ...series.flatMap(s => [current.amplitudes[s.experimentId].A, current.amplitudes[s.experimentId].B]),
  ];
  const residualAt = (values: readonly number[]) => {
    const result: number[] = [];
    prepared.forEach((s, seriesIndex) => {
      const getRate = (key: string) => values[rateKeys.indexOf(key)];
      const k1 = variant === '4L' ? getRate(s.ironType + ':k1') : getRate('GLOBAL:k1');
      const k2 = getRate(s.ironType + ':k2');
      const A = values[rateKeys.length + 2 * seriesIndex];
      const B = values[rateKeys.length + 2 * seriesIndex + 1];
      s.observations.forEach((o, i) => {
        const w = s.weights[i];
        if (w === null) return;
        const predicted = A * -Math.expm1(-k1 * o.timeHours) + B * -Math.expm1(-k2 * o.timeHours);
        result.push((o.hydrogenMicromoles - predicted) * Math.sqrt(w));
      });
    });
    return result;
  };
  const covarianceScale = degreesOfFreedom > 0
    ? (options.weighting === 'standard-deviation' ? 1 : current.cost / degreesOfFreedom)
    : 1;
  const statistics = degreesOfFreedom > 0
    ? calculateLocalFitStatistics(parameterNames, parameterValues, residualAt, covarianceScale)
    : null;
  const warnings: string[] = [];
  if (!converged) warnings.push('Optimizer stopped without satisfying the convergence criterion; inspect initial rates and identifiability.');
  const boundaryRates = rateKeys.filter((_, i) => theta[i] <= Math.log(1e-8) + 1e-6 || theta[i] >= Math.log(10) - 1e-6);
  if (boundaryRates.length) warnings.push('Rate estimates reached optimizer bounds: ' + boundaryRates.join(', ') + '; treat these as boundary-limited, not precise point estimates.');
  if (degreesOfFreedom <= 0) warnings.push('Non-positive residual degrees of freedom; uncertainty statistics are not defined.');
  if (statistics) warnings.push(...statistics.warnings);
  if (excludedZeroStandardDeviationCount) warnings.push(excludedZeroStandardDeviationCount + ' zero-SD observations were excluded from the weighted objective by explicit policy.');
  if (variant === '4G') warnings.push('4G constrains k1 to one shared value across the full dataset; k2 remains grouped by iron type.');
  return {
    model: variant, equation: 'A*(1-exp(-k1*t)) + B*(1-exp(-k2*t))',
    rateConstantsPerHour, localAmplitudesMicromoles: current.amplitudes, fitted,
    weighting: options.weighting, zeroStandardDeviationPolicy: options.zeroStandardDeviation,
    includedObservationCount, excludedZeroStandardDeviationCount, parameterCount, degreesOfFreedom,
    sumSquaredResiduals, weightedResidualSumSquares,
    reducedChiSquare: degreesOfFreedom > 0
      ? (weightedResidualSumSquares ?? sumSquaredResiduals) / degreesOfFreedom : null,
    reducedChiSquareConvention: options.weighting === 'standard-deviation'
      ? 'weighted-residual-sum-of-squares/df' : 'unweighted-residual-sum-of-squares/df',
    iterations, converged,
    standardErrors: statistics?.standardErrors ?? null,
    covarianceMatrix: statistics?.covarianceMatrix ?? null,
    correlationMatrix: statistics?.correlationMatrix ?? null,
    identifiableParameterCount: statistics?.identifiableParameterCount ?? 0,
    locallyIdentifiable: statistics?.locallyIdentifiable ?? false,
    informationConditionNumber: statistics?.informationConditionNumber ?? Number.POSITIVE_INFINITY,
    warnings,
  };
}

/** Explicit label mapping; the experimental condition never changes the base iron grouping. */
export function inferQinIronType(label: string): QinIronType {
  const normalized = label.toLowerCase();
  if (normalized.includes('cmc')) return 'CMC-nZVI';
  if (normalized.includes('beijing')) return 'Beijing';
  if (normalized.includes('hepure')) return 'Hepure';
  if (normalized.includes('toda')) return 'Toda';
  if (normalized.includes('alfa')) return 'Alfa';
  throw new QinModel4FitError('Could not infer iron type from label: ' + label);
}
