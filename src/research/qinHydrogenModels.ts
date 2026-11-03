import { calculateLocalFitStatistics } from './localFitStatistics';
import {
  QinExperimentSeries, QinIronType, QinModel4Options, QinModel4FitError,
} from './qinHydrogenModel';

export type QinAlternativeModel = '1' | '2' | '3';
export interface QinAlternativeFit {
  readonly model: QinAlternativeModel;
  readonly equation: string;
  readonly rateParametersByIronType: Readonly<Record<string, { k1PerHour: number; k2PerHour?: number; ratio?: number }>>;
  readonly localScaleParameters: Readonly<Record<string, number>>;
  readonly localScaleUnit: 'micromole' | 'micromole-per-hour';
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
  readonly standardErrors: Readonly<Record<string, number>> | null;
  readonly covarianceMatrix: readonly (readonly number[])[] | null;
  readonly correlationMatrix: Readonly<Record<string, Readonly<Record<string, number>>>> | null;
  readonly identifiableParameterCount: number;
  readonly locallyIdentifiable: boolean;
  readonly informationConditionNumber: number;
  readonly warnings: readonly string[];
}
interface PreparedSeries extends QinExperimentSeries {
  readonly weights: readonly (number | null)[];
}
const finite = Number.isFinite;
function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}
function solve(matrix: number[][], vector: readonly number[]): number[] | null {
  const n = vector.length, a = matrix.map((row, i) => [...row, vector[i]]);
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
function basis(model: QinAlternativeModel, t: number, p: { k1: number; k2: number; ratio: number }): number {
  const e1 = -Math.expm1(-p.k1 * t);
  if (model === '1') return e1;
  if (model === '2') return t + (p.ratio - 1) * e1 / p.k1;
  const e2 = -Math.expm1(-p.k2 * t);
  let phaseTwoIntegral: number;
  if (Math.abs(p.k2 - p.k1) <= 1e-7 * Math.max(p.k1, p.k2)) {
    phaseTwoIntegral = (1 - Math.exp(-p.k1 * t) * (1 + p.k1 * t)) / p.k1;
  } else {
    phaseTwoIntegral = p.k1 / (p.k2 - p.k1) * (e1 / p.k1 - e2 / p.k2);
  }
  return p.ratio * e1 / p.k1 + phaseTwoIntegral;
}

/** Fit the first three published Qin models with iron-type global rates and local scale terms. */
export function fitQinAlternativeModel(
  model: QinAlternativeModel,
  series: readonly QinExperimentSeries[],
  options: QinModel4Options,
): QinAlternativeFit {
  if (!['1', '2', '3'].includes(model)) throw new QinModel4FitError('Model must be 1, 2 or 3.');
  if (!series.length || new Set(series.map(s => s.experimentId)).size !== series.length)
    throw new QinModel4FitError('Provide non-empty series with unique experiment ids.');
  if (options.weighting !== 'unweighted' && options.weighting !== 'standard-deviation')
    throw new QinModel4FitError('Choose an explicit weighting mode.');
  const prepared: PreparedSeries[] = series.map(s => {
    if (!s.experimentId.trim() || !s.label.trim() || !s.observations.length)
      throw new QinModel4FitError('Each experiment requires an id, label and observations.');
    const weights = s.observations.map(o => {
      if (!finite(o.timeHours) || o.timeHours < 0 || !finite(o.hydrogenMicromoles) ||
          !finite(o.standardDeviationMicromoles) || o.standardDeviationMicromoles < 0)
        throw new QinModel4FitError('Observations require finite non-negative time and SD, and finite H2 values.');
      if (options.weighting === 'unweighted') return 1;
      if (o.standardDeviationMicromoles === 0) {
        if (options.zeroStandardDeviation === 'error') throw new QinModel4FitError('Zero SD encountered under the error policy.');
        if (options.zeroStandardDeviation === 'exclude') return null;
        return 1;
      }
      return 1 / o.standardDeviationMicromoles ** 2;
    });
    if (!weights.some(w => w !== null)) throw new QinModel4FitError('Every point in an experiment was excluded.');
    return { ...s, weights };
  });
  const types = [...new Set(series.map(s => s.ironType))];
  const keys = types.flatMap(type => model === '1' ? [type + ':k1'] :
    model === '2' ? [type + ':k1', type + ':ratio'] :
      [type + ':k1', type + ':k2', type + ':ratio']);
  const initial = keys.map(key => {
    const [type, name] = key.split(':') as [QinIronType, string];
    const defaults = options.initialRatesByIronType?.[type] ?? { k1PerHour: 0.4, k2PerHour: 0.008 };
    if (name === 'k1') return Math.log(defaults.k1PerHour);
    if (name === 'k2') return Math.log(defaults.k2PerHour);
    return Math.log(options.initialRatiosByIronType?.[type] ?? 10);
  });
  if (initial.some(v => !finite(v))) throw new QinModel4FitError('Initial rates must be finite.');
  const decode = (theta: readonly number[], type: QinIronType) => {
    const k1 = Math.exp(theta[keys.indexOf(type + ':k1')]);
    const k2 = model === '3' ? Math.exp(theta[keys.indexOf(type + ':k2')]) : 0;
    const ratio = model === '1' ? 1 : Math.exp(theta[keys.indexOf(type + ':ratio')]);
    return { k1, k2, ratio };
  };
  const project = (point: number[]) => {
    if (model === '3') for (const type of types) {
      const i1 = keys.indexOf(type + ':k1'), i2 = keys.indexOf(type + ':k2');
      point[i2] = Math.min(point[i2], point[i1] - 1e-5);
    }
    return point;
  };
  const evaluate = (theta: readonly number[]) => {
    const scales: Record<string, number> = {}, residuals: number[] = [];
    let cost = 0;
    for (const s of prepared) {
      const p = decode(theta, s.ironType);
      const x = s.observations.map(o => basis(model, o.timeHours, p));
      let numerator = 0, denominator = 0;
      s.observations.forEach((o, i) => {
        const w = s.weights[i] ?? 0;
        numerator += w * x[i] * o.hydrogenMicromoles;
        denominator += w * x[i] * x[i];
      });
      const scale = denominator > 0 ? Math.max(0, numerator / denominator) : 0;
      scales[s.experimentId] = scale;
      s.observations.forEach((o, i) => {
        const w = s.weights[i];
        if (w === null) return;
        const r = (o.hydrogenMicromoles - scale * x[i]) * Math.sqrt(w);
        residuals.push(r); cost += r * r;
      });
    }
    return { scales, residuals, cost };
  };
  const maxIterations = options.maxIterations ?? 300, tolerance = options.tolerance ?? 1e-9;
  if (!Number.isSafeInteger(maxIterations) || maxIterations < 1 || !finite(tolerance) || tolerance <= 0)
    throw new QinModel4FitError('Invalid optimizer controls.');
  let theta = project([...initial]), current = evaluate(theta), lambda = 1e-3;
  let converged = false, iterations = 0;
  for (; iterations < maxIterations; iterations++) {
    const columns = theta.map((value, j) => {
      const h = 1e-4, plus = [...theta], minus = [...theta];
      plus[j] += h; minus[j] -= h; project(plus); project(minus);
      const rp = evaluate(plus).residuals, rm = evaluate(minus).residuals;
      return rp.map((v, i) => (v - rm[i]) / (plus[j] - minus[j]));
    });
    const jacobian = current.residuals.map((_, i) => columns.map(c => c[i]));
    const n = theta.length;
    const normal = Array.from({ length: n }, (_, a) =>
      Array.from({ length: n }, (_, b) => jacobian.reduce((sum, row) => sum + row[a] * row[b], 0)));
    const gradient = Array.from({ length: n }, (_, a) =>
      jacobian.reduce((sum, row, i) => sum + row[a] * current.residuals[i], 0));
    const damped = normal.map((row, i) => row.map((v, k) => v + (i === k ? lambda * Math.max(normal[i][i], 1e-10) : 0)));
    const delta = solve(damped, gradient.map(v => -v));
    if (!delta) break;
    const candidate = project(theta.map((v, i) => Math.max(Math.log(1e-8), Math.min(Math.log(1e5), v + delta[i]))));
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
  const rateParametersByIronType: Record<string, { k1PerHour: number; k2PerHour?: number; ratio?: number }> = {};
  for (const type of types) {
    const p = decode(theta, type);
    rateParametersByIronType[type] = {
      k1PerHour: p.k1, ...(model === '3' ? { k2PerHour: p.k2 } : {}),
      ...(model !== '1' ? { ratio: p.ratio } : {}),
    };
  }
  const fitted = prepared.flatMap(s => {
    const p = decode(theta, s.ironType), scale = current.scales[s.experimentId];
    return s.observations.map((o, i) => {
      const predictedMicromoles = scale * basis(model, o.timeHours, p);
      return {
        experimentId: s.experimentId, label: s.label, ironType: s.ironType,
        timeHours: o.timeHours, observedMicromoles: o.hydrogenMicromoles,
        predictedMicromoles, residualMicromoles: o.hydrogenMicromoles - predictedMicromoles,
        includedInObjective: s.weights[i] !== null,
      };
    });
  });
  const includedObservationCount = prepared.reduce((n, s) => n + s.weights.filter(w => w !== null).length, 0);
  const excludedZeroStandardDeviationCount = prepared.reduce((n, s) => n + s.weights.filter(w => w === null).length, 0);
  const parameterCount = keys.length + series.length, degreesOfFreedom = includedObservationCount - parameterCount;
  const weightedResidualSumSquares = options.weighting === 'standard-deviation' ? current.cost : null;
  const sumSquaredResiduals = fitted.reduce((sum, o) => sum + o.residualMicromoles ** 2, 0);
  const parameterNames = [
    ...keys.map(key => key.replace(':', '.').replace('k1', 'k1PerHour').replace('k2', 'k2PerHour')),
    ...series.map(s => s.experimentId + '.localScale'),
  ];
  const parameterValues = [
    ...theta.map(Math.exp),
    ...series.map(s => current.scales[s.experimentId]),
  ];
  const residualAt = (values: readonly number[]) => {
    const result: number[] = [];
    prepared.forEach((s, seriesIndex) => {
      const get = (name: string) => values[keys.indexOf(s.ironType + ':' + name)];
      const p = {
        k1: get('k1'),
        k2: model === '3' ? get('k2') : 0,
        ratio: model === '1' ? 1 : get('ratio'),
      };
      const scale = values[keys.length + seriesIndex];
      s.observations.forEach((o, i) => {
        const w = s.weights[i];
        if (w === null) return;
        result.push((o.hydrogenMicromoles - scale * basis(model, o.timeHours, p)) * Math.sqrt(w));
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
  if (!converged) warnings.push('Optimizer stopped without satisfying the convergence criterion.');
  const boundaryParameters = keys.filter((_, i) => theta[i] <= Math.log(1e-8) + 1e-6 || theta[i] >= Math.log(1e5) - 1e-6);
  if (boundaryParameters.length) warnings.push('Global parameters reached optimizer bounds: ' + boundaryParameters.join(', ') + '; treat these as boundary-limited, not precise point estimates.');
  if (degreesOfFreedom <= 0) warnings.push('Non-positive degrees of freedom; uncertainty statistics are not defined.');
  if (statistics) warnings.push(...statistics.warnings);
  if (excludedZeroStandardDeviationCount) warnings.push(excludedZeroStandardDeviationCount + ' zero-SD observations excluded by explicit policy.');
  return {
    model, equation: model === '1'
      ? 'A*(1-exp(-k*t))'
      : model === '2'
        ? 'C*(t+(ratio-1)*(1-exp(-k*t))/k)'
        : 'C*(ratio*(1-exp(-k1*t))/k1 + phase2Integral(k1,k2,t))',
    rateParametersByIronType, localScaleParameters: current.scales,
    localScaleUnit: model === '1' ? 'micromole' : 'micromole-per-hour',
    fitted, weighting: options.weighting, zeroStandardDeviationPolicy: options.zeroStandardDeviation,
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
