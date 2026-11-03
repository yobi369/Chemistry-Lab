import { SimulationInputError } from './gillespie';
import type { KineticMechanism } from './nonlinearKineticFitting';

export interface AdaptiveImplicitOptions {
  readonly relativeTolerance?: number;
  readonly absoluteTolerance?: number;
  readonly initialStepSeconds?: number;
  readonly minimumStepSeconds?: number;
  readonly maximumStepSeconds?: number;
  readonly maximumSteps?: number;
  readonly maximumNewtonIterations?: number;
}

export interface AdaptiveImplicitSimulationResult {
  readonly timeSeconds: number;
  readonly concentrations: Readonly<Record<string, number>>;
}

export interface AdaptiveImplicitSimulation {
  readonly results: readonly AdaptiveImplicitSimulationResult[];
  readonly acceptedSteps: number;
  readonly rejectedSteps: number;
  readonly newtonIterations: number;
  readonly functionEvaluations: number;
  readonly relativeTolerance: number;
  readonly absoluteTolerance: number;
}

type Vector = number[];
type Matrix = number[][];

function solveLinearSystem(matrix: Matrix, rhs: readonly number[]): Vector | null {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
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

function maxNorm(values: readonly number[]): number {
  return values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
}

/**
 * Adaptive, L-stable backward-Euler integration with step-doubling error control.
 * This deliberately conservative implicit method is intended for stiff
 * well-mixed mass-action systems; it is not a variable-order BDF implementation.
 */
export function simulateMassActionMechanismAdaptiveImplicit(
  mechanism: KineticMechanism,
  rateConstantsPerSecond: Readonly<Record<string, number>>,
  requestedTimesSeconds: readonly number[],
  options: AdaptiveImplicitOptions = {},
): AdaptiveImplicitSimulation {
  const species = mechanism.speciesIds;
  const reactions = mechanism.reactions;
  const speciesSet = new Set(species);
  if (!species.length || speciesSet.size !== species.length ||
      !reactions.length || new Set(reactions.map(reaction => reaction.id)).size !== reactions.length) {
    throw new SimulationInputError('Mechanism must contain unique species and reaction ids.');
  }
  for (const id of species) {
    const initial = mechanism.initialConcentrations[id];
    if (!Number.isFinite(initial) || initial < 0) {
      throw new SimulationInputError(`Initial concentration for "${id}" must be finite and non-negative.`);
    }
  }
  for (const reaction of reactions) {
    if (!reaction.reactants.length || !reaction.products.length ||
        [...reaction.reactants, ...reaction.products].some(term =>
          !speciesSet.has(term.speciesId) || !Number.isSafeInteger(term.coefficient) || term.coefficient < 1)) {
      throw new SimulationInputError(`Reaction "${reaction.id}" has invalid stoichiometry.`);
    }
    if (!Number.isFinite(rateConstantsPerSecond[reaction.id]) || rateConstantsPerSecond[reaction.id] < 0) {
      throw new SimulationInputError(`Rate constant for "${reaction.id}" must be finite and non-negative.`);
    }
  }
  if (!requestedTimesSeconds.length || requestedTimesSeconds.some(time => !Number.isFinite(time) || time < 0)) {
    throw new SimulationInputError('At least one finite non-negative requested time is required.');
  }

  const rtol = options.relativeTolerance ?? 1e-6;
  const atol = options.absoluteTolerance ?? 1e-12;
  const maxNewton = options.maximumNewtonIterations ?? 12;
  const maxSteps = options.maximumSteps ?? 500_000;
  const maxTime = Math.max(...requestedTimesSeconds);
  const maxStep = options.maximumStepSeconds ?? Math.max(maxTime / 10, 1e-6);
  const minStep = options.minimumStepSeconds ?? 1e-14;
  if (![rtol, atol, maxStep, minStep].every(Number.isFinite) || rtol <= 0 || atol <= 0 ||
      maxStep <= 0 || minStep <= 0 || minStep > maxStep ||
      !Number.isSafeInteger(maxNewton) || maxNewton < 2 ||
      !Number.isSafeInteger(maxSteps) || maxSteps < 1) {
    throw new SimulationInputError('Adaptive implicit solver tolerances and step limits are invalid.');
  }

  const index = new Map(species.map((id, i) => [id, i]));
  const stoichiometry = reactions.map(reaction => species.map(id =>
    (reaction.products.find(term => term.speciesId === id)?.coefficient ?? 0) -
    (reaction.reactants.find(term => term.speciesId === id)?.coefficient ?? 0)));
  const reactants = reactions.map(reaction => reaction.reactants.map(term => ({
    index: index.get(term.speciesId)!, coefficient: term.coefficient,
  })));
  const rates = reactions.map(reaction => rateConstantsPerSecond[reaction.id]);
  let functionEvaluations = 0;
  const derivative = (state: readonly number[]): Vector => {
    functionEvaluations++;
    const dy = species.map(() => 0);
    for (let r = 0; r < reactions.length; r++) {
      let rate = rates[r];
      for (const term of reactants[r]) rate *= state[term.index] ** term.coefficient;
      for (let i = 0; i < dy.length; i++) dy[i] += stoichiometry[r][i] * rate;
    }
    return dy;
  };

  let newtonIterations = 0;
  const backwardEuler = (previous: readonly number[], step: number): Vector | null => {
    let state = [...previous];
    const residual = (candidate: readonly number[]) => {
      const f = derivative(candidate);
      return candidate.map((value, i) => value - previous[i] - step * f[i]);
    };
    const scaledNorm = (residualValues: readonly number[], candidate: readonly number[]) =>
      Math.max(...residualValues.map((value, i) =>
        Math.abs(value) / (atol + rtol * Math.max(Math.abs(previous[i]), Math.abs(candidate[i])))));
    for (let iteration = 0; iteration < maxNewton; iteration++) {
      newtonIterations++;
      const g = residual(state);
      const norm = scaledNorm(g, state);
      if (norm <= 0.03) return state;
      const fBase = derivative(state);
      const jacobian = Array.from({ length: state.length }, (_, row) =>
        Array.from({ length: state.length }, (_, column) => row === column ? 1 : 0));
      for (let column = 0; column < state.length; column++) {
        const delta = Math.max(Math.abs(state[column]) * 1e-6, atol * 0.1, 1e-12);
        const perturbed = [...state];
        perturbed[column] += delta;
        const fPerturbed = derivative(perturbed);
        for (let row = 0; row < state.length; row++) {
          jacobian[row][column] -= step * (fPerturbed[row] - fBase[row]) / delta;
        }
      }
      const correction = solveLinearSystem(jacobian, g.map(value => -value));
      if (!correction) return null;
      let accepted = false;
      for (let damping = 1; damping >= 1 / 128; damping /= 2) {
        const candidate = state.map((value, i) => value + damping * correction[i]);
        if (candidate.some(value => !Number.isFinite(value) || value < -atol)) continue;
        for (let i = 0; i < candidate.length; i++) if (candidate[i] < 0) candidate[i] = 0;
        const candidateNorm = scaledNorm(residual(candidate), candidate);
        if (candidateNorm < norm) {
          state = candidate;
          accepted = true;
          break;
        }
      }
      if (!accepted) return null;
    }
    return null;
  };

  const times = [...new Set(requestedTimesSeconds)].sort((a, b) => a - b);
  const initial = species.map(id => mechanism.initialConcentrations[id]);
  const states = new Map<number, Vector>();
  let state = [...initial], time = 0, acceptedSteps = 0, rejectedSteps = 0;
  const firstPositiveTime = times.find(value => value > 0) ?? 1;
  let step = Math.min(options.initialStepSeconds ?? firstPositiveTime / 10, maxStep);
  if (!Number.isFinite(step) || step <= 0) throw new SimulationInputError('Initial step must be finite and positive.');
  for (const target of times) {
    if (target === 0) {
      states.set(0, [...state]);
      continue;
    }
    while (time < target) {
      if (acceptedSteps + rejectedSteps >= maxSteps) {
        throw new SimulationInputError(`Adaptive implicit solver exceeded ${maxSteps} attempted steps.`);
      }
      const h = Math.min(step, maxStep, target - time);
      if (h < minStep || time + h === time) {
        throw new SimulationInputError('Adaptive implicit solver reached the minimum step without satisfying the error tolerance.');
      }
      const full = backwardEuler(state, h);
      const half = backwardEuler(state, h / 2);
      const twoHalf = half ? backwardEuler(half, h / 2) : null;
      if (!full || !twoHalf) {
        rejectedSteps++;
        step = h * 0.25;
        continue;
      }
      const error = Math.max(...twoHalf.map((value, i) =>
        Math.abs(value - full[i]) / (atol + rtol * Math.max(Math.abs(state[i]), Math.abs(value)))));
      if (Number.isFinite(error) && error <= 1) {
        state = twoHalf;
        time += h;
        acceptedSteps++;
        const factor = error <= 1e-12 ? 2 : Math.min(2, Math.max(0.25, 0.9 / Math.sqrt(error)));
        step = Math.min(maxStep, h * factor);
      } else {
        rejectedSteps++;
        const factor = Number.isFinite(error) && error > 0
          ? Math.max(0.1, Math.min(0.5, 0.8 / Math.sqrt(error)))
          : 0.1;
        step = h * factor;
      }
    }
    states.set(target, [...state]);
  }

  return {
    results: requestedTimesSeconds.map(timeSeconds => ({
      timeSeconds,
      concentrations: Object.fromEntries(species.map((id, i) => [id, states.get(timeSeconds)![i]])),
    })),
    acceptedSteps,
    rejectedSteps,
    newtonIterations,
    functionEvaluations,
    relativeTolerance: rtol,
    absoluteTolerance: atol,
  };
}
