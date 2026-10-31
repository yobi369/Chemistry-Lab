import { SimulationInputError } from './gillespie';

export const GAS_CONSTANT_J_PER_MOL_K = 8.31446261815324;

export interface ArrheniusResult {
  readonly rateConstant: number;
  readonly preExponentialFactor: number;
  readonly activationEnergyJPerMol: number;
  readonly temperatureKelvin: number;
  readonly exponentialFactor: number;
}

/**
 * Evaluate k(T) = A exp(-Ea / RT).
 *
 * A has the same units as the resulting macroscopic k. Ea is J mol^-1,
 * temperature is kelvin, and R is J mol^-1 K^-1. This helper does not
 * determine the reaction mechanism or infer A's dimensional units.
 */
export function calculateArrheniusRate(
  preExponentialFactor: number,
  activationEnergyJPerMol: number,
  temperatureKelvin: number,
): ArrheniusResult {
  if (!Number.isFinite(preExponentialFactor) || preExponentialFactor < 0) {
    throw new SimulationInputError('Pre-exponential factor A must be finite and non-negative.');
  }
  if (!Number.isFinite(activationEnergyJPerMol) || activationEnergyJPerMol < 0) {
    throw new SimulationInputError('Activation energy must be finite and non-negative J/mol.');
  }
  if (!Number.isFinite(temperatureKelvin) || temperatureKelvin <= 0) {
    throw new SimulationInputError('Temperature must be finite and greater than zero kelvin.');
  }

  const exponent = -activationEnergyJPerMol / (GAS_CONSTANT_J_PER_MOL_K * temperatureKelvin);
  const exponentialFactor = Math.exp(exponent);
  const rateConstant = preExponentialFactor * exponentialFactor;
  if (!Number.isFinite(rateConstant)) {
    throw new SimulationInputError('Arrhenius rate constant is outside the representable numeric range.');
  }

  return {
    rateConstant,
    preExponentialFactor,
    activationEnergyJPerMol,
    temperatureKelvin,
    exponentialFactor,
  };
}
