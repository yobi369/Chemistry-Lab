import { SimulationInputError } from './gillespie';

export interface DiffusionSpecies {
  readonly id: string;
  /** Molecular diffusion coefficient in m^2 s^-1. */
  readonly diffusionCoefficientM2PerS: number;
  /** Initial concentration in mol m^-3, one value per finite-volume cell. */
  readonly initialConcentrationMolPerM3: readonly number[];
}

export interface FirstOrderSpatialReaction {
  readonly id: string;
  /** Exactly one reactant species with coefficient 1; unimolecular first-order step. */
  readonly reactantSpeciesId: string;
  /** Product stoichiometry, in molecules/entities per reaction event. */
  readonly products: readonly { speciesId: string; coefficient: number }[];
  /** Macroscopic first-order rate constant in s^-1. */
  readonly rateConstantPerS: number;
}

export interface ReactionDiffusion1DInput {
  readonly lengthMeters: number;
  readonly timeStepSeconds: number;
  readonly steps: number;
  readonly species: readonly DiffusionSpecies[];
  readonly reactions: readonly FirstOrderSpatialReaction[];
}

export interface ReactionDiffusion1DResult {
  readonly cellWidthMeters: number;
  readonly elapsedSeconds: number;
  readonly timeStepSeconds: number;
  readonly steps: number;
  readonly stabilityNumber: number;
  /** species id -> cell-centred concentration array in mol m^-3. */
  readonly concentrationsMolPerM3: Readonly<Record<string, readonly number[]>>;
}

/**
 * Explicit finite-volume solver for 1-D diffusion plus unimolecular mass-action
 * reactions. Cell-centred concentrations use zero-flux (Neumann) boundaries.
 *
 * This is a deterministic continuum model, not the particle sandbox or SSA.
 * Stability/positivity requires dt * (2 D_max / dx^2 + max species out-rate) <= 1.
 */
export function simulateReactionDiffusion1D(input: ReactionDiffusion1DInput): ReactionDiffusion1DResult {
  const { lengthMeters, timeStepSeconds: dt, steps, species, reactions } = input;
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0 ||
      !Number.isFinite(dt) || dt <= 0 ||
      !Number.isSafeInteger(steps) || steps < 1 ||
      !Array.isArray(species) || species.length < 1) {
    throw new SimulationInputError('Length, time step, step count and species must be valid positive inputs.');
  }
  const cells = species[0].initialConcentrationMolPerM3.length;
  if (!Number.isSafeInteger(cells) || cells < 2) {
    throw new SimulationInputError('At least two finite-volume cells are required.');
  }
  const ids = new Set<string>();
  for (const item of species) {
    if (!item.id || ids.has(item.id)) throw new SimulationInputError('Species ids must be non-empty and unique.');
    ids.add(item.id);
    if (!Number.isFinite(item.diffusionCoefficientM2PerS) || item.diffusionCoefficientM2PerS < 0 ||
        item.initialConcentrationMolPerM3.length !== cells ||
        item.initialConcentrationMolPerM3.some(value => !Number.isFinite(value) || value < 0)) {
      throw new SimulationInputError(`Species "${item.id}" has invalid diffusion or initial concentration data.`);
    }
  }
  const outRates: Record<string, number> = Object.fromEntries(species.map(item => [item.id, 0]));
  for (const reaction of reactions) {
    if (!reaction.id || !ids.has(reaction.reactantSpeciesId) ||
        !Number.isFinite(reaction.rateConstantPerS) || reaction.rateConstantPerS < 0 ||
        !Array.isArray(reaction.products) || reaction.products.some(p =>
          !ids.has(p.speciesId) || !Number.isSafeInteger(p.coefficient) || p.coefficient < 1)) {
      throw new SimulationInputError(`Reaction "${reaction.id}" is invalid.`);
    }
    outRates[reaction.reactantSpeciesId] += reaction.rateConstantPerS;
  }
  const dx = lengthMeters / cells;
  const maxD = Math.max(...species.map(item => item.diffusionCoefficientM2PerS));
  const maxOutRate = Math.max(...Object.values(outRates));
  const stabilityNumber = dt * (2 * maxD / (dx * dx) + maxOutRate);
  if (stabilityNumber > 1 + 1e-12) {
    throw new SimulationInputError(`Explicit solver unstable: stability number ${stabilityNumber} exceeds 1. Reduce the time step or refine the grid.`);
  }

  const values: Record<string, number[]> = Object.fromEntries(
    species.map(item => [item.id, [...item.initialConcentrationMolPerM3]]),
  );
  for (let step = 0; step < steps; step++) {
    const next: Record<string, number[]> = {};
    for (const item of species) {
      const current = values[item.id];
      const updated = current.map((value, cell) => {
        const leftFlux = cell === 0 ? 0 : item.diffusionCoefficientM2PerS * (value - current[cell - 1]) / dx;
        const rightFlux = cell === cells - 1 ? 0 : item.diffusionCoefficientM2PerS * (current[cell + 1] - value) / dx;
        return value + dt * (rightFlux - leftFlux) / dx;
      });
      next[item.id] = updated;
    }
    // Reactions are evaluated from the same old-time state (explicit operator step).
    for (const reaction of reactions) {
      const source = values[reaction.reactantSpeciesId];
      const extentRate = reaction.rateConstantPerS;
      for (let cell = 0; cell < cells; cell++) {
        const extent = dt * extentRate * source[cell];
        next[reaction.reactantSpeciesId][cell] -= extent;
        for (const product of reaction.products) next[product.speciesId][cell] += product.coefficient * extent;
      }
    }
    for (const item of species) {
      for (let cell = 0; cell < cells; cell++) {
        const value = next[item.id][cell];
        if (!Number.isFinite(value) || value < -1e-10) {
          throw new SimulationInputError('Numerical solution became non-finite or negative; reduce the time step.');
        }
        if (value < 0) next[item.id][cell] = 0;
      }
    }
    Object.assign(values, next);
  }
  return {
    cellWidthMeters: dx,
    elapsedSeconds: dt * steps,
    timeStepSeconds: dt,
    steps,
    stabilityNumber,
    concentrationsMolPerM3: Object.fromEntries(Object.entries(values).map(([id, row]) => [id, row])),
  };
}
