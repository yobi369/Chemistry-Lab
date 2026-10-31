import { SimulationInputError } from './gillespie';
import { GAS_CONSTANT_J_PER_MOL_K } from './arrhenius';

export interface StandardThermodynamicState {
  readonly temperatureKelvin: number;
  readonly enthalpyJPerMol: number;
  readonly entropyJPerMolKelvin: number;
}

export interface ThermodynamicResult {
  readonly temperatureKelvin: number;
  readonly gibbsEnergyJPerMol: number;
  readonly logEquilibriumConstant: number;
  readonly equilibriumConstant: number | null;
  readonly equilibriumConstantOverflowed: boolean;
}

/** Compute ΔG°=ΔH°−TΔS° and ln K°=−ΔG°/(RT). */
export function calculateStandardThermodynamics(
  state: StandardThermodynamicState,
): ThermodynamicResult {
  const { temperatureKelvin: temperature, enthalpyJPerMol: enthalpy, entropyJPerMolKelvin: entropy } = state;
  if (!Number.isFinite(temperature) || temperature <= 0 ||
      !Number.isFinite(enthalpy) || !Number.isFinite(entropy)) {
    throw new SimulationInputError('Thermodynamic inputs require T > 0 K and finite ΔH° and ΔS° values in SI units.');
  }
  const gibbs = enthalpy - temperature * entropy;
  const logK = -gibbs / (GAS_CONSTANT_J_PER_MOL_K * temperature);
  const equilibrium = Math.exp(logK);
  const overflowed = !Number.isFinite(equilibrium);
  return {
    temperatureKelvin: temperature,
    gibbsEnergyJPerMol: gibbs,
    logEquilibriumConstant: logK,
    equilibriumConstant: overflowed ? null : equilibrium,
    equilibriumConstantOverflowed: overflowed,
  };
}

/** van 't Hoff prediction assuming temperature-independent ΔH° over the interval. */
export function predictEquilibriumConstantAtTemperature(args: {
  referenceEquilibriumConstant: number;
  referenceTemperatureKelvin: number;
  targetTemperatureKelvin: number;
  enthalpyJPerMol: number;
}): number {
  const { referenceEquilibriumConstant: kRef, referenceTemperatureKelvin: tRef,
    targetTemperatureKelvin: tTarget, enthalpyJPerMol: enthalpy } = args;
  if (!Number.isFinite(kRef) || kRef <= 0 || !Number.isFinite(tRef) || tRef <= 0 ||
      !Number.isFinite(tTarget) || tTarget <= 0 || !Number.isFinite(enthalpy)) {
    throw new SimulationInputError('van\'t Hoff inputs require positive equilibrium constants and temperatures plus finite enthalpy.');
  }
  const logK = Math.log(kRef) - enthalpy / GAS_CONSTANT_J_PER_MOL_K * (1 / tTarget - 1 / tRef);
  const result = Math.exp(logK);
  if (!Number.isFinite(result) || result === 0) {
    throw new SimulationInputError('Predicted equilibrium constant is outside the representable numeric range; inspect log K instead.');
  }
  return result;
}

/** Reaction quotient free-energy change ΔG=ΔG°+RT ln Q for Q>0. */
export function calculateReactionFreeEnergyChange(args: {
  standardGibbsEnergyJPerMol: number;
  temperatureKelvin: number;
  reactionQuotient: number;
}): number {
  const { standardGibbsEnergyJPerMol, temperatureKelvin, reactionQuotient } = args;
  if (!Number.isFinite(standardGibbsEnergyJPerMol) ||
      !Number.isFinite(temperatureKelvin) || temperatureKelvin <= 0 ||
      !Number.isFinite(reactionQuotient) || reactionQuotient <= 0) {
    throw new SimulationInputError('ΔG°, T and Q must be finite, with T and Q strictly positive.');
  }
  return standardGibbsEnergyJPerMol +
    GAS_CONSTANT_J_PER_MOL_K * temperatureKelvin * Math.log(reactionQuotient);
}
