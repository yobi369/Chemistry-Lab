import { SimulationInputError } from './gillespie';

export interface KineticStoichiometricTerm {
  readonly speciesId: string;
  readonly coefficient: number;
}
export interface KineticMechanismReaction {
  readonly id: string;
  readonly reactants: readonly KineticStoichiometricTerm[];
  readonly products: readonly KineticStoichiometricTerm[];
}
export interface KineticMechanism {
  readonly speciesIds: readonly string[];
  readonly reactions: readonly KineticMechanismReaction[];
  /** Fixed initial concentrations, one value per species, in a consistent concentration unit. */
  readonly initialConcentrations: Readonly<Record<string, number>>;
}
export interface KineticParameterBound {
  readonly reactionId: string;
  readonly initialGuess: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  /** k units are concentration^(1-overall-reactant-order) / second. */
  readonly units: string;
}
export interface MechanismObservation {
  readonly timeSeconds: number;
  readonly speciesId: string;
  readonly value: number;
  /** Optional measurement SD in the same concentration unit as value. */
  readonly standardDeviation?: number;
}
export interface NonlinearFitOptions {
  readonly maxIntegrationStepSeconds?: number;
  readonly maxIterations?: number;
  readonly convergenceTolerance?: number;
}
export interface NonlinearKineticFit {
  readonly model: 'mass-action-mechanism-rk4-levenberg-marquardt';
  readonly parameterEstimates: Readonly<Record<string, number>>;
  readonly standardErrors: Readonly<Record<string, number>> | null;
  readonly correlationMatrix: Readonly<Record<string, Readonly<Record<string, number>>>> | null;
  readonly covarianceMatrix: readonly (readonly number[])[] | null;
  readonly identifiableParameterCount: number;
  readonly parameterCount: number;
  readonly locallyIdentifiable: boolean;
  /** Approximate condition number of the weighted sensitivity information matrix. */
  readonly informationConditionNumber: number;
  readonly weightedResidualSumSquares: number;
  readonly degreesOfFreedom: number;
  readonly iterations: number;
  readonly converged: boolean;
  readonly fitted: readonly { timeSeconds: number; speciesId: string; observed: number; predicted: number; residual: number }[];
  readonly warnings: readonly string[];
}

type Matrix = number[][];
const finite = (x: number) => Number.isFinite(x);
function solveLinearSystem(matrix: Matrix, vector: readonly number[]): number[] | null {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-14) return null;
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
function invertMatrix(matrix: Matrix): Matrix | null {
  const n = matrix.length;
  const inverse = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
  const a = matrix.map(row => [...row]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [inverse[col], inverse[pivot]] = [inverse[pivot], inverse[col]];
    const divisor = a[col][col];
    for (let j = 0; j < n; j++) { a[col][j] /= divisor; inverse[col][j] /= divisor; }
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = 0; j < n; j++) { a[row][j] -= factor * a[col][j]; inverse[row][j] -= factor * inverse[col][j]; }
    }
  }
  return inverse;
}
function informationEigenCondition(matrix: Matrix): number {
  const n = matrix.length;
  const a = matrix.map(row => [...row]);
  for (let sweep = 0; sweep < 50 * n * n; sweep++) {
    let p = 0, q = 0, largest = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (Math.abs(a[i][j]) > largest) { largest = Math.abs(a[i][j]); p = i; q = j; }
    }
    if (largest < 1e-12) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
    const c = Math.cos(angle), s = Math.sin(angle);
    const app = c*c*a[p][p] - 2*s*c*a[p][q] + s*s*a[q][q];
    const aqq = s*s*a[p][p] + 2*s*c*a[p][q] + c*c*a[q][q];
    for (let k = 0; k < n; k++) {
      if (k === p || k === q) continue;
      const akp = c*a[k][p] - s*a[k][q];
      const akq = s*a[k][p] + c*a[k][q];
      a[k][p] = a[p][k] = akp;
      a[k][q] = a[q][k] = akq;
    }
    a[p][p] = app; a[q][q] = aqq; a[p][q] = a[q][p] = 0;
  }
  const eigen = a.map((row, i) => row[i]);
  const max = Math.max(...eigen), min = Math.min(...eigen);
  return min <= max * 1e-14 || min <= 0 ? Number.POSITIVE_INFINITY : max / min;
}
function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, value, i) => sum + value * b[i], 0);
}
function integrate(
  mechanism: KineticMechanism,
  rateConstants: readonly number[],
  requestedTimes: readonly number[],
  maxStep: number,
): Map<number, number[]> {
  const ids = mechanism.speciesIds;
  const index = new Map(ids.map((id, i) => [id, i]));
  const stoich = mechanism.reactions.map(reaction => ids.map(id =>
    (reaction.products.find(term => term.speciesId === id)?.coefficient ?? 0) -
    (reaction.reactants.find(term => term.speciesId === id)?.coefficient ?? 0)));
  const reactants = mechanism.reactions.map(reaction => reaction.reactants.map(term => ({
    index: index.get(term.speciesId)!, coefficient: term.coefficient,
  })));
  const derivative = (y: readonly number[]) => {
    const dy = ids.map(() => 0);
    for (let r = 0; r < mechanism.reactions.length; r++) {
      let rate = rateConstants[r];
      for (const term of reactants[r]) rate *= y[term.index] ** term.coefficient;
      for (let i = 0; i < ids.length; i++) dy[i] += stoich[r][i] * rate;
    }
    return dy;
  };
  const add = (y: readonly number[], k: readonly number[], scale: number) => y.map((v, i) => v + scale*k[i]);
  const y = ids.map(id => mechanism.initialConcentrations[id]);
  const result = new Map<number, number[]>();
  let time = 0;
  for (const target of requestedTimes) {
    if (target === 0) { result.set(target, [...y]); continue; }
    const count = Math.ceil((target - time) / maxStep);
    if (count > 200_000) throw new SimulationInputError('Integration requires more than 200,000 RK4 steps; increase maxIntegrationStepSeconds.');
    const h = (target - time) / count;
    for (let step = 0; step < count; step++) {
      const k1 = derivative(y);
      const k2 = derivative(add(y, k1, h/2));
      const k3 = derivative(add(y, k2, h/2));
      const k4 = derivative(add(y, k3, h));
      for (let i = 0; i < y.length; i++) y[i] += h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6;
      if (y.some(value => !finite(value) || value < -1e-9)) {
        throw new SimulationInputError('ODE integration became non-finite or negative. Reduce the integration step or inspect the mechanism.');
      }
      for (let i = 0; i < y.length; i++) if (y[i] < 0) y[i] = 0;
    }
    time = target;
    result.set(target, [...y]);
  }
  return result;
}


/** Simulate a fixed-parameter mechanism at requested times (same deterministic RK4 core as the fitter). */
export function simulateMassActionMechanism(
  mechanism: KineticMechanism,
  rateConstantsPerSecond: Readonly<Record<string, number>>,
  requestedTimesSeconds: readonly number[],
  maxIntegrationStepSeconds = 0.01,
): readonly { timeSeconds: number; concentrations: Readonly<Record<string, number>> }[] {
  if (!mechanism.speciesIds.length || new Set(mechanism.speciesIds).size !== mechanism.speciesIds.length ||
      !mechanism.reactions.length || new Set(mechanism.reactions.map(r => r.id)).size !== mechanism.reactions.length) {
    throw new SimulationInputError('Mechanism must contain unique species and reaction ids.');
  }
  const ids = new Set(mechanism.speciesIds);
  for (const id of ids) {
    if (!finite(mechanism.initialConcentrations[id]) || mechanism.initialConcentrations[id] < 0) {
      throw new SimulationInputError(`Initial concentration for "${id}" must be finite and non-negative.`);
    }
  }
  for (const reaction of mechanism.reactions) {
    if (!reaction.reactants.length || !reaction.products.length ||
        [...reaction.reactants, ...reaction.products].some(term =>
          !ids.has(term.speciesId) || !Number.isSafeInteger(term.coefficient) || term.coefficient < 1)) {
      throw new SimulationInputError(`Reaction "${reaction.id}" has invalid stoichiometry.`);
    }
    if (!finite(rateConstantsPerSecond[reaction.id]) || rateConstantsPerSecond[reaction.id] < 0) {
      throw new SimulationInputError(`Rate constant for "${reaction.id}" must be finite and non-negative.`);
    }
  }
  if (!requestedTimesSeconds.length || requestedTimesSeconds.some(t => !finite(t) || t < 0) ||
      !finite(maxIntegrationStepSeconds) || maxIntegrationStepSeconds <= 0) {
    throw new SimulationInputError('Requested times and maximum integration step must be valid and non-negative/positive.');
  }
  const times = [...new Set(requestedTimesSeconds)].sort((a,b)=>a-b);
  const rates = mechanism.reactions.map(reaction => rateConstantsPerSecond[reaction.id]);
  const states = integrate(mechanism,rates,times,maxIntegrationStepSeconds);
  return requestedTimesSeconds.map(timeSeconds => ({
    timeSeconds,
    concentrations: Object.fromEntries(mechanism.speciesIds.map((id,index)=>[id,states.get(timeSeconds)![index]])),
  }));
}

/**
 * Fit bounded macroscopic mass-action rate constants to multi-species time-series.
 * The deterministic model is integrated by fixed-step classical RK4 and optimized
 * with bounded Levenberg-Marquardt. Covariance is local/linearized at the optimum.
 */
export function fitMassActionMechanism(
  mechanism: KineticMechanism,
  parameters: readonly KineticParameterBound[],
  observations: readonly MechanismObservation[],
  options: NonlinearFitOptions = {},
): NonlinearKineticFit {
  const ids = new Set(mechanism.speciesIds), reactionIds = new Set(mechanism.reactions.map(r => r.id));
  if (!mechanism.speciesIds.length || new Set(mechanism.speciesIds).size !== mechanism.speciesIds.length ||
      !mechanism.reactions.length || new Set(mechanism.reactions.map(r => r.id)).size !== mechanism.reactions.length) {
    throw new SimulationInputError('Mechanism must contain unique species and reaction ids.');
  }
  if (parameters.length !== mechanism.reactions.length || new Set(parameters.map(p => p.reactionId)).size !== parameters.length ||
      parameters.some(p => !reactionIds.has(p.reactionId))) {
    throw new SimulationInputError('Provide exactly one unique kinetic parameter for every mechanism reaction.');
  }
  for (const id of ids) {
    const value = mechanism.initialConcentrations[id];
    if (!finite(value) || value < 0) throw new SimulationInputError(`Initial concentration for "${id}" must be finite and non-negative.`);
  }
  for (const reaction of mechanism.reactions) {
    if (!reaction.reactants.length || !reaction.products.length ||
        [...reaction.reactants, ...reaction.products].some(term =>
          !ids.has(term.speciesId) || !Number.isSafeInteger(term.coefficient) || term.coefficient < 1)) {
      throw new SimulationInputError(`Reaction "${reaction.id}" has invalid stoichiometry.`);
    }
  }
  for (const p of parameters) {
    if (!finite(p.initialGuess) || !finite(p.lowerBound) || !finite(p.upperBound) ||
        p.lowerBound < 0 || p.upperBound <= p.lowerBound ||
        p.initialGuess < p.lowerBound || p.initialGuess > p.upperBound || !p.units.trim()) {
      throw new SimulationInputError(`Parameter "${p.reactionId}" requires finite ordered non-negative bounds, an in-bounds initial guess and units.`);
    }
  }
  if (observations.length <= parameters.length) throw new SimulationInputError('More observations than fitted parameters are required to estimate residual uncertainty.');
  for (const [i, obs] of observations.entries()) {
    if (!ids.has(obs.speciesId) || !finite(obs.timeSeconds) || obs.timeSeconds < 0 ||
        !finite(obs.value) || obs.value < 0 ||
        (obs.standardDeviation !== undefined && (!finite(obs.standardDeviation) || obs.standardDeviation <= 0))) {
      throw new SimulationInputError(`Observation ${i+1} has invalid species, time, value or standard deviation.`);
    }
  }
  const hasSd = observations.some(o => o.standardDeviation !== undefined);
  if (hasSd && observations.some(o => o.standardDeviation === undefined)) {
    throw new SimulationInputError('Supply standard deviations for all observations or none.');
  }
  const maxStep = options.maxIntegrationStepSeconds ?? 0.01;
  const maxIterations = options.maxIterations ?? 200;
  const tolerance = options.convergenceTolerance ?? 1e-8;
  if (!finite(maxStep) || maxStep <= 0 || !Number.isSafeInteger(maxIterations) || maxIterations < 1 ||
      !finite(tolerance) || tolerance <= 0) throw new SimulationInputError('Nonlinear fit options are invalid.');

  const sortedTimes = [...new Set(observations.map(o => o.timeSeconds))].sort((a,b) => a-b);
  const parameterOrder = parameters.map(p => p.reactionId);
  const orderedParameters = parameterOrder.map(id => parameters.find(p => p.reactionId === id)!);
  const weights = observations.map(o => hasSd ? 1 / o.standardDeviation! : 1);
  const predict = (theta: readonly number[]) => {
    const rates = mechanism.reactions.map(r => theta[parameterOrder.indexOf(r.id)]);
    const states = integrate(mechanism, rates, sortedTimes, maxStep);
    return observations.map(o => states.get(o.timeSeconds)![mechanism.speciesIds.indexOf(o.speciesId)]);
  };
  const residual = (theta: readonly number[]) => predict(theta).map((value, i) => (value - observations[i].value) * weights[i]);
  const objective = (r: readonly number[]) => dot(r, r);
  let theta = orderedParameters.map(p => p.initialGuess);
  let current = residual(theta), cost = objective(current), lambda = 1e-3, converged = false, iterations = 0;
  const jacobianAt = (point: readonly number[]) => {
    const base = residual(point);
    return point.map((value, j) => {
      const step = Math.max(Math.abs(value)*1e-5, 1e-8);
      const plus = [...point], minus = [...point];
      plus[j] = Math.min(orderedParameters[j].upperBound, value+step);
      minus[j] = Math.max(orderedParameters[j].lowerBound, value-step);
      if (plus[j] === minus[j]) return base.map(() => 0);
      const rp = residual(plus), rm = residual(minus), width = plus[j]-minus[j];
      return rp.map((v, i) => (v-rm[i])/width);
    }).reduce((rows, column, j) => {
      for (let i = 0; i < column.length; i++) rows[i][j] = column[i];
      return rows;
    }, Array.from({length: base.length}, () => Array(point.length).fill(0)));
  };
  for (; iterations < maxIterations; iterations++) {
    const j = jacobianAt(theta), n = theta.length;
    const normal = Array.from({length:n},(_,a)=>Array.from({length:n},(_,b)=>
      j.reduce((sum,row,i)=>sum+row[a]*row[b],0)));
    const gradient = Array.from({length:n},(_,a)=>j.reduce((sum,row,i)=>sum+row[a]*current[i],0));
    const damped = normal.map((row,i)=>row.map((value,k)=>value+(i===k?lambda*Math.max(normal[i][i],1e-12):0)));
    const delta = solveLinearSystem(damped, gradient.map(v=>-v));
    if (!delta) break;
    const candidate = theta.map((v,i)=>Math.max(orderedParameters[i].lowerBound,
      Math.min(orderedParameters[i].upperBound,v+delta[i])));
    const candidateResidual = residual(candidate), candidateCost = objective(candidateResidual);
    if (candidateCost < cost) {
      const improvement = cost-candidateCost;
      theta = candidate; current = candidateResidual; cost = candidateCost; lambda = Math.max(lambda/3,1e-12);
      if (improvement <= tolerance*Math.max(1,cost) ||
          Math.max(...delta.map((v,i)=>Math.abs(v)/Math.max(1,Math.abs(theta[i])))) <= tolerance) {
        converged = true; iterations++; break;
      }
    } else {
      lambda = Math.min(lambda*10,1e16);
      if (lambda >= 1e16) break;
    }
  }
  const finalJ = jacobianAt(theta), n = theta.length, m = observations.length;
  const information = scaledSensitivityInformation(finalJ);
  const inverseNormalized = information.rank === n
    ? invertMatrix(information.normalizedInformation) : null;
  const dof = m-n;
  const scale = hasSd ? 1 : cost/dof;
  const covariance = inverseNormalized && dof > 0
    ? inverseNormalized.map((row,i)=>row.map((value,j)=>
        value*scale/(information.columnNorms[i]*information.columnNorms[j]))) : null;
  const standardErrors = covariance ? Object.fromEntries(parameterOrder.map((id,i)=>[id,Math.sqrt(Math.max(0,covariance[i][i]))])) : null;
  const correlations = covariance ? Object.fromEntries(parameterOrder.map((id,i)=>[id,
    Object.fromEntries(parameterOrder.map((other,j)=>[other,
      covariance[i][i] > 0 && covariance[j][j] > 0 ? covariance[i][j]/Math.sqrt(covariance[i][i]*covariance[j][j]) : Number.NaN]))])) : null;
  const condition = information.conditionNumber;
  const locallyIdentifiable = information.rank === n && condition <= 1e10;
  const warnings: string[] = [];
  if (!converged) warnings.push('Optimizer did not meet the convergence criterion; inspect residuals and initial guesses.');
  if (information.rank < n) warnings.push(`Sensitivity Jacobian rank ${information.rank} of ${n}; some parameters are locally unidentifiable and covariance is unavailable.`);
  if (information.rank === n && !inverseNormalized) warnings.push('Scaled sensitivity information matrix could not be stably inverted; parameter uncertainties and correlations are unavailable.');
  if (condition > 1e10) warnings.push('Large scaled information-matrix condition number indicates practical parameter non-identifiability.');
  if (!hasSd) warnings.push('No measurement SDs supplied: covariance is scaled by residual variance and assumes independent, homoscedastic errors.');
  if (hasSd) warnings.push('Supplied SDs are treated as known independent measurement standard deviations; correlated observation errors are not modelled.');
  if (orderedParameters.some((p,i)=>theta[i] <= p.lowerBound+1e-8*Math.max(1,p.upperBound-p.lowerBound) ||
      theta[i] >= p.upperBound-1e-8*Math.max(1,p.upperBound-p.lowerBound))) warnings.push('At least one estimate is at a parameter bound; local symmetric covariance intervals may be misleading.');
  const fittedValues = predict(theta);
  return {
    model:'mass-action-mechanism-rk4-levenberg-marquardt',
    parameterEstimates:Object.fromEntries(parameterOrder.map((id,i)=>[id,theta[i]])),
    standardErrors, correlationMatrix:correlations, covarianceMatrix:covariance,
    identifiableParameterCount:information.rank, parameterCount:n, locallyIdentifiable,
    informationConditionNumber:condition, weightedResidualSumSquares:cost, degreesOfFreedom:dof,
    iterations, converged,
    fitted:observations.map((o,i)=>({timeSeconds:o.timeSeconds,speciesId:o.speciesId,observed:o.value,predicted:fittedValues[i],residual:o.value-fittedValues[i]})),
    warnings,
  };
}
